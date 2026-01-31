export function createSocket(roomId) {
  return io({
    query: { room: roomId }
  });
}

export function registerSocketHandlers({
  socket,
  onHello,
  onState,
  onStrokeStart,
  onStrokeSegment,
  onStrokeEnd,
  onCursor,
  onCursorLeave
}) {
  socket.on("hello", onHello);
  socket.on("state", onState);
  socket.on("stroke:start", onStrokeStart);
  socket.on("stroke:segment", onStrokeSegment);
  socket.on("stroke:end", onStrokeEnd);
  socket.on("cursor", onCursor);
  socket.on("cursor:leave", onCursorLeave);
}
