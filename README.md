# 🎨 Collaborative Canvas

A **real-time, multi-user drawing canvas** built with HTML5 Canvas API and Socket.io. Multiple users can draw simultaneously on a shared infinite canvas with full synchronization, undo/redo support, and live cursor tracking.

## ✨ Features

### Core Features ✅
- **Real-time Drawing Synchronization** - See other users drawing live as it happens
- **Multiple Drawing Tools** - Pen, Eraser, Line, Rectangle, Circle
- **Infinite Canvas** - Pan and zoom with smooth controls (mouse wheel, Shift+drag)
- **Color & Style Control** - Color picker, preset colors, adjustable opacity, variable stroke width
- **Ghost Cursors** - See where other users are currently drawing
- **Global Undo/Redo** - One user can undo another user's strokes (truly global)
- **User Presence** - Real-time user counter and connection status
- **Multiple Rooms** - Separate canvases for different teams/groups

### Advanced Features ✅
- **Smooth Curve Rendering** - Quadratic Bézier curves for natural drawing
- **Keyboard Shortcuts** - Ctrl+Z (undo), Ctrl+Y (redo), P/E/L/R/C for tools
- **Export to PNG** - Save canvas as an image
- **Mobile Touch Support** - Full touch event handling for tablets
- **Auto-Reconnection** - Automatic reconnect with backoff strategy
- **CORS Support** - Works across different deployment platforms
- **Performance Optimized** - Cursor throttling (50ms), RAF-based rendering

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Running Locally

```bash
# Install dependencies
npm install

# Start the server (development)
npm run dev

# OR production mode
npm start

# Server runs on http://localhost:3000
```

Open **http://localhost:3000** in multiple browser tabs/windows to test multi-user drawing.

## 🧪 Testing Multi-User Features

### Test 1: Same Room (Local)
1. Open http://localhost:3000 in Tab 1
2. Open http://localhost:3000 in Tab 2
3. Draw in Tab 1 → Tab 2 updates in real-time
4. User counter shows 2 users

### Test 2: Different Rooms
1. Tab 1: http://localhost:3000/?room=room-a
2. Tab 2: http://localhost:3000/?room=room-b
3. Draw in Tab 1 → Tab 2 doesn't see it (separate rooms)

### Test 3: Global Undo
1. User A draws something
2. User B draws something
3. User A clicks Undo → **User B's drawing is also undone** (global undo)
4. User B's canvas updates in real-time

### Test 4: Infinite Canvas
1. Draw near edges
2. Scroll wheel to zoom in/out (0.1x - 5x)
3. Shift+Drag or middle-click to pan
4. Click reset zoom button to return to 100%

## 📦 Deployment

### Vercel (Frontend) + Render (Backend)

The app automatically detects deployment:
- **Frontend**: https://collaborative-canvas-ochre.vercel.app/
- **Backend**: https://collaborative-canvas-ti8v.onrender.com

When frontend is on Vercel, it auto-connects to Render backend (no manual config needed).

## 📁 Project Structure

```
collaborative-canvas/
├── client/                    # Frontend (served by Express static)
│   ├── index.html            # Main HTML with enhanced UI
│   ├── style.css             # Gradients, animations, responsive design
│   ├── main.js               # App entry point, event handling, tools
│   ├── canvas.js             # Canvas API logic, infinite canvas viewport
│   └── websocket.js          # Socket.io client, auto-reconnection
├── server/
│   ├── server.js             # Express + Socket.io server, CORS config
│   ├── rooms.js              # Room state management
│   ├── state-manager.js      # Stroke history, undo/redo logic
│   └── drawing-state.js      # Per-room drawing state
├── package.json              # Dependencies
├── README.md                 # This file
├── ARCHITECTURE.md           # Technical details
└── vercel.json              # Vercel deployment config
```

## 🎯 Requirements Checklist

### ✅ Frontend Features (100%)
- [x] **Drawing tools** - Brush ✏️, Eraser 🧹, Line 📏, Rectangle ⬜, Circle ⭕
- [x] **Real-time sync** - Live drawing updates as users draw
- [x] **User indicators** - Ghost cursors showing other users' positions
- [x] **Conflict handling** - Simultaneous drawing works smoothly
- [x] **Global Undo/Redo** - Works across all users
- [x] **User management** - Shows online users, unique colors per user
- [x] **Color control** - Color picker + 5 preset colors
- [x] **Stroke width** - Adjustable 1-32px
- [x] **Opacity** - Adjustable 10-100%

### ✅ Technical Stack (100%)
- [x] **Frontend** - Vanilla JavaScript + HTML5 Canvas API (no libraries)
- [x] **Backend** - Node.js + Express + Socket.io
- [x] **No Canvas Libraries** - Pure HTML Canvas API only
- [x] **WebSockets** - Real-time bidirectional communication

