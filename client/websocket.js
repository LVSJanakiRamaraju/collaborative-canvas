function resolveBackendUrl() {
  const params = new URLSearchParams(window.location.search);
  const backendParam = params.get('backend');
  if (backendParam) {
    localStorage.setItem('backendUrl', backendParam);
    return backendParam;
  }

  const stored = localStorage.getItem('backendUrl');
  if (stored) {
    return stored;
  }

  if (window.__BACKEND_URL__) {
    return window.__BACKEND_URL__;
  }

  if (window.location.host.includes('vercel.app')) {
    return 'https://collaborative-canvas-ti8v.onrender.com';
  }

  return window.location.origin;
}

export function createSocket(roomId) {
  const path = '/socket.io';
  const backendUrl = resolveBackendUrl();

  const socketConfig = {
    query: { room: roomId },
    path,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling']
  };

  console.log(`[SOCKET] Connecting to ${backendUrl}${path} with room: ${roomId}`);
  const socket = io(backendUrl, socketConfig);
  
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
