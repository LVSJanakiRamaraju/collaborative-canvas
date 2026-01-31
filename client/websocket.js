export function createSocket(roomId) {
  return io({
    query: { room: roomId }
  });
}
