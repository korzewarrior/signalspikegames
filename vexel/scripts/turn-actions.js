export function createTurnActions(deps = {}){
  const {
    getPlayers = () => [],
    getBoard = () => [],
    getCurrent = () => 0,
    setCurrent = () => {},
    getMoveHistory = () => [],
    getConsecutivePasses = () => 0,
    setConsecutivePasses = () => {},
    getPiece = () => null,
    inBounds = () => false,
    findBestBotMove = () => null,
    playerHasAnyMove = () => false,
    addPlacementBursts = () => {},
    pulseClass = () => {},
    stageFrameEl = null,
    toast = () => {},
    playSfx = () => {},
    rebuildPieceGrid = () => {},
    rebuildScoreboard = () => {},
    syncTurnControls = () => {},
    scheduleBotTurn = () => {},
    clearBotTurnTimer = () => {},
    setStatus = () => {},
    keyHint = () => "",
    playerLabel = () => "",
    resetSelection = () => {},
    endGame = () => {},
    saveGameState = () => {},
    isBlockingModalOpen = () => false,
    setUndoDisabled = () => {},
  } = deps;
  const CLOCKWISE_TURN_ORDER = [0, 3, 1, 2];

  function applyPlacement(pIdx, pieceId, pieceCells, anchorX, anchorY){
    const players = getPlayers();
    const board = getBoard();
    const p = players[pIdx];
    const piece = getPiece(pieceId);
    if (!p || p.isOff || !piece) return false;

    const placed = [];
    for (const c of pieceCells){
      const x = anchorX + c.x;
      const y = anchorY + c.y;
      if (!inBounds(x, y) || board[y][x] !== -1) return false;
      board[y][x] = p.idx;
      placed.push({ x, y });
    }

    p.used.add(piece.id);
    p.hasPlayed = true;
    p.placedCells += piece.size;
    p.lastPieceSize = piece.size;

    getMoveHistory().push({ player:p.idx, pieceId:piece.id, placed });
    setConsecutivePasses(0);

    resetSelection();
    addPlacementBursts(placed, p.color);
    pulseClass(stageFrameEl, "place-pop", 260);

    toast(`${playerLabel(p)} placed ${piece.id}.`, "good");
    playSfx("place");
    rebuildPieceGrid();
    rebuildScoreboard();
    advanceTurn();
    return true;
  }

  function executeBotTurn(){
    if (isBlockingModalOpen()) return;

    const players = getPlayers();
    const current = getCurrent();
    const p = players[current];
    if (!p || p.isOff || !p.isBot) return;

    const move = findBestBotMove(p.idx);
    if (!move){
      passTurn({ byBot:true });
      return;
    }

    const placed = applyPlacement(p.idx, move.pieceId, move.cells, move.anchorX, move.anchorY);
    if (!placed){
      passTurn({ byBot:true });
    }
  }

  function advanceTurn(){
    const players = getPlayers();

    // Rotate in board-clockwise corner order:
    // top-left(0) -> top-right(3) -> bottom-right(1) -> bottom-left(2).
    const order = CLOCKWISE_TURN_ORDER.filter(
      (idx) => idx >= 0 && idx < players.length && !players[idx]?.isOff
    );
    if (order.length === 0) return;
    const start = (!players[getCurrent()] || players[getCurrent()]?.isOff)
      ? order[0]
      : getCurrent();
    const currentPos = order.indexOf(start);
    const next = currentPos >= 0
      ? order[(currentPos + 1) % order.length]
      : order[0];
    setCurrent(next);

    rebuildPieceGrid();
    rebuildScoreboard();
    syncTurnControls();
    playSfx("turn");

    const p = players[next];
    if (!p || p.isOff) return;
    if (p.isBot){
      setStatus(`${p.name} bot is thinking...`);
      setUndoDisabled(getMoveHistory().length === 0);
      scheduleBotTurn(420);
      return;
    }

    const hasMove = playerHasAnyMove(next);
    if (!hasMove){
      setStatus(`${p.name} has no legal moves. Press Pass.`, "warn");
      toast(`${p.name}: no moves.`, "warn");
    } else {
      setStatus(`Your move. Select a piece. ${keyHint()}`);
    }

    setUndoDisabled(getMoveHistory().length === 0);
  }

  function passTurn(opts = {}){
    clearBotTurnTimer();

    const byBot = opts.byBot === true;
    const players = getPlayers();
    const current = getCurrent();
    const p = players[current];
    if (!p || p.isOff){
      advanceTurn();
      saveGameState();
      return;
    }
    if (p?.isBot && !byBot){
      toast(`${p.name} is a bot. Please wait.`, "warn");
      return;
    }

    const nextPassCount = getConsecutivePasses() + 1;
    setConsecutivePasses(nextPassCount);
    toast(`${playerLabel(p)} passed.`, "warn");
    setStatus(`${playerLabel(p)} passed. Next player...`, "warn");
    playSfx("pass");
    resetSelection();
    rebuildPieceGrid();

    const activeCount = Math.max(1, players.filter((player) => !player?.isOff).length);
    if (nextPassCount >= activeCount){
      endGame();
      return;
    }
    advanceTurn();
    saveGameState();
  }

  function undo(){
    clearBotTurnTimer();

    const moveHistory = getMoveHistory();
    const last = moveHistory.pop();
    if (!last) return;

    // roll back current turn to that player
    setCurrent(last.player);

    const board = getBoard();
    const players = getPlayers();

    // clear placed cells
    for (const c of last.placed){
      board[c.y][c.x] = -1;
    }

    // unuse piece
    const p = players[last.player];
    p.used.delete(last.pieceId);

    // update derived
    p.placedCells = 0;
    p.hasPlayed = p.used.size > 0;

    // recompute last piece size by scanning history
    p.lastPieceSize = null;
    for (let i = moveHistory.length - 1; i >= 0; i--){
      if (moveHistory[i].player === last.player){
        const piece = getPiece(moveHistory[i].pieceId);
        p.lastPieceSize = piece ? piece.size : null;
        break;
      }
    }

    setConsecutivePasses(0);

    resetSelection();
    rebuildPieceGrid();
    rebuildScoreboard();
    syncTurnControls();
    setUndoDisabled(moveHistory.length === 0);
    pulseClass(stageFrameEl, "undo-pop", 220);

    toast(`Undo: ${p.name} ${last.pieceId}`);
    const current = getCurrent();
    if (players[current].isBot){
      setStatus(`Undo complete. ${players[current].name} bot is thinking.`);
      scheduleBotTurn(420);
    } else {
      setStatus(`Undo complete. ${p.name}'s turn. ${keyHint()}`);
    }
    playSfx("undo");
    saveGameState();
  }

  return {
    applyPlacement,
    executeBotTurn,
    passTurn,
    undo,
  };
}
