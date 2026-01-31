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

## Scripts
- `npm run start` - production server
- `npm run dev` - auto-reload with nodemon

## Project Structure
See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.
