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
const minimapCanvas = document.getElementById("minimapCanvas");
const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;
const MINIMAP_PADDING = 8;
const MINIMAP_DPR = window.devicePixelRatio || 1;
let minimapTransform = null;
let minimapDragging = false;
let minimapRaf = null;

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

const connectionStatus = document.getElementById("connectionStatus");

// Tool buttons
const penTool = document.getElementById("penTool");
const eraserTool = document.getElementById("eraserTool");

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
    console.log('[APP] State received with', strokes.length, 'strokes');
    strokes.forEach((s, i) => {
      if (s.type) {
        console.log(`  [${i}] Shape type=${s.type}, start=`, s.start, 'end=', s.end);
      }
    });
    redrawAll(drawCtx, drawCanvas, strokes);
    scheduleMinimapUpdate();
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
    // Preserve shape properties if this is a shape stroke
    if (payload.type) {
      stroke.type = payload.type;
      stroke.start = payload.start;
      stroke.end = payload.end;
    }
    strokes.push(stroke);
  },
  onStrokeSegment: (payload) => {
    const stroke = strokes.find((item) => item.id === payload.id);
    if (!stroke) {
      console.warn(`Segment received for unknown stroke ${payload.id}`);
      return;
    }
    stroke.points.push(payload.point);
    
    // For shapes, redraw all to use drawShape instead of drawing as curve
    if (stroke.type) {
      redrawAll(drawCtx, drawCanvas, strokes);
      scheduleMinimapUpdate();
      return;
    }
    
    const points = stroke.points;
    if (points.length >= 3) {
      drawSmoothCurve(drawCtx, points, stroke.style);
    } else if (points.length === 2) {
      drawSegment(drawCtx, points[0], points[1], stroke.style);
    }
    scheduleMinimapUpdate();
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
}

function resizeMinimapCanvas() {
  if (!minimapCanvas || !minimapCtx) return;
  const rect = minimapCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  minimapCanvas.width = Math.floor(rect.width * MINIMAP_DPR);
  minimapCanvas.height = Math.floor(rect.height * MINIMAP_DPR);
  minimapCtx.setTransform(MINIMAP_DPR, 0, 0, MINIMAP_DPR, 0, 0);
}

function getViewportWorldRect() {
  const viewport = getViewport();
  const rect = drawCanvas.getBoundingClientRect();
  const width = rect.width / viewport.scale;
  const height = rect.height / viewport.scale;
  const x = -viewport.offsetX / viewport.scale;
  const y = -viewport.offsetY / viewport.scale;
  return { x, y, width, height };
}

function mergeBounds(bounds, next) {
  if (!next) return bounds;
  if (!bounds) return { ...next };
  return {
    minX: Math.min(bounds.minX, next.minX),
    minY: Math.min(bounds.minY, next.minY),
    maxX: Math.max(bounds.maxX, next.maxX),
    maxY: Math.max(bounds.maxY, next.maxY)
  };
}

function getStrokeBounds(stroke) {
  if (stroke.type && stroke.start && stroke.end) {
    if (stroke.type === 'circle') {
      const radius = Math.hypot(stroke.end.x - stroke.start.x, stroke.end.y - stroke.start.y);
      return {
        minX: stroke.start.x - radius,
        minY: stroke.start.y - radius,
        maxX: stroke.start.x + radius,
        maxY: stroke.start.y + radius
      };
    }
    const minX = Math.min(stroke.start.x, stroke.end.x);
    const minY = Math.min(stroke.start.y, stroke.end.y);
    const maxX = Math.max(stroke.start.x, stroke.end.x);
    const maxY = Math.max(stroke.start.y, stroke.end.y);
    return { minX, minY, maxX, maxY };
  }

  const points = stroke.points || [];
  if (!points.length) return null;
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function getWorldBounds() {
  let bounds = null;
  strokes.forEach((stroke) => {
    bounds = mergeBounds(bounds, getStrokeBounds(stroke));
  });

  const view = getViewportWorldRect();
  bounds = mergeBounds(bounds, {
    minX: view.x,
    minY: view.y,
    maxX: view.x + view.width,
    maxY: view.y + view.height
  });

  if (!bounds) {
    return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
  }

  const width = bounds.maxX - bounds.minX || 1;
  const height = bounds.maxY - bounds.minY || 1;
  const pad = Math.max(100, Math.max(width, height) * 0.1);
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad
  };
}