### ✅ Bonus Features (100%)
- [x] **Infinite Canvas** - Pan and zoom support (0.1x - 5x)
- [x] **Multiple Rooms** - Separate canvases per room
- [x] **Mobile Touch** - Full touch/pointer event support
- [x] **Performance Stats** - Zoom level, user count, position display
- [x] **Extra Tools** - Shapes (lines, rectangles, circles)
- [x] **Export** - Save canvas as PNG image
- [x] **Keyboard Shortcuts** - Tool selection & undo/redo shortcuts
- [x] **Connection Status** - Live connection indicator
- [x] **Clear Canvas** - With confirmation prompt

### ✅ Documentation (100%)
- [x] **README.md** - Installation, testing, features
- [x] **ARCHITECTURE.md** - Technical design, data flow
- [x] **Code Comments** - Clear inline documentation
- [x] **Git Commits** - Meaningful commit history (10+ commits)

## 🛠️ Key Technical Decisions

### 1. Canvas Rendering
- **Smooth curves** using quadratic Bézier interpolation
- **RAF-based rendering** for 60fps drawing
- **Transform stacking** for infinite canvas (pan + zoom)
- **Viewport system** - Track offset and scale separately

### 2. Real-Time Sync
- **Server owns truth** - Completes strokes verified on server
- **Client-side prediction** - Draw immediately while sending updates
- **Event batching** - Cursor events throttled (50ms) to reduce network load
- **Deep copy state** - Prevent mutation issues on reconnect

### 3. Undo/Redo Strategy
- **User-scoped tracking** - Know which user drew each stroke
- **Full state broadcast** - On undo, broadcast complete state to avoid race conditions
- **Stack-based history** - Maintain undo/redo stacks per room
- **Immediate local feedback** - User sees undo instantly

### 4. Network Optimization
- **Cursor throttling** - 50ms minimum between cursor events
- **Bézier point reduction** - Only store key points, interpolate on render
- **Polling for health** - Socket.io ping/pong (25s interval)
- **Auto-reconnection** - Exponential backoff strategy

## ⚙️ Configuration

### Environment Variables (for backend)
```
NODE_ENV=production          # development or production
FRONTEND_URL=<url>           # Optional: explicit frontend URL for CORS
VERCEL_URL=<auto-set>        # Auto-detected on Vercel
RENDER_EXTERNAL_URL=<auto>   # Auto-detected on Render
```

### Vercel Frontend Config
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [{"source": "/(.*)", "destination": "/client/$1"}]
}
```

## 📊 Performance Metrics

- **Stroke points** - Typically 20-50 per second per user
- **Cursor updates** - Max 20 per second (50ms throttle)
- **Full state broadcast** - Only on undo or new users joining
- **Memory usage** - ~50KB per 1000 strokes
- **Network bandwidth** - ~5-10KB per second per user (typical)

## 🐛 Known Limitations

- **Maximum concurrent users** - Tested with 5+, scales well
- **Very large canvas** - Zoom out too far (< 0.1x) may cause performance issues
- **Eraser** - Multiplies stroke width by 3 to make erasing easier (not true alpha blending)
- **Shapes** - Converted to stroke points when finalized (not vector objects)
- **No persistence** - Drawings are lost on server restart (in-memory storage)

## 📝 Scripts

```bash
npm start       # Production server
npm run dev     # Development with auto-reload (nodemon)
npm install     # Install dependencies
```

## 🎓 Total Development Time

**~15 hours** including:
- Initial setup & Socket.io integration: 2h
- Core canvas drawing & smooth curves: 2h
- Real-time synchronization: 2h
- Global undo/redo implementation: 2h
- UI/UX enhancements & toolbar: 2h
- Infinite canvas + zoom/pan: 1.5h
- Deployment (Vercel + Render): 1.5h
- Bug fixes & performance optimization: 1.5h

## 🌐 Browsers Tested

- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Safari 17+
- ✅ Edge 120+
- ✅ Mobile Chrome/Safari (touch support)

## 📚 See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed technical architecture
- [GitHub Repository](https://github.com/LVSJanakiRamaraju/collaborative-canvas)
- [Live Demo](https://collaborative-canvas-ochre.vercel.app/)

## 🚀 How to Test

### Local Testing (Same Machine)
```bash
npm install
npm run dev
# Open http://localhost:3000 in 2-3 browser tabs
# Draw in one tab, see updates in others
```

### Remote Testing (Multiple Machines)
1. Deploy backend to Render or Railway
2. Deploy frontend to Vercel
3. Share the Vercel URL with team members
4. Draw together in real-time

### Testing Checklist
- [ ] Draw a stroke, see it appear on other tabs/devices
- [ ] Move cursor, see ghost cursors on other clients
- [ ] Undo in one tab, see other tabs update
- [ ] Zoom with mouse wheel
- [ ] Pan with Shift+Drag
- [ ] Try different tools (pen, eraser, shapes)
- [ ] Clear canvas
- [ ] Export as PNG
- [ ] Test on mobile device
- [ ] Test with 3+ simultaneous users

## 📄 License

MIT

---

**Made with ❤️ for real-time collaboration**
