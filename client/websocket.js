export function createSocket(roomId) {
  return io({
    query: { room: roomId }
  });
}

export function registerSocketHandlers({
  socket,
  onStrokeStart,
  onStrokeSegment,
  onStrokeEnd
}) {
  socket.on("stroke:start", onStrokeStart);
  socket.on("stroke:segment", onStrokeSegment);
  socket.on("stroke:end", onStrokeEnd);
}
