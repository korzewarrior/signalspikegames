export function createInputHandlers(deps = {}){
  const {
    elBoard = null,
    getDpr = () => 1,
    boardToCell = () => null,
    setHoverCell = () => {},
    getHoverCell = () => null,
    getSelectedPieceId = () => null,
    hoverMoveSfx = { x:-1, y:-1, t:0 },
    playSfx = () => {},
    getPlayers = () => [],
    getCurrent = () => 0,
    toast = () => {},
    setStatus = () => {},
    keyHint = () => "",
    pulseClass = () => {},
    getPiece = () => null,
    transformCells = () => ({ cells:[], grab:{x:0,y:0} }),
    getRotation = () => 0,
    getFlipped = () => false,
    validatePlacement = () => ({ ok:false, reasons:[] }),
    applyPlacement = () => false,
    isConfirmModalOpen = () => false,
    isSetupModalOpen = () => false,
    isGameOverModalOpen = () => false,
    hideNewGameConfirmModal = () => {},
    hideSetupModal = () => {},
    hideModal = () => {},
    clearSelection = () => {},
    rebuildPieceGrid = () => {},
    rotateSelection = () => {},
    flipSelection = () => {},
    setTouchAssist = () => {},
    clearTouchAssist = () => {},
  } = deps;

  let activeTouchPointerId = null;
  let suppressNextClick = false;

  function updateHoverFromPointer(evt, opts = {}){
    if (!elBoard) return;
    const playMoveSfx = opts.playMoveSfx !== false;
    const rect = elBoard.getBoundingClientRect();
    const px = (evt.clientX - rect.left) * getDpr();
    const py = (evt.clientY - rect.top) * getDpr();
    const nextCell = boardToCell(px, py);
    setHoverCell(nextCell);

    if (evt.pointerType === "touch"){
      setTouchAssist({
        pointerId: evt.pointerId,
        px,
        py,
      });
    } else {
      clearTouchAssist();
    }

    if (!playMoveSfx) return;

    if (!getSelectedPieceId() || !nextCell) return;
    if (nextCell.x === hoverMoveSfx.x && nextCell.y === hoverMoveSfx.y) return;

    const now = performance.now();
    if ((now - hoverMoveSfx.t) > 36){
      playSfx("move");
      hoverMoveSfx.t = now;
    }
    hoverMoveSfx.x = nextCell.x;
    hoverMoveSfx.y = nextCell.y;
  }

  function tryPlaceSelectedPieceAtHover(){
    const players = getPlayers();
    const current = getCurrent();
    const p = players[current];
    if (p?.isBot){
      toast(`${p.name} is a bot. Please wait.`, "warn");
      return false;
    }

    const selectedPieceId = getSelectedPieceId();
    if (!selectedPieceId) return false;

    const hoverCell = getHoverCell();
    if (!hoverCell){
      const msg = "That placement is off the board.";
      toast(msg, "bad");
      setStatus(msg + " " + keyHint(), "bad");
      pulseClass(elBoard, "shake", 260);
      playSfx("invalid");
      return false;
    }
    if (p.used.has(selectedPieceId)) return false;

    const piece = getPiece(selectedPieceId);
    if (!piece) return false;
    const tf = transformCells(piece.cells, getRotation(), getFlipped());
    const anchorX = hoverCell.x - tf.grab.x;
    const anchorY = hoverCell.y - tf.grab.y;

    const v = validatePlacement(p.idx, tf.cells, anchorX, anchorY);
    if (!v.ok){
      const reason = v.reasons[0] || "Illegal move.";
      toast(reason, "bad");
      setStatus(reason + " " + keyHint(), "bad");
      pulseClass(elBoard, "shake", 280);
      playSfx("invalid");
      return false;
    }
    return applyPlacement(p.idx, piece.id, tf.cells, anchorX, anchorY);
  }

  function onPointerMove(evt){
    updateHoverFromPointer(evt);
  }

  function onPointerDown(evt){
    if (evt.pointerType !== "touch") return;
    activeTouchPointerId = evt.pointerId;
    updateHoverFromPointer(evt, { playMoveSfx:false });
  }

  function onPointerUp(evt){
    if (evt.pointerType !== "touch") return;
    if (activeTouchPointerId !== null && evt.pointerId !== activeTouchPointerId) return;
    updateHoverFromPointer(evt, { playMoveSfx:false });
    if (getSelectedPieceId()){
      suppressNextClick = true;
      tryPlaceSelectedPieceAtHover();
    }
    activeTouchPointerId = null;
    clearTouchAssist();
  }

  function onPointerCancel(evt){
    if (evt.pointerType !== "touch") return;
    if (activeTouchPointerId !== null && evt.pointerId !== activeTouchPointerId) return;
    activeTouchPointerId = null;
    clearTouchAssist();
  }

  function onPointerLeave(){
    if (activeTouchPointerId !== null) return;
    setHoverCell(null);
    hoverMoveSfx.x = -1;
    hoverMoveSfx.y = -1;
    clearTouchAssist();
  }

  function onClickBoard(){
    if (suppressNextClick){
      suppressNextClick = false;
      return;
    }
    tryPlaceSelectedPieceAtHover();
  }

  function onKeyDown(e){
    if (isConfirmModalOpen()){
      if (e.key === "Escape") hideNewGameConfirmModal();
      return;
    }
    if (isSetupModalOpen()){
      if (e.key === "Escape") hideSetupModal();
      return;
    }
    if (isGameOverModalOpen()){
      if (e.key === "Escape") hideModal();
      return;
    }

    if (e.key === "Escape"){
      if (getSelectedPieceId()){
        clearSelection();
        rebuildPieceGrid();
        setStatus(`Selection cleared. ${keyHint()}`);
        playSfx("ui");
      }
      return;
    }
    if (!getSelectedPieceId()) return;

    if (e.key === "r" || e.key === "R"){
      rotateSelection(1);
    }
    if (e.key === "f" || e.key === "F"){
      flipSelection();
    }
  }

  return {
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClickBoard,
    onKeyDown,
  };
}
