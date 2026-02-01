export function createSocket(roomId) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  const path = '/socket.io';
  
  // Build full URL for explicit connection
  const url = `${protocol}://${host}`;
  
  const socketConfig = {
    url: url,
    query: { room: roomId },
    path: path,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
    rejectUnauthorized: false
  };
  
  console.log(`[SOCKET] Connecting to ${url}${path} with room: ${roomId}`);
  const socket = io(socketConfig);
  
  socket.on('connect', () => {
    console.log('[SOCKET] Connected:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    console.error('[SOCKET] Connection error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.warn('[SOCKET] Disconnected:', reason);
  });
  
  return socket;
}

export function registerSocketHandlers({
  socket,
  onHello,
  onState,
  onUserJoined,
  onUserLeft,
  onStrokeStart,
  onStrokeSegment,
  onStrokeEnd,
  onCursor,
  onCursorLeave
}) {
  socket.on("hello", (payload) => {
    console.log('[SOCKET] hello event:', payload);
    onHello(payload);
  });
  
  socket.on("state", (payload) => {
    console.log('[SOCKET] state event: strokes count =', payload.strokes?.length);
    onState(payload);
  });
  
  socket.on("user:joined", (payload) => {
    console.log('[SOCKET] user:joined:', payload);
    onUserJoined(payload);
  });
  
  socket.on("user:left", (payload) => {
    console.log('[SOCKET] user:left:', payload);
    onUserLeft(payload);
  });
  
  socket.on("stroke:start", (payload) => {
    console.log('[SOCKET] stroke:start:', payload.id);
    onStrokeStart(payload);
  });
  
  socket.on("stroke:segment", (payload) => {
    onStrokeSegment(payload);
  });
  
  socket.on("stroke:end", (payload) => {
    console.log('[SOCKET] stroke:end:', payload.id);
    onStrokeEnd(payload);
  });
  
  socket.on("cursor", (payload) => {
    onCursor(payload);
  });
  
  socket.on("cursor:leave", (payload) => {
    console.log('[SOCKET] cursor:leave:', payload);
    onCursorLeave(payload);
  });
  
  socket.on("error", (error) => {
    console.error('[SOCKET] error event:', error);
  });
}
