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

// Add connection state tracking
let isConnected = false;
let connectionAttempts = 0;

socket.on('connect', () => {
  isConnected = true;
  connectionAttempts = 0;
  console.log('[APP] Socket connected successfully');
  document.title = "🎨 Collaborative Canvas - Connected";
});

socket.on('disconnect', () => {
  isConnected = false;
  console.warn('[APP] Socket disconnected');
  document.title = "🎨 Collaborative Canvas - Reconnecting...";
});

socket.on('reconnect_attempt', () => {
  connectionAttempts++;
  console.log(`[APP] Reconnection attempt ${connectionAttempts}`);
});

function nextStrokeId() {
  return `${userId || "anon"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

registerSocketHandlers({
  socket,
  onHello: (payload) => {
    userId = payload.userId;
    console.log(`Connected as user: ${userId}`);
  },
  onState: (payload) => {
    strokes = payload.strokes ? JSON.parse(JSON.stringify(payload.strokes)) : [];
    redrawAll(drawCtx, drawCanvas, strokes);
  },
  onUserJoined: (payload) => {
    console.log(`User joined: ${payload.userId}`);
  },
  onUserLeft: (payload) => {
    delete cursors[payload.userId];
    drawCursor(cursorCtx, cursorCanvas, cursors);
  },
  onStrokeStart: (payload) => {
    const stroke = {
      id: payload.id,
      userId: payload.userId,
      style: payload.style || { color: "#111111", width: 4 },
      points: [payload.point]
    };
    strokes.push(stroke);
  },
  onStrokeSegment: (payload) => {
    const stroke = strokes.find((item) => item.id === payload.id);
    if (!stroke) {
      console.warn(`Segment received for unknown stroke ${payload.id}`);
      return;
    }
    stroke.points.push(payload.point);
    const points = stroke.points;
    if (points.length >= 3) {
      drawSmoothCurve(drawCtx, points, stroke.style);
    } else if (points.length === 2) {
      drawSegment(drawCtx, points[0], points[1], stroke.style);
    }
  },
  onStrokeEnd: (payload) => {
    console.log(`Stroke ended: ${payload.id}`);
  },
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
let lastCursorEmitTime = 0;
const CURSOR_THROTTLE_MS = 50;

function handlePointerMove(event) {
  const point = getCanvasCoordinates(event, drawCanvas);
  if (!point) {
    return;
  }
  
  // Throttle cursor emissions
  const now = Date.now();
  if (now - lastCursorEmitTime > CURSOR_THROTTLE_MS) {
    socket.emit("cursor", point);
    lastCursorEmitTime = now;
  }
  
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
      if (currentStroke) {
        currentStroke.points.push(nextPoint);
        const points = currentStroke.points;
        if (points.length >= 3) {
          drawSmoothCurve(drawCtx, points, currentStyle);
        } else if (points.length === 2) {
          drawSegment(drawCtx, points[0], points[1], currentStyle);
        }
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

function drawSmoothCurve(ctx, points, style) {
  if (points.length < 3) {
    return;
  }
  
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  const len = points.length;
  const p0 = points[len - 3];
  const p1 = points[len - 2];
  const p2 = points[len - 1];
  
  const xc = (p1.x + p2.x) / 2;
  const yc = (p1.y + p2.y) / 2;
  
  ctx.beginPath();
  if (len === 3) {
    ctx.moveTo(p0.x, p0.y);
  } else {
    const prevXc = (p0.x + p1.x) / 2;
    const prevYc = (p0.y + p1.y) / 2;
    ctx.moveTo(prevXc, prevYc);
  }
  ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
  ctx.stroke();
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
