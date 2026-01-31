const DPR = window.devicePixelRatio || 1;

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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
}

export function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = event.clientX ?? event.touches?.[0]?.clientX;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY;

  return {
    x: (clientX - rect.left) * scaleX / DPR,
    y: (clientY - rect.top) * scaleY / DPR
  };
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

export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
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
    ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
