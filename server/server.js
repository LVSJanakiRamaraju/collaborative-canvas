const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
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

  socket.on("stroke:start", (payload) => {
    socket.broadcast.emit("stroke:start", {
      id: payload.id,
      userId: socket.id,
      style: payload.style,
      point: payload.point
    });
  });

  socket.on("stroke:segment", (payload) => {
    socket.broadcast.emit("stroke:segment", {
      id: payload.id,
      userId: socket.id,
      point: payload.point
    });
  });

  socket.on("stroke:end", (payload) => {
    socket.broadcast.emit("stroke:end", {
      id: payload.id,
      userId: socket.id
    });
  });

  socket.on("cursor", (payload) => {
    socket.broadcast.emit("cursor", {
      userId: socket.id,
      x: payload.x,
      y: payload.y
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("cursor:leave", { userId: socket.id });
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
