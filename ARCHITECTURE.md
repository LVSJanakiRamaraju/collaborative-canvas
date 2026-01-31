# Architecture

## Overview
The project is split into a browser client and a Node.js Socket.io server. The server owns the shared "truth" for completed strokes and broadcasts updates to all connected clients in a room. Clients render locally for immediate feedback and reconcile on server updates (especially on undo).

## Client
- [client/main.js](client/main.js) bootstraps the canvas, UI, and socket connection.
- [client/canvas.js](client/canvas.js) contains DOM-independent canvas helpers.
- [client/websocket.js](client/websocket.js) maps socket events to callbacks.

### Rendering Flow
1. User starts a stroke (pointer down).
2. The client immediately draws locally and emits `stroke:start`.
3. During movement, the client throttles emissions with `requestAnimationFrame`, draws locally, and emits `stroke:segment`.
4. On pointer up, the client emits `stroke:end`.

### Ghost Cursors
Each client emits its cursor position on move. Other clients render small colored circles on a transparent overlay canvas.

## Server
- [server/server.js](server/server.js) sets up Express + Socket.io and routes events.
- [server/state-manager.js](server/state-manager.js) stores completed strokes and supports undo.
- [server/rooms.js](server/rooms.js) isolates state per room.

### Undo Strategy
Undo removes the last stroke created by the requesting user from server history. The server then broadcasts a full `state` event so all clients redraw a clean canvas without race conditions.

## Data Shapes
- Stroke: `{ id, userId, style: { color, width }, points: [{ x, y }, ...] }`
- Events: `stroke:start`, `stroke:segment`, `stroke:end`, `cursor`, `state`, `undo`
