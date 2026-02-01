import {
  setupCanvas,
  resizeCanvas,
  getCanvasCoordinates,
  drawSegment,
  drawCursor,
  redrawAll,
  getViewport,
  setViewport,
  drawShape
} from "./canvas.js";
import { createSocket, registerSocketHandlers } from "./websocket.js";

// Canvas elements
const drawCanvas = document.getElementById("drawCanvas");
const cursorCanvas = document.getElementById("cursorCanvas");
const drawCtx = setupCanvas(drawCanvas);
const cursorCtx = setupCanvas(cursorCanvas);

// UI Elements
const colorPicker = document.getElementById("colorPicker");
const widthRange = document.getElementById("widthRange");
const opacityRange = document.getElementById("opacityRange");
const widthValue = document.getElementById("widthValue");
const opacityValue = document.getElementById("opacityValue");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const userCount = document.getElementById("userCount");
const zoomLevel = document.getElementById("zoomLevel");
const canvasPosition = document.getElementById("canvasPosition");
const connectionStatus = document.getElementById("connectionStatus");

// Tool buttons
const penTool = document.getElementById("penTool");
const eraserTool = document.getElementById("eraserTool");
const lineTool = document.getElementById("lineTool");
const rectTool = document.getElementById("rectTool");
const circleTool = document.getElementById("circleTool");

// Color presets
const colorPresets = document.querySelectorAll(".color-preset");

// State
let currentTool = "pen";
let drawing = false;
let panning = false;
let lastPoint = null;
let panStart = null;
let currentStroke = null;
let tempShape = null;
let currentStyle = {
  color: colorPicker.value,
  width: Number(widthRange.value),
  opacity: Number(opacityRange.value)
};
let strokes = [];
let userId = null;
const cursors = {};
let connectedUsers = new Set();

// Socket setup
const roomId = new URLSearchParams(window.location.search).get("room") || "lobby";
const socket = createSocket(roomId);

// Connection status
socket.on('connect', () => {
  updateConnectionStatus(true);
  console.log('[APP] Socket connected successfully');
});

socket.on('disconnect', () => {
  updateConnectionStatus(false);
  console.warn('[APP] Socket disconnected');
});

function updateConnectionStatus(connected) {
  const dot = connectionStatus.querySelector('.status-dot');
  const text = connectionStatus.querySelector('.status-text');
  
  if (connected) {
    dot.className = 'status-dot status-dot--connected';
    text.textContent = 'Connected';
    document.title = "🎨 Collaborative Canvas";
  } else {
    dot.className = 'status-dot status-dot--disconnected';
    text.textContent = 'Disconnected';
    document.title = "🎨 Collaborative Canvas - Reconnecting...";
  }
}

