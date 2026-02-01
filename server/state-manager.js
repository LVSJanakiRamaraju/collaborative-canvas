class StateManager {
  constructor() {
    this.strokes = [];
    this.inProgress = new Map();
    this.undoStack = [];
  }

  startStroke({ id, userId, style, point, type, start, end }) {
    if (!id || !point) {
      return;
    }
    const stroke = {
      id,
      userId,
      style: {
        color: style?.color || "#111111",
        width: Number(style?.width || 4),
        opacity: Number(style?.opacity || 100)
      },
      points: [point]
    };
    if (type) {
      stroke.type = type;
      stroke.start = start;
      stroke.end = end;
    }
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
    this.undoStack = [];
  }

  getStrokes() {
    // Return a deep copy to preserve all properties including shape metadata
    return JSON.parse(JSON.stringify(this.strokes));
  }

  undoLastByUser(userId) {
    for (let i = this.strokes.length - 1; i >= 0; i -= 1) {
      if (this.strokes[i].userId === userId) {
        const undoneStroke = this.strokes.splice(i, 1)[0];
        this.undoStack.push(undoneStroke);
        return true;
      }
    }
    return false;
  }

  redoLastByUser(userId) {
    for (let i = this.undoStack.length - 1; i >= 0; i -= 1) {
      if (this.undoStack[i].userId === userId) {
        const redoneStroke = this.undoStack.splice(i, 1)[0];
        this.strokes.push(redoneStroke);
        return true;
      }
    }
    return false;
  }
}

module.exports = { StateManager };
