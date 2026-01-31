const { StateManager } = require("./state-manager");

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      state: new StateManager()
    });
  }
  return rooms.get(roomId);
}

module.exports = { getRoom };
