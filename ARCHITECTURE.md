# Collaborative Canvas - Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow Diagram](#data-flow-diagram)
3. [WebSocket Protocol](#websocket-protocol)
4. [Canvas Rendering](#canvas-rendering)
5. [Undo/Redo Strategy](#undoredo-strategy)
6. [State Synchronization](#state-synchronization)
7. [Infinite Canvas Implementation](#infinite-canvas-implementation)
8. [Performance Decisions](#performance-decisions)
9. [Conflict Handling](#conflict-handling)

---

## System Overview

The Collaborative Canvas uses a **client-server architecture** with WebSocket communication:

```
┌─────────────────────────────────────┐
│      Browser Clients (Multiple)     │
│                                     │
│  ┌──────────────┐  ┌──────────────┐│
│  │   Client 1   │  │   Client 2   ││
│  │  Canvas API  │  │  Canvas API  ││
│  │ Socket.io    │  │ Socket.io    ││
│  └──────────────┘  └──────────────┘│
└────────────┬────────────────────────┘
             │ WebSocket
             │ (Bidirectional)
             ▼
┌──────────────────────────────────────┐
│      Node.js Backend Server          │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     Socket.io Server           │  │
│  │  - Event routing               │  │
│  │  - Room management             │  │
│  │  - CORS handling               │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   State Manager (Per-Room)     │  │
│  │  - Stroke history              │  │
│  │  - Undo/Redo stacks            │  │
│  │  - User tracking               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Key Principle**: The server owns the canonical drawing state. Clients draw locally for immediate feedback but verify with the server for truth.

---

## Data Flow Diagram

### Real-Time Drawing Synchronization

```
User A draws a stroke:

┌──────────────────────────────────────────────────────────┐
│ 1. LOCAL DRAWING (Immediate, no latency)                 │
└──────────────────────────────────────────────────────────┘

  Client A                         Server                  Clients B, C, D
  ────────                         ──────                  ──────────────
  
  User touches down
        │
        ├─► Draw locally          
        │   (Canvas.moveTo)
        │
        ├─► Emit "stroke:start"────►  Add to history
        │   { id, style, point }       in memory
        │                              
        │◄─── Broadcast "stroke:start" ─┬─► Update state
        │                                ├─► Queue redraw
        │                                ├─► Render on canvas
        │                                │   (now visible)
        │                                └─► Wait for more
  
  User moves (while down)
        │
        ├─► Draw locally          
        │   (Canvas.quadraticCurveTo)
        │
        ├─► Queue point           
        │   (Throttle: 50ms)
        │
        ├─► Emit "stroke:segment"──►  Add point to
        │   { id, point }             stroke.points
        │                              
        │◄─── Broadcast "stroke:segment"
        │                          (repeat for each point)
  
  User releases
        │
        ├─► Emit "stroke:end"─────►  Mark stroke 
        │   { id }                    complete
        │
        │◄─── Broadcast "stroke:end"
              (stroke now finalized)


┌──────────────────────────────────────────────────────────┐
│ 2. RESULT: ALL CLIENTS SEE THE SAME CANVAS              │
└──────────────────────────────────────────────────────────┘
```

---

## WebSocket Protocol

### Event Types

#### 1. **stroke:start** (Client → Server → All Clients)
```javascript
{
  type: "stroke:start",
  data: {
    id: "user-123-1612345678-abc",      // Unique stroke ID
    style: {
      color: "#ff0000",                 // Hex color
      width: 4,                         // Pixels (1-32)
      opacity: 100                      // Percentage (10-100)
    },
    point: {
      x: 150.5,                         // Canvas coordinates
      y: 200.3
    }
  }
}

// Server action: Creates new stroke in history
// Broadcast: All clients add stroke to their array
```

#### 2. **stroke:segment** (Client → Server → All Clients)
```javascript
{
  type: "stroke:segment",
  data: {
    id: "user-123-1612345678-abc",      // References existing stroke
    point: {
      x: 155.2,
      y: 205.8
    }
  }
}

// Server action: Appends point to stroke.points
// Broadcast: Clients draw segment on canvas
```

#### 3. **stroke:end** (Client → Server → All Clients)
```javascript
{
  type: "stroke:end",
  data: {
    id: "user-123-1612345678-abc"       // Finalizes stroke
  }
}

// Server action: Marks stroke as complete
// Broadcast: Confirms completion (UI feedback)
```

#### 4. **cursor** (Client → Server → All Except Sender)
```javascript
{
  type: "cursor",
  data: {
    x: 300.5,
    y: 150.2,
    userId: "user-123"                  // Implicit from socket
  }
}

// Broadcast: All clients except sender render ghost cursor
// Throttled: Maximum 20 updates/second (50ms minimum interval)
```

#### 5. **undo** (Client → Server → All Clients)
```javascript
{
  type: "undo",
  data: {}
}

// Server action: 
//   1. Find last stroke by requesting user
//   2. Remove from history
//   3. Broadcast full "state" event
// Result: ALL clients see full canvas redraw
```

#### 6. **redo** (Client → Server → All Clients)
```javascript
{
  type: "redo",
  data: {}
}

// Server action: Similar to undo but from redo stack
```

#### 7. **state** (Server → All Clients)
```javascript
{
  type: "state",
  data: {
    strokes: [
      {
        id: "user-1-timestamp-id",
        userId: "user-1",
        style: { color: "#ff0000", width: 4, opacity: 100 },
        points: [
          { x: 100, y: 100 },
          { x: 105, y: 105 },
          { x: 110, y: 110 }
          // ... more points
        ]
      },
      // ... more strokes
    ]
  }
}

// Sent when:
//   1. User joins (current canvas state)
//   2. After undo/redo (full sync)
//   3. On reconnection (sync missed events)
// Client action: Clear canvas, redraw all strokes
```

#### 8. **hello** (Server → Client)
```javascript
{
  type: "hello",
  data: {
    userId: "socket-id-xyz",
    usersInRoom: 3
  }
}

// Sent immediately after connection
// Client stores userId for stroke tracking
```

#### 9. **user:joined** (Server → All Clients)
```javascript
{
  type: "user:joined",
  data: {
    userId: "socket-id-xyz",
    totalUsers: 3
  }
}

// Updates user counter
```

#### 10. **user:left** (Server → All Clients)
```javascript
{
  type: "user:left",
  data: {
    userId: "socket-id-xyz",
    totalUsers: 2
  }
}

// Clean up ghost cursor, update counter
```

### Socket.io Configuration

```javascript
// Client
const socketConfig = {
  query: { room: roomId },              // Room for isolation
  path: '/socket.io',                   // Standard Socket.io path
  reconnection: true,                   // Auto-reconnect
  reconnectionDelay: 1000,              // 1s initial delay
  reconnectionDelayMax: 5000,           // Max 5s delay
  reconnectionAttempts: Infinity,       // Keep trying
  transports: ['websocket', 'polling']  // WebSocket + fallback
};

// Server (CORS)
{
  cors: {
    origin: (origin, callback) => {
      // Whitelist: localhost, Vercel, Render, Railway
      const allowed = [
        'http://localhost:3000',
        'https://collaborative-canvas-ochre.vercel.app',
        'https://collaborative-canvas-ti8v.onrender.com'
      ];
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,                  // 25s between pings
  pingTimeout: 20000                    // 20s timeout
}
```

---

## Canvas Rendering

### 1. **Smooth Curve Rendering** (Quadratic Bézier)

When drawing, we don't send every mouse move event. Instead:
- **Collect points** at ~60Hz (requestAnimationFrame)
- **Draw locally** using quadratic Bézier curves
- **Send sparse points** to server (throttled to 50ms)

```javascript
// Receiving points: p0, p1, p2, ...
// Draw curve from p0 through p1 to midpoint(p1, p2)

const p0 = points[i - 1];     // Previous point
const p1 = points[i];          // Current point
const p2 = points[i + 1];      // Next point

const xc = (p1.x + p2.x) / 2;  // Control point
const yc = (p1.y + p2.y) / 2;

ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
```

**Why?** Creates smooth, natural-looking curves with fewer data points.

### 2. **Viewport Transform** (Infinite Canvas)

For pan and zoom, we use canvas transforms:

```javascript
// Store viewport state
let viewport = {
  offsetX: 0,    // Pan X
  offsetY: 0,    // Pan Y
  scale: 1       // Zoom level (0.1 - 5)
};

// Apply transforms before drawing
function applyTransform(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);      // Reset
  ctx.scale(DPR, DPR);                      // Device pixel ratio
  ctx.translate(viewport.offsetX, 
                viewport.offsetY);          // Pan
  ctx.scale(viewport.scale, 
            viewport.scale);                 // Zoom
}

// When rendering:
// 1. Apply transform
// 2. Draw all strokes (they auto-adjust)
// 3. Restore context
```

### 3. **Full Redraw Strategy**

Instead of maintaining dirty regions, we redraw everything:

```javascript
export function redrawAll(ctx, canvas, strokes) {
  clearCanvas(ctx, canvas);           // Clear all
  
  strokes.forEach((stroke) => {
    // Draw each stroke
    ctx.globalAlpha = stroke.style.opacity / 100;
    ctx.strokeStyle = stroke.style.color;
    ctx.lineWidth = stroke.style.width;
    
    // Draw using quadratic curves
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (p[i].x + p[i+1].x) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
    }
  });
}
```

**Why?** Simpler logic, fewer bugs. Modern browsers optimize this well.

---

## Undo/Redo Strategy

### The Problem
"Global Undo" means User A can undo **User B's** strokes. This is hard because:
- Each user has local undo/redo stacks
- We need server to track who drew what
- Undo must broadcast to ALL users
- User B might be drawing while User A undoes

### The Solution

**Per-Room State Manager**:

```javascript
class StateManager {
  constructor() {
    this.strokes = [];           // Current canvas state
    this.undoStack = [];         // Removed strokes
    this.redoStack = [];         // Redo stack
    this.userStrokeMap = {};     // Track user → stroke IDs
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
    this.userStrokeMap[stroke.userId] = stroke.id;
    this.undoStack = [];         // Clear redo on new action
  }

  undo() {
    if (this.strokes.length > 0) {
      // Remove LAST stroke (not user's last)
      const removedStroke = this.strokes.pop();
      this.undoStack.push(removedStroke);
      
      // Broadcast full state to all clients
      // This prevents race conditions
      return this.getState();
    }
  }

  redo() {
    if (this.undoStack.length > 0) {
      const restoredStroke = this.undoStack.pop();
      this.strokes.push(restoredStroke);
      return this.getState();
    }
  }

  getState() {
    return { strokes: this.strokes };
  }
}
```

### Undo Flow

```
Server                          Client A              Client B
──────                          ────────              ────────

[Stroke 1: A]
[Stroke 2: B]
[Stroke 3: A]  ◄─── undo ───────────────

Pop Stroke 3
              ┌─► Broadcast ──────────►  Clear canvas
              │   full state             Redraw [Stroke 1, 2]
              │                          User sees B's work undone
              │                          (but B didn't undo!)
              │
         Return to A  ────────────────►  User A sees undo worked
                                         Both canvases now identical
```

### Why Broadcast Full State?

1. **Prevents race conditions** - No "which stroke is deleted?" confusion
2. **Synchronizes all users** - Everyone sees exact same result
3. **Simple to implement** - No complex merge logic needed
4. **Clients already can handle it** - They can redraw on reconnect

---

## State Synchronization

### On Client Connection

```
New Client joins:

Socket.io Server
├─ Generate socket ID
├─ Add to room
├─ Send "hello" event ──────────► Client
├─ Broadcast "user:joined" ────► All Clients
└─ Send full "state" event ────► New Client
    (all current strokes)
    
Client receives "state":
├─ Parse stroke data
├─ Clear canvas
├─ Call redrawAll()
└─ Display latest canvas state
```

### On Stroke Creation

```
User A draws:

Local: Canvas.moveTo/lineTo    (60 FPS, no latency)
         ↓
Emit: "stroke:start"            (→ Server)
         ↓
Server: Add to strokes[]        
         ↓
Broadcast: "stroke:start"       (→ All Clients)
         ↓
Clients B, C, D: Add to strokes[], start rendering
         ↓
[Repeat for "stroke:segment" events]
         ↓
User A releases:
         ↓
Emit: "stroke:end"              (→ Server)
         ↓
Broadcast: "stroke:end"         (→ All Clients)
         ↓
Stroke finalized, safe to undo
```

### On Reconnection

```
Client disconnects (poor network):
├─ Socket.io auto-detects
├─ Starts exponential backoff (1s, 2s, 4s, etc.)
└─ Keeps trying

Client reconnects:
├─ Socket.io establishes new connection
├─ Server sends "state" event (full canvas)
├─ Client redraws
└─ Continues drawing

Note: Any strokes from server during disconnect
      are already in "state" broadcast
```

---

## Infinite Canvas Implementation

### Pan System

```javascript
// Tracking pan
let panStart = null;

// On Shift + Drag or middle-click:
canvas.onpointerdown = (e) => {
  if (e.shiftKey || e.button === 1) {
    panStart = { x: e.clientX, y: e.clientY };
  }
};

// During drag:
canvas.onpointermove = (e) => {
  if (panStart) {
    const dx = (e.clientX - panStart.x) / viewport.scale;
    const dy = (e.clientY - panStart.y) / viewport.scale;
    
    viewport.offsetX += dx;
    viewport.offsetY += dy;
    
    panStart = { x: e.clientX, y: e.clientY };
    redraw();  // Re-render with new offset
  }
};
```

### Zoom System

```javascript
// Mouse wheel to zoom
canvas.onwheel = (e) => {
  e.preventDefault();
  
  const oldScale = viewport.scale;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  viewport.scale = Math.min(Math.max(oldScale * delta, 0.1), 5);
  
  // Smooth zoom: viewport stays centered
  redraw();
};
```

### Coordinate Transformation

When user clicks on canvas, we need to convert screen coordinates → canvas coordinates:

```javascript
function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX - rect.left;
  const clientY = event.clientY - rect.top;
  
  // Reverse the transform:
  // Screen → Logical Canvas
  const x = (clientX / viewport.scale) - viewport.offsetX;
  const y = (clientY / viewport.scale) - viewport.offsetY;
  
  return { x, y };
}

// Drawing happens in "logical" coordinates
// Viewport transform applies automatically when rendering
```

---

## Performance Decisions

### 1. **Cursor Throttling** (50ms)

```javascript
const CURSOR_THROTTLE_MS = 50;
let lastCursorEmitTime = 0;

// Only emit cursor if 50ms passed
if (Date.now() - lastCursorEmitTime > CURSOR_THROTTLE_MS) {
  socket.emit("cursor", point);
  lastCursorEmitTime = Date.now();
}
```

**Why?** Mouse move fires 100+ times per second. Sending every event would:
- Flood the network
- Delay more important drawing events
- Waste CPU on the server

**Result:** Still smooth ghost cursors, ~90% fewer network events.

### 2. **Request Animation Frame for Drawing**

```javascript
let rafId = null;
let queuedPoint = null;

canvas.onpointermove = () => {
  queuedPoint = getCanvasCoordinates(event);
  
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = null;
      // Process only latest point
      drawStroke(queuedPoint);
      socket.emit("stroke:segment", queuedPoint);
    });
  }
};
```

**Why?** Browser limits requestAnimationFrame to screen refresh rate (60Hz).
- Filters out redundant mouse events
- Reduces strain on event handler
- Synchronizes drawing with monitor refresh

### 3. **Quadratic Curve Interpolation**

Instead of sending every point (200+ per second when drawing fast):

```javascript
// Client sends: point1, point3, point5, ... (sparse)
// Client renders locally: smooth curves through all points
// Server receives: sparse points
// Server broadcasts to others: sparse points
// Others receive and render: smooth curves

// Network data: ~1/3 the size
// Visual quality: Nearly identical to sending every point
```

### 4. **Deep Copy on State Sync**

```javascript
// On reconnect or undo, parse strokes deeply:
const newStrokes = JSON.parse(JSON.stringify(oldStrokes));

// Why? Prevents mutation bugs:
// - Client modifies stroke while rendering
// - Server might modify same array
// - Causes unpredictable behavior

// Deep copy is expensive but:
// - Only done on undo (infrequent)
// - Not on every draw
```

---

## Conflict Handling

### Simultaneous Drawing

When users draw on overlapping areas:

```
User A at (100, 100)
User B at (100, 100) at same time

Server receives:
├─ stroke:segment from A
├─ stroke:segment from B
└─ Both are different strokes (different stroke.id)

Stored as:
├─ Stroke A: [...points from A...]
└─ Stroke B: [...points from B...]

Rendered as:
├─ A drawn in color 1
├─ B drawn in color 2
└─ Where they overlap, B is on top (drawn last)
```

**No "conflict"** - Both strokes are independent.

### Simultaneous Undo

```
User A undoes
User B undoes (same server frame)

Server receives:
├─ undo from A (removes last stroke)
├─ undo from B (removes previous last stroke)

Result:
├─ Top 2 strokes removed
├─ Full state broadcast to all
└─ Everyone sees same result
```

### Eraser on Top of Others

```
User A draws stroke 1 (red)
User B draws stroke 2 (blue)
User A erases with width × 3

Rendering:
├─ Draw stroke 1 (red)
├─ Draw stroke 2 (blue)  
├─ Draw eraser strokes (background color)
└─ Result: Erased area shows background, not blend
```

Note: **This is not true alpha erasing.** It's just drawing the background color. True alpha would require:
- Rendering to offscreen buffer
- Complex compositing
- More GPU work

Current approach is simpler and sufficient for this app.

---

## Technical Trade-offs

| Decision | Chosen | Reason |
|----------|--------|--------|
| Full redraw vs dirty regions | Full redraw | Simpler, fast enough, easier to debug |
| Broadcast full state vs delta sync | Full state on undo | Prevents race conditions, simpler code |
| Store all points vs compressed strokes | All points | Needed for smooth curves, memory acceptable |
| Cursor throttle: 50ms vs 100ms | 50ms | Good balance: network vs smoothness |
| Transport: WebSocket vs polling | Both (fallback) | WebSocket for speed, polling for compatibility |
| Rooms: Server-side vs client-side | Server-side | More secure, prevents cross-room pollution |

---

## Error Handling

### Network Failure
```javascript
socket.on('disconnect', () => {
  console.warn('Disconnected');
  startReconnecting();
  updateUI('Reconnecting...');
});

socket.on('reconnect', () => {
  console.log('Reconnected');
  requestFullState();  // Get fresh state
  updateUI('Connected');
});
```

### Invalid Data
```javascript
// Server validates all incoming messages
socket.on('stroke:segment', (data) => {
  if (!data.id || !data.point) {
    console.warn('Invalid segment data');
    return;  // Ignore invalid
  }
  
  const stroke = strokes.find(s => s.id === data.id);
  if (!stroke) {
    console.warn('Stroke not found');
    return;  // Ignore orphaned segments
  }
  
  // Process valid segment
});
```

---

## Conclusion

The Collaborative Canvas architecture prioritizes:
1. **Simplicity** - Full redraws, no dirty regions
2. **Correctness** - Server owns truth, full state on critical ops
3. **Performance** - Throttling, RAF, quadratic interpolation
4. **Reliability** - Auto-reconnection, deep copy, validation

This makes it easy to understand, debug, and maintain while delivering smooth real-time experience for multiple simultaneous users.
