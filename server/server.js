const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { getRoom } = require("./rooms");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:3000",
  "https://collaborative-canvas-ochre.vercel.app",
  "https://collaborative-canvas-ochre.vercel.app/"
];

// Add deployment URLs from environment variables
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  allowedOrigins.push(`http://${process.env.VERCEL_URL}`);
  console.log("Vercel URL detected:", process.env.VERCEL_URL);
}
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  console.log("Railway domain detected:", process.env.RAILWAY_PUBLIC_DOMAIN);
}
if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
  console.log("Render URL detected:", process.env.RENDER_EXTERNAL_URL);
}

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  console.log("Frontend URL detected:", process.env.FRONTEND_URL);
}

// For development or if running behind a proxy
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*');
}

console.log("[SERVER] Allowed origins:", allowedOrigins);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      console.log("CORS check for origin:", origin);
      if (!origin) {
        callback(null, true);
        return;
      }
      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.some(allowed => {
        const cleanAllowed = allowed.replace(/\/$/, '');
        return cleanOrigin === cleanAllowed || cleanOrigin.includes(cleanAllowed);
      });
      
      if (isAllowed || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6
});

const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  const roomId = (socket.handshake.query.room || "lobby").toString();
  const room = getRoom(roomId);
  socket.join(roomId);

  // Send initial state to new user
  socket.emit("hello", { userId: socket.id, roomId });
  socket.emit("state", { strokes: room.state.getStrokes() });

  // Notify other users of new connection
  socket.to(roomId).emit("user:joined", { userId: socket.id });

  socket.on("stroke:start", (payload) => {
    if (!payload || !payload.id || !payload.point) {
      console.warn("Invalid stroke:start payload", payload);
      return;
    }
    room.state.startStroke({
      id: payload.id,
      userId: socket.id,
      style: payload.style || { color: "#111111", width: 4 },
      point: payload.point
    });
    socket.to(roomId).emit("stroke:start", {
      id: payload.id,
      userId: socket.id,
      style: payload.style || { color: "#111111", width: 4 },
      point: payload.point
    });
  });

  socket.on("stroke:segment", (payload) => {
    if (!payload || !payload.id || !payload.point) {
      return;
    }
    room.state.addPoint(payload.id, payload.point);
    socket.to(roomId).emit("stroke:segment", {
      id: payload.id,
      userId: socket.id,
      point: payload.point
    });
  });

  socket.on("stroke:end", (payload) => {
    if (!payload || !payload.id) {
      return;
    }
    room.state.endStroke(payload.id);
    socket.to(roomId).emit("stroke:end", {
      id: payload.id,
      userId: socket.id
    });
  });

  socket.on("cursor", (payload) => {
    if (!payload || typeof payload.x !== "number" || typeof payload.y !== "number") {
      return;
    }
    socket.to(roomId).emit("cursor", {
      userId: socket.id,
      x: payload.x,
      y: payload.y
    });
  });

  socket.on("undo", () => {
    if (room.state.undoLastByUser(socket.id)) {
      io.to(roomId).emit("state", { strokes: room.state.getStrokes() });
    }
  });

  socket.on("redo", () => {
    if (room.state.redoLastByUser(socket.id)) {
      io.to(roomId).emit("state", { strokes: room.state.getStrokes() });
    }
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id} (${reason})`);
    socket.to(roomId).emit("cursor:leave", { userId: socket.id });
    socket.to(roomId).emit("user:left", { userId: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
