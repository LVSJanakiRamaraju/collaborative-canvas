import {
  setupCanvas,
  resizeCanvas,
  getCanvasCoordinates,
  drawSegment
} from "./canvas.js";
import { createSocket } from "./websocket.js";

const drawCanvas = document.getElementById("drawCanvas");

const drawCtx = setupCanvas(drawCanvas);

const colorPicker = document.getElementById("colorPicker");
const widthRange = document.getElementById("widthRange");
let drawing = false;
let lastPoint = null;
let currentStyle = {
  color: colorPicker.value,
  width: Number(widthRange.value)
};

const roomId = new URLSearchParams(window.location.search).get("room") || "lobby";
const socket = createSocket(roomId);

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
      lastPoint = nextPoint;
    });
  }
}

function handlePointerUp() {
  if (!drawing) {
    return;
  }
  drawing = false;
  lastPoint = null;
}

drawCanvas.addEventListener("pointerdown", handlePointerDown);
drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: true });
drawCanvas.addEventListener("pointerup", handlePointerUp);
drawCanvas.addEventListener("pointerleave", handlePointerUp);

updateCanvasSize();
