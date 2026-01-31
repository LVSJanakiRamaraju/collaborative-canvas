class StateManager {
  constructor() {
    this.strokes = [];
    this.inProgress = new Map();
  }

  startStroke({ id, userId, style, point }) {
    if (!id || !point) {
      return;
    }
    const stroke = {
      id,
      userId,
      style: {
        color: style?.color || "#111111",
        width: Number(style?.width || 4)
      },
      points: [point]
    };
    this.inProgress.set(id, stroke);
  }

  addPoint(id, point) {
    const stroke = this.inProgress.get(id);
    if (!stroke || !point) {
      return;
    }
    stroke.points.push(point);
  }

  endStroke(id) {
    const stroke = this.inProgress.get(id);
    if (!stroke) {
      return;
    }
    this.inProgress.delete(id);
    this.strokes.push(stroke);
  }

  getStrokes() {
    return this.strokes.slice();
  }

  undoLastByUser(userId) {
    for (let i = this.strokes.length - 1; i >= 0; i -= 1) {
      if (this.strokes[i].userId === userId) {
        this.strokes.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}

module.exports = { StateManager };
