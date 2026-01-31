import {
  setupCanvas,
  resizeCanvas,
  getCanvasCoordinates,
  drawSegment
} from "./canvas.js";
import { createSocket, registerSocketHandlers } from "./websocket.js";

const drawCanvas = document.getElementById("drawCanvas");

const drawCtx = setupCanvas(drawCanvas);

const colorPicker = document.getElementById("colorPicker");
const widthRange = document.getElementById("widthRange");
let drawing = false;
let lastPoint = null;
let currentStroke = null;
let currentStyle = {
  color: colorPicker.value,
  width: Number(widthRange.value)
};
let strokes = [];
let userId = null;

const roomId = new URLSearchParams(window.location.search).get("room") || "lobby";
const socket = createSocket(roomId);

socket.on("connect", () => {
  userId = socket.id;
});

function nextStrokeId() {
  return `${userId || "anon"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

registerSocketHandlers({
  socket,
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
  onStrokeEnd: () => {}
});

function updateCanvasSize() {
  resizeCanvas(drawCanvas, drawCtx);
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

drawCanvas.addEventListener("pointerdown", handlePointerDown);
drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: true });
drawCanvas.addEventListener("pointerup", handlePointerUp);
drawCanvas.addEventListener("pointerleave", handlePointerUp);

updateCanvasSize();
