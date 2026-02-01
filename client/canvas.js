const DPR = window.devicePixelRatio || 1;

// Viewport state for infinite canvas
let viewport = {
  offsetX: 0,
  offsetY: 0,
  scale: 1
};

export function getViewport() {
  return { ...viewport };
}

export function setViewport(newViewport) {
  viewport = { ...viewport, ...newViewport };
}

export function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  resizeCanvas(canvas, ctx);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}

export function resizeCanvas(canvas, ctx) {
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * DPR);
  canvas.height = Math.floor(height * DPR);
  applyTransform(ctx);
}

function applyTransform(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.scale, viewport.scale);
}

export function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX ?? event.touches?.[0]?.clientX;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY;

  const x = (clientX - rect.left) / viewport.scale - viewport.offsetX;
  const y = (clientY - rect.top) / viewport.scale - viewport.offsetY;

  return { x, y };
}

export function drawSegment(ctx, start, end, style) {
  if (!start || !end) {
    return;
  }
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

export function drawSmoothSegment(ctx, p0, p1, p2, style) {
  if (!p0 || !p1 || !p2) {
    return;
  }
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  
  const cp1x = p0.x + (p1.x - p0.x) * 0.5;
  const cp1y = p0.y + (p1.y - p0.y) * 0.5;
  const cp2x = p1.x;
  const cp2y = p1.y;
  const endx = p1.x + (p2.x - p1.x) * 0.5;
  const endy = p1.y + (p2.y - p1.y) * 0.5;
  
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endx, endy);
  ctx.stroke();
}

export function clearCanvas(ctx, canvas) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  applyTransform(ctx);
}

export function drawCursor(ctx, canvas, cursors) {
  clearCanvas(ctx, canvas);
  ctx.save();
  Object.values(cursors).forEach((cursor) => {
    if (!cursor) {
      return;
    }
    ctx.fillStyle = cursor.color;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 5 / viewport.scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function redrawAll(ctx, canvas, strokes) {
  clearCanvas(ctx, canvas);
  strokes.forEach((stroke) => {
    const points = stroke.points || [];
    if (points.length < 2) {
      return;
    }
    
    ctx.globalAlpha = (stroke.style.opacity || 100) / 100;
    ctx.strokeStyle = stroke.style.color;
    ctx.lineWidth = stroke.style.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i += 1) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
    }
    
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

export function drawShape(ctx, shape) {
  ctx.globalAlpha = (shape.style.opacity || 100) / 100;
  ctx.strokeStyle = shape.style.color;
  ctx.lineWidth = shape.style.width;
  
  if (shape.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
  } else if (shape.type === 'rectangle') {
    ctx.strokeRect(
      shape.start.x,
      shape.start.y,
      shape.end.x - shape.start.x,
      shape.end.y - shape.start.y
    );
  } else if (shape.type === 'circle') {
    const radius = Math.sqrt(
      Math.pow(shape.end.x - shape.start.x, 2) +
      Math.pow(shape.end.y - shape.start.y, 2)
    );
    ctx.beginPath();
    ctx.arc(shape.start.x, shape.start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
}