function nextStrokeId() {
  return `${userId || "anon"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Socket handlers
registerSocketHandlers({
  socket,
  onHello: (payload) => {
    userId = payload.userId;
    connectedUsers.add(userId);
    updateUserCount();
    console.log(`Connected as user: ${userId}`);
  },
  onState: (payload) => {
    strokes = payload.strokes ? JSON.parse(JSON.stringify(payload.strokes)) : [];
    redrawAll(drawCtx, drawCanvas, strokes);
  },
  onUserJoined: (payload) => {
    connectedUsers.add(payload.userId);
    updateUserCount();
    console.log(`User joined: ${payload.userId}`);
  },
  onUserLeft: (payload) => {
    connectedUsers.delete(payload.userId);
    updateUserCount();
    delete cursors[payload.userId];
    drawCursor(cursorCtx, cursorCanvas, cursors);
  },
  onStrokeStart: (payload) => {
    const stroke = {
      id: payload.id,
      userId: payload.userId,
      style: payload.style || { color: "#111111", width: 4, opacity: 100 },
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

function updateUserCount() {
  userCount.textContent = connectedUsers.size;
}

function updateZoomDisplay() {
  const viewport = getViewport();
  zoomLevel.textContent = `${Math.round(viewport.scale * 100)}%`;
  canvasPosition.textContent = `${Math.round(viewport.offsetX)}, ${Math.round(viewport.offsetY)}`;
}

function updateCanvasSize() {
  resizeCanvas(drawCanvas, drawCtx);
  resizeCanvas(cursorCanvas, cursorCtx);
  redrawAll(drawCtx, drawCanvas, strokes);
  drawCursor(cursorCtx, cursorCanvas, cursors);
}

window.addEventListener("resize", updateCanvasSize);

// Tool selection
function selectTool(tool) {
  currentTool = tool;
  [penTool, eraserTool, lineTool, rectTool, circleTool].forEach(btn => {
    btn.classList.remove('active');
  });
  
  switch(tool) {
    case 'pen': penTool.classList.add('active'); break;
    case 'eraser': eraserTool.classList.add('active'); break;
    case 'line': lineTool.classList.add('active'); break;
    case 'rectangle': rectTool.classList.add('active'); break;
    case 'circle': circleTool.classList.add('active'); break;
  }
  
  drawCanvas.style.cursor = tool === 'eraser' ? 'crosshair' : 'crosshair';
}

penTool.addEventListener('click', () => selectTool('pen'));
eraserTool.addEventListener('click', () => selectTool('eraser'));
lineTool.addEventListener('click', () => selectTool('line'));
rectTool.addEventListener('click', () => selectTool('rectangle'));
circleTool.addEventListener('click', () => selectTool('circle'));

// Color presets
colorPresets.forEach(preset => {
  preset.addEventListener('click', () => {
    const color = preset.dataset.color;
    colorPicker.value = color;
    currentStyle.color = color;
  });
});

// Range inputs
widthRange.addEventListener('input', (e) => {
  widthValue.textContent = e.target.value;
  currentStyle.width = Number(e.target.value);
});

opacityRange.addEventListener('input', (e) => {
  opacityValue.textContent = e.target.value;
  currentStyle.opacity = Number(e.target.value);
});

colorPicker.addEventListener('input', (e) => {
  currentStyle.color = e.target.value;
});

// Zoom controls
zoomInBtn.addEventListener('click', () => {
  const viewport = getViewport();
  const newScale = Math.min(viewport.scale * 1.2, 5);
  setViewport({ scale: newScale });
  updateCanvasSize();
  updateZoomDisplay();
});

zoomOutBtn.addEventListener('click', () => {
  const viewport = getViewport();
  const newScale = Math.max(viewport.scale / 1.2, 0.1);
  setViewport({ scale: newScale });
  updateCanvasSize();
  updateZoomDisplay();
});

zoomResetBtn.addEventListener('click', () => {
  setViewport({ offsetX: 0, offsetY: 0, scale: 1 });
  updateCanvasSize();
  updateZoomDisplay();
});

// Mouse wheel zoom
drawCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const viewport = getViewport();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(Math.max(viewport.scale * delta, 0.1), 5);
  setViewport({ scale: newScale });
  updateCanvasSize();
  updateZoomDisplay();
}, { passive: false });

// Drawing functions
function handlePointerDown(event) {
  const point = getCanvasCoordinates(event, drawCanvas);
  
  // Middle mouse button or Shift + Left click for panning
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    panning = true;
    panStart = { x: event.clientX, y: event.clientY };
    drawCanvas.style.cursor = 'grabbing';
    return;
  }
  
  if (event.button !== 0) return;
  
  drawing = true;
  lastPoint = point;
  currentStyle = {
    color: currentTool === 'eraser' ? '#0f1115' : colorPicker.value,
    width: currentTool === 'eraser' ? Number(widthRange.value) * 3 : Number(widthRange.value),
    opacity: Number(opacityRange.value)
  };
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
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
  } else {
    // Shape tools
    tempShape = {
      type: currentTool,
      start: point,
      end: point,
      style: currentStyle
    };
  }
}

let rafId = null;
let queuedPoint = null;
let lastCursorEmitTime = 0;
const CURSOR_THROTTLE_MS = 50;

function handlePointerMove(event) {
  const point = getCanvasCoordinates(event, drawCanvas);
  if (!point) return;
  
  // Panning
  if (panning && panStart) {
    const viewport = getViewport();
    const dx = (event.clientX - panStart.x) / viewport.scale;
    const dy = (event.clientY - panStart.y) / viewport.scale;
    setViewport({
      offsetX: viewport.offsetX + dx,
      offsetY: viewport.offsetY + dy
    });
    panStart = { x: event.clientX, y: event.clientY };
    updateCanvasSize();
    updateZoomDisplay();
    return;
  }
  
  // Cursor emission
  const now = Date.now();
  if (now - lastCursorEmitTime > CURSOR_THROTTLE_MS) {
    socket.emit("cursor", point);
    lastCursorEmitTime = now;
  }
  
  if (!drawing) return;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    queuedPoint = point;
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!queuedPoint) return;
        
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
  } else if (tempShape) {
    // Update shape preview
    tempShape.end = point;
    redrawAll(drawCtx, drawCanvas, strokes);
    drawShape(drawCtx, tempShape);
  }
}

function handlePointerUp() {
  if (panning) {
    panning = false;
    panStart = null;
    drawCanvas.style.cursor = 'crosshair';
    return;
  }
  
  if (!drawing) return;
  
  drawing = false;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    if (currentStroke) {
      socket.emit("stroke:end", { id: currentStroke.id });
    }
    currentStroke = null;
  } else if (tempShape) {
    // Convert shape to stroke
    const shapeStroke = {
      id: nextStrokeId(),
      userId,
      style: tempShape.style,
      points: generateShapePoints(tempShape),
      type: tempShape.type
    };
    strokes.push(shapeStroke);
    socket.emit("stroke:start", {
      id: shapeStroke.id,
      style: shapeStroke.style,
      point: shapeStroke.points[0]
    });
    for (let i = 1; i < shapeStroke.points.length; i++) {
      socket.emit("stroke:segment", {
        id: shapeStroke.id,
        point: shapeStroke.points[i]
      });
    }
    socket.emit("stroke:end", { id: shapeStroke.id });
    tempShape = null;
    redrawAll(drawCtx, drawCanvas, strokes);
  }
  
  lastPoint = null;
}

function generateShapePoints(shape) {
  const points = [];
  if (shape.type === 'line') {
    points.push(shape.start, shape.end);
  } else if (shape.type === 'rectangle') {
    points.push(
      { x: shape.start.x, y: shape.start.y },
      { x: shape.end.x, y: shape.start.y },
      { x: shape.end.x, y: shape.end.y },
      { x: shape.start.x, y: shape.end.y },
      { x: shape.start.x, y: shape.start.y }
    );
  } else if (shape.type === 'circle') {
    const radius = Math.sqrt(
      Math.pow(shape.end.x - shape.start.x, 2) +
      Math.pow(shape.end.y - shape.start.y, 2)
    );
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: shape.start.x + Math.cos(angle) * radius,
        y: shape.start.y + Math.sin(angle) * radius
      });
    }
  }
  return points;
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
  if (points.length < 3) return;
  
  ctx.globalAlpha = (style.opacity || 100) / 100;
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
  ctx.globalAlpha = 1;
}

// Event listeners
drawCanvas.addEventListener("pointerdown", handlePointerDown);
drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: true });
drawCanvas.addEventListener("pointerup", handlePointerUp);
drawCanvas.addEventListener("pointerleave", handlePointerUp);

// Button actions
undoBtn.addEventListener("click", () => {
  socket.emit("undo");
});

redoBtn.addEventListener("click", () => {
  socket.emit("redo");
});

clearBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the canvas? This will clear it for all users.")) {
    strokes = [];
    socket.emit("clear");
    redrawAll(drawCtx, drawCanvas, strokes);
  }
});

saveBtn.addEventListener("click", () => {
  const link = document.createElement('a');
  link.download = `canvas-${Date.now()}.png`;
  link.href = drawCanvas.toDataURL();
  link.click();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      socket.emit("undo");
    } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
      e.preventDefault();
      socket.emit("redo");
    }
  }
  
  // Tool shortcuts
  if (!e.ctrlKey && !e.metaKey) {
    switch(e.key) {
      case 'p': selectTool('pen'); break;
      case 'e': selectTool('eraser'); break;
      case 'l': selectTool('line'); break;
      case 'r': selectTool('rectangle'); break;
      case 'c': selectTool('circle'); break;
    }
  }
});

// Initialize
updateCanvasSize();
updateZoomDisplay();
updateConnectionStatus(false);
