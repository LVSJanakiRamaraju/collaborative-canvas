import {
  setupCanvas,
  resizeCanvas,
  getCanvasCoordinates,
  drawSegment,
  drawCursor,
  redrawAll
} from "./canvas.js";
import { createSocket, registerSocketHandlers } from "./websocket.js";

const drawCanvas = document.getElementById("drawCanvas");
const cursorCanvas = document.getElementById("cursorCanvas");

const drawCtx = setupCanvas(drawCanvas);
const cursorCtx = setupCanvas(cursorCanvas);

const colorPicker = document.getElementById("colorPicker");
const widthRange = document.getElementById("widthRange");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
let drawing = false;
let lastPoint = null;
let currentStroke = null;
let currentStyle = {
  color: colorPicker.value,
  width: Number(widthRange.value)
};
let strokes = [];
let userId = null;
const cursors = {};

const roomId = new URLSearchParams(window.location.search).get("room") || "lobby";
const socket = createSocket(roomId);

function nextStrokeId() {
  return `${userId || "anon"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

registerSocketHandlers({
  socket,
  onHello: (payload) => {
    userId = payload.userId;
  },
  onState: (payload) => {
    strokes = payload.strokes || [];
    redrawAll(drawCtx, drawCanvas, strokes);
  },
  onStrokeStart: (payload) => {
    const stroke = {
      id: payload.id,
      userId: payload.userId,
      style: payload.style,
      points: [payload.point]
    };
    strokes.push(stroke);
  },
  onStrokeSegment: (payload) => {
    const stroke = strokes.find((item) => item.id === payload.id);
    if (!stroke) {
      return;
    }
    stroke.points.push(payload.point);
    const points = stroke.points;
    if (points.length >= 2) {
      drawSegment(drawCtx, points[points.length - 2], points[points.length - 1], stroke.style);
    }
  },
  onStrokeEnd: () => {},
  onCursor: (payload) => {
    if (payload.userId === userId) {
      return;
    }
    const existing = cursors[payload.userId] || { color: randomColor(payload.userId) };
    cursors[payload.userId] = { ...existing, x: payload.x, y: payload.y };
    drawCursor(cursorCtx, cursorCanvas, cursors);
  },
  onCursorLeave: (payload) => {
    delete cursors[payload.userId];
    drawCursor(cursorCtx, cursorCanvas, cursors);
  }
});

function updateCanvasSize() {
  resizeCanvas(drawCanvas, drawCtx);
  resizeCanvas(cursorCanvas, cursorCtx);
  redrawAll(drawCtx, drawCanvas, strokes);
  drawCursor(cursorCtx, cursorCanvas, cursors);
}

window.addEventListener("resize", updateCanvasSize);

function handlePointerDown(event) {
  drawing = true;
  lastPoint = getCanvasCoordinates(event, drawCanvas);
  currentStyle = {
    color: colorPicker.value,
    width: Number(widthRange.value)
  };
  currentStroke = {
    id: nextStrokeId(),
    userId,
    style: currentStyle,
    points: [lastPoint]
  };
  strokes.push(currentStroke);
  socket.emit("stroke:start", {
    id: currentStroke.id,
    style: currentStyle,
    point: lastPoint
  });
}

let rafId = null;
let queuedPoint = null;

function handlePointerMove(event) {
  const point = getCanvasCoordinates(event, drawCanvas);
  if (!point) {
    return;
  }
  socket.emit("cursor", point);
  if (!drawing) {
    return;
  }

  queuedPoint = point;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!queuedPoint) {
        return;
      }
      const nextPoint = queuedPoint;
      queuedPoint = null;
      drawSegment(drawCtx, lastPoint, nextPoint, currentStyle);
      if (currentStroke) {
        currentStroke.points.push(nextPoint);
        socket.emit("stroke:segment", {
          id: currentStroke.id,
          point: nextPoint
        });
      }
      lastPoint = nextPoint;
    });
  }
}

function handlePointerUp() {
  if (!drawing) {
    return;
  }
  drawing = false;
  if (currentStroke) {
    socket.emit("stroke:end", { id: currentStroke.id });
  }
  currentStroke = null;
  lastPoint = null;
}

function randomColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

drawCanvas.addEventListener("pointerdown", handlePointerDown);
drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: true });
drawCanvas.addEventListener("pointerup", handlePointerUp);
drawCanvas.addEventListener("pointerleave", handlePointerUp);

undoBtn.addEventListener("click", () => {
  socket.emit("undo");
});

redoBtn.addEventListener("click", () => {
  socket.emit("redo");
});

updateCanvasSize();
