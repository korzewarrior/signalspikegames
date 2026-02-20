function toInt(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

export function createGameStorage(opts = {}){
  const {
    storageKey = "vexel-game-state-v1",
    version = 1,
    boardSize,
    totalPlayers,
    pieces,
    makePlayers,
    normalizePlayerModes = (modes, fallback) => Array.isArray(modes) ? modes : fallback,
    validStatusTones,
  } = opts;

  const pieceIds = new Set(pieces.map((piece) => piece.id));
  const pieceSizes = pieces.reduce((acc, piece) => {
    acc[piece.id] = piece.size;
    return acc;
  }, {});

  function pieceSizeById(id){
    return pieceSizes[id] || 0;
  }

  function sanitizeBoard(rawBoard){
    if (!Array.isArray(rawBoard) || rawBoard.length !== boardSize) return null;
    const nextBoard = [];
    for (const row of rawBoard){
      if (!Array.isArray(row) || row.length !== boardSize) return null;
      const nextRow = [];
      for (const cellValue of row){
        const v = toInt(cellValue, -1);
        if (v < -1 || v >= totalPlayers) return null;
        nextRow.push(v);
      }
      nextBoard.push(nextRow);
    }
    return nextBoard;
  }

  function sanitizeMoveHistory(rawMoves){
    if (!Array.isArray(rawMoves)) return [];
    const moves = [];
    for (const raw of rawMoves){
      if (!raw || typeof raw !== "object") continue;
      const player = toInt(raw.player, -1);
      const pieceId = typeof raw.pieceId === "string" ? raw.pieceId : "";
      if (player < 0 || player >= totalPlayers) continue;
      if (!pieceIds.has(pieceId)) continue;
      if (!Array.isArray(raw.placed)) continue;
      const seen = new Set();
      const placed = [];
      for (const rawCell of raw.placed){
        if (!rawCell || typeof rawCell !== "object") continue;
        const x = toInt(rawCell.x, Number.NaN);
        const y = toInt(rawCell.y, Number.NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) continue;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        placed.push({ x, y });
      }
      if (placed.length !== pieceSizeById(pieceId)) continue;
      moves.push({ player, pieceId, placed });
    }
    return moves;
  }

  function sanitizePlayers(rawPlayers){
    if (!Array.isArray(rawPlayers) || rawPlayers.length !== totalPlayers) return null;
    const nextPlayers = makePlayers(totalPlayers, 0);
    for (let i = 0; i < totalPlayers; i++){
      const raw = rawPlayers[i];
      if (!raw || typeof raw !== "object") return null;
      const rawUsed = Array.isArray(raw.used) ? raw.used : [];
      const used = new Set(rawUsed.filter((pieceId) => pieceIds.has(pieceId)));
      let placedCells = 0;
      for (const pieceId of used){
        placedCells += pieceSizeById(pieceId);
      }
      nextPlayers[i].used = used;
      nextPlayers[i].placedCells = placedCells;
      nextPlayers[i].hasPlayed = used.size > 0;
      nextPlayers[i].lastPieceSize = null;
      if (typeof raw.isBot === "boolean"){
        nextPlayers[i].isBot = raw.isBot;
      }
      if (typeof raw.isOff === "boolean"){
        nextPlayers[i].isOff = raw.isOff;
      } else {
        nextPlayers[i].isOff = false;
      }
    }
    return nextPlayers;
  }

  function save(snapshot){
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        version,
        ...snapshot,
      }));
    } catch (_) {}
  }

  function clear(){
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {}
  }

  function load(){
    let raw = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch (_) {
      return null;
    }
    if (!raw) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      clear();
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    if (toInt(parsed.version, -1) !== version) return null;

    const nextBoard = sanitizeBoard(parsed.board);
    const nextPlayers = sanitizePlayers(parsed.players);
    if (!nextBoard || !nextPlayers){
      clear();
      return null;
    }

    const fallbackPlayerModes = nextPlayers.map((p) => {
      if (p.isOff) return "off";
      return p.isBot ? "bot" : "human";
    });
    let rawModes = parsed.configuredPlayerModes;
    if (!Array.isArray(rawModes) && Array.isArray(parsed.configuredHumanMask)){
      rawModes = parsed.configuredHumanMask.map((isHuman) => isHuman ? "human" : "bot");
    }
    const nextConfiguredPlayerModes = normalizePlayerModes(rawModes, fallbackPlayerModes);
    for (let i = 0; i < totalPlayers; i++){
      const mode = nextConfiguredPlayerModes[i];
      nextPlayers[i].isOff = mode === "off";
      nextPlayers[i].isBot = mode === "bot";
    }

    const nextMoveHistory = sanitizeMoveHistory(parsed.moveHistory);
    const firstActiveIdx = (() => {
      const idx = nextPlayers.findIndex((p) => !p.isOff);
      return idx >= 0 ? idx : 0;
    })();
    let nextCurrent = clamp(toInt(parsed.current, firstActiveIdx), 0, totalPlayers - 1);
    if (nextPlayers[nextCurrent]?.isOff){
      nextCurrent = firstActiveIdx;
    }
    const nextRotation = ((toInt(parsed.rotation, 0) % 4) + 4) % 4;
    const nextFlipped = !!parsed.flipped;
    const activeCount = Math.max(1, nextPlayers.filter((p) => !p.isOff).length);
    const nextConsecutivePasses = clamp(toInt(parsed.consecutivePasses, 0), 0, activeCount);
    const nextStatusText = typeof parsed.statusText === "string" ? parsed.statusText : "";
    const nextStatusTone = validStatusTones.has(parsed.statusTone) ? parsed.statusTone : "neutral";
    const nextGameOver = parsed.gameOver === true || nextConsecutivePasses >= activeCount;

    let nextSelectedPieceId = null;
    if (typeof parsed.selectedPieceId === "string" && pieceIds.has(parsed.selectedPieceId)){
      if (!nextPlayers[nextCurrent].used.has(parsed.selectedPieceId)){
        nextSelectedPieceId = parsed.selectedPieceId;
      }
    }

    return {
      configuredPlayerModes: nextConfiguredPlayerModes,
      board: nextBoard,
      players: nextPlayers,
      current: nextCurrent,
      selectedPieceId: nextSelectedPieceId,
      rotation: nextRotation,
      flipped: nextFlipped,
      moveHistory: nextMoveHistory,
      consecutivePasses: nextConsecutivePasses,
      statusText: nextStatusText,
      statusTone: nextStatusTone,
      gameOver: nextGameOver,
    };
  }

  return {
    save,
    load,
    clear,
  };
}