function scheduleMinimapUpdate() {
  if (!minimapCtx) return;
  if (minimapRaf) return;
  minimapRaf = requestAnimationFrame(() => {
    minimapRaf = null;
    drawMinimap();
  });
}

function drawMinimap() {
  if (!minimapCanvas || !minimapCtx) return;
  const rect = minimapCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const ctx = minimapCtx;
  const width = rect.width;
  const height = rect.height;
  ctx.setTransform(MINIMAP_DPR, 0, 0, MINIMAP_DPR, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(12, 15, 21, 0.9)';
  ctx.fillRect(0, 0, width, height);

  const bounds = getWorldBounds();
  const worldWidth = bounds.maxX - bounds.minX || 1;
  const worldHeight = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(
    (width - MINIMAP_PADDING * 2) / worldWidth,
    (height - MINIMAP_PADDING * 2) / worldHeight
  );
  const offsetX = MINIMAP_PADDING - bounds.minX * scale;
  const offsetY = MINIMAP_PADDING - bounds.minY * scale;
  minimapTransform = { scale, offsetX, offsetY, bounds };

  const toMini = (point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY
  });

  strokes.forEach((stroke) => {
    const style = stroke.style || { color: '#ffffff', width: 2, opacity: 100 };
    ctx.globalAlpha = (style.opacity || 100) / 100;
    ctx.strokeStyle = style.color || '#ffffff';
    ctx.lineWidth = Math.max(1, style.width * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.type && stroke.start && stroke.end) {
      if (stroke.type === 'circle') {
        const radius = Math.hypot(stroke.end.x - stroke.start.x, stroke.end.y - stroke.start.y);
        const center = toMini(stroke.start);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      } else if (stroke.type === 'rectangle') {
        const start = toMini(stroke.start);
        const end = toMini(stroke.end);
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (stroke.type === 'line') {
        const start = toMini(stroke.start);
        const end = toMini(stroke.end);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    const points = stroke.points || [];
    if (points.length < 2) {
      ctx.globalAlpha = 1;
      return;
    }
    const first = toMini(points[0]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const next = toMini(points[i]);
      ctx.lineTo(next.x, next.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  const view = getViewportWorldRect();
  const viewStart = { x: view.x, y: view.y };
  const viewEnd = { x: view.x + view.width, y: view.y + view.height };
  const miniStart = toMini(viewStart);
  const miniEnd = toMini(viewEnd);
  ctx.strokeStyle = 'rgba(31, 111, 235, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    miniStart.x,
    miniStart.y,
    miniEnd.x - miniStart.x,
    miniEnd.y - miniStart.y
  );
}

function centerViewportOnWorldPoint(point) {
  if (!point) return;
  const viewport = getViewport();
  const rect = drawCanvas.getBoundingClientRect();
  const offsetX = rect.width / 2 / viewport.scale - point.x;
  const offsetY = rect.height / 2 / viewport.scale - point.y;
  setViewport({ offsetX, offsetY });
  updateCanvasSize();
  updateZoomDisplay();
}

function getWorldPointFromMinimapEvent(event) {
  if (!minimapCanvas || !minimapTransform) return null;
  const rect = minimapCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return {
    x: (x - minimapTransform.offsetX) / minimapTransform.scale,
    y: (y - minimapTransform.offsetY) / minimapTransform.scale
  };
}

function handleMinimapPointer(event) {
  const point = getWorldPointFromMinimapEvent(event);
  centerViewportOnWorldPoint(point);
}

function updateCanvasSize() {
  resizeCanvas(drawCanvas, drawCtx);
  resizeCanvas(cursorCanvas, cursorCtx);
  resizeMinimapCanvas();
  redrawAll(drawCtx, drawCanvas, strokes);
  drawCursor(cursorCtx, cursorCanvas, cursors);
  scheduleMinimapUpdate();
}

window.addEventListener("resize", updateCanvasSize);

if (minimapCanvas) {
  minimapCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    minimapDragging = true;
    minimapCanvas.setPointerCapture(event.pointerId);
    handleMinimapPointer(event);
  });

  minimapCanvas.addEventListener("pointermove", (event) => {
    if (!minimapDragging) return;
    event.preventDefault();
    handleMinimapPointer(event);
  });

  minimapCanvas.addEventListener("pointerup", (event) => {
    minimapDragging = false;
    try {
      minimapCanvas.releasePointerCapture(event.pointerId);
    } catch (err) {
      // ignore
    }
  });

  minimapCanvas.addEventListener("pointerleave", () => {
    minimapDragging = false;
  });
}

// Tool selection
function selectTool(tool) {
  currentTool = tool;
  [penTool, eraserTool].forEach(btn => {
    btn.classList.remove('active');
  });
  
  switch(tool) {
    case 'pen': penTool.classList.add('active'); break;
    case 'eraser': eraserTool.classList.add('active'); break;
  }
  
  drawCanvas.style.cursor = tool === 'eraser' ? 'crosshair' : 'crosshair';
}

penTool.addEventListener('click', () => selectTool('pen'));
eraserTool.addEventListener('click', () => selectTool('eraser'));

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
  scheduleMinimapUpdate();
});

zoomOutBtn.addEventListener('click', () => {
  const viewport = getViewport();
  const newScale = Math.max(viewport.scale / 1.2, 0.1);
  setViewport({ scale: newScale });
  updateCanvasSize();
  updateZoomDisplay();
  scheduleMinimapUpdate();
});

zoomResetBtn.addEventListener('click', () => {
  setViewport({ offsetX: 0, offsetY: 0, scale: 1 });
  updateCanvasSize();
  updateZoomDisplay();
  scheduleMinimapUpdate();
});

function zoomAtClientPoint(clientX, clientY, newScale) {
  const rect = drawCanvas.getBoundingClientRect();
  const viewport = getViewport();
  const worldX = (clientX - rect.left) / viewport.scale - viewport.offsetX;
  const worldY = (clientY - rect.top) / viewport.scale - viewport.offsetY;
  const nextOffsetX = (clientX - rect.left) / newScale - worldX;
  const nextOffsetY = (clientY - rect.top) / newScale - worldY;
  setViewport({ scale: newScale, offsetX: nextOffsetX, offsetY: nextOffsetY });
}

// Mouse wheel: pan by default, zoom when Ctrl/Meta is pressed (trackpad pinch)
drawCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const viewport = getViewport();

  if (e.ctrlKey || e.metaKey) {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(viewport.scale * delta, 0.1), 5);
    zoomAtClientPoint(e.clientX, e.clientY, newScale);
    updateCanvasSize();
    updateZoomDisplay();
    scheduleMinimapUpdate();
    return;
  }

  const dx = e.deltaX / viewport.scale;
  const dy = e.deltaY / viewport.scale;
  setViewport({
    offsetX: viewport.offsetX - dx,
    offsetY: viewport.offsetY - dy
  });
  updateCanvasSize();
  updateZoomDisplay();
  scheduleMinimapUpdate();
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
  if (!point) return;
  
  // Panning
  if (panning && panStart) {
    const viewport = getViewport();
    const dx = (event.clientX - panStart.x) / viewport.scale;
    const dy = (event.clientY - panStart.y) / viewport.scale;
    setViewport({
      offsetX: viewport.offsetX - dx,
      offsetY: viewport.offsetY - dy
    });
    panStart = { x: event.clientX, y: event.clientY };
    updateCanvasSize();
    updateZoomDisplay();
    scheduleMinimapUpdate();
    return;
  }
  
  // Cursor emission
  const now = Date.now();
  if (now - lastCursorEmitTime > CURSOR_THROTTLE_MS) {
    socket.emit("cursor", point);
    lastCursorEmitTime = now;
  }
  
  if (!drawing) return;
  
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
        scheduleMinimapUpdate();
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
  if (panning) {
    panning = false;
    panStart = null;
    drawCanvas.style.cursor = 'crosshair';
    return;
  }
  
  if (!drawing) return;
  
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
    scheduleMinimapUpdate();
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
    }
  }
});

// Initialize
updateCanvasSize();
updateZoomDisplay();
updateConnectionStatus(false);
