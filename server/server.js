const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { getRoom } = require("./rooms");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  const roomId = (socket.handshake.query.room || "lobby").toString();
  const room = getRoom(roomId);
  socket.join(roomId);

  socket.emit("hello", { userId: socket.id, roomId });
  socket.emit("state", { strokes: room.state.getStrokes() });

  socket.on("stroke:start", (payload) => {
    room.state.startStroke({
      id: payload.id,
      userId: socket.id,
      style: payload.style,
      point: payload.point
    });
    socket.to(roomId).emit("stroke:start", {
      id: payload.id,
      userId: socket.id,
      style: payload.style,
      point: payload.point
    });
  });

  socket.on("stroke:segment", (payload) => {
    room.state.addPoint(payload.id, payload.point);
    socket.to(roomId).emit("stroke:segment", {
      id: payload.id,
      userId: socket.id,
      point: payload.point
    });
  });

  socket.on("stroke:end", (payload) => {
    room.state.endStroke(payload.id);
    socket.to(roomId).emit("stroke:end", {
      id: payload.id,
      userId: socket.id
    });
  });

  socket.on("cursor", (payload) => {
    socket.to(roomId).emit("cursor", {
      userId: socket.id,
      x: payload.x,
      y: payload.y
    });
  });

  socket.on("undo", () => {
    room.state.undoLastByUser(socket.id);
    io.to(roomId).emit("state", { strokes: room.state.getStrokes() });
  });

  socket.on("redo", () => {
    room.state.redoLastByUser(socket.id);
    io.to(roomId).emit("state", { strokes: room.state.getStrokes() });
  });

  socket.on("disconnect", () => {
    socket.to(roomId).emit("cursor:leave", { userId: socket.id });
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
