# Collaborative Canvas

A real-time, multi-user drawing canvas using HTML5 Canvas and Socket.io.

## Requirements
- Node.js 18+

## Setup
1. Install dependencies:
   - `npm install`
2. Start the server:
   - `npm run start`
3. Open `http://localhost:3000` in two browser windows.
4. Optional: Use rooms by opening `http://localhost:3000/?room=team-alpha`.

## Features
- Smooth drawing with `requestAnimationFrame`
- Real-time synchronization across clients
- Ghost cursors for active users
- Undo for the current user's last stroke

## Using a Separate Backend (Production)
If your frontend is hosted on Vercel and the backend is hosted elsewhere (Railway/Render),
open the frontend with a `backend` query param:

```
https://your-frontend.vercel.app/?backend=https://your-backend.railway.app
```

This URL is saved in localStorage for future visits.

## Scripts
- `npm run start` - production server
- `npm run dev` - auto-reload with nodemon

## Project Structure
See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.
