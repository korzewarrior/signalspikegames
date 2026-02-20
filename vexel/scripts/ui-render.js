import { PIECES } from "./constants.js";
import { drawMiniPiece } from "./canvas-primitives.js";

const HORIZONTAL_PREVIEW_ORDINALS = new Set([7, 12, 14, 20]);

export function rebuildScoreboard({
  elScoreList,
  players,
  current,
  getPlayerVisual = null,
}){
  elScoreList.innerHTML = "";
  const scores = players.filter((p) => !p.isOff).map((p) => {
    let remaining = 0;
    for (const piece of PIECES){
      if (!p.used.has(piece.id)) remaining += piece.size;
    }
    const score = -remaining + ((remaining === 0) ? (15 + (p.lastPieceSize === 1 ? 5 : 0)) : 0);
    return { idx:p.idx, name:p.name, color:p.color, score, remaining };
  });

  for (const s of scores){
    const visual = typeof getPlayerVisual === "function"
      ? getPlayerVisual(s.idx)
      : { color: s.color, theme: "dark", patternType: null };
    const row = document.createElement("div");
    row.className = "scoreRow ui-surface-subtle";
    row.dataset.playerIdx = String(s.idx);
    row.dataset.visualTheme = visual.theme || "dark";
    if (visual.patternType){
      row.dataset.playerPattern = visual.patternType;
    }
    if (s.idx === current) row.classList.add("active");
    const botTag = players[s.idx]?.isBot ? `<span class="botTag">BOT</span>` : "";
    row.innerHTML = `
      <div class="scoreTop">
        <span class="swatch" data-player-idx="${s.idx}"></span>
        <span class="scoreName">${s.name}</span>
        ${botTag}
      </div>
      <div class="scoreVal">${s.score}</div>
    `;
    elScoreList.appendChild(row);
  }
}

export function rebuildPieceGrid({
  elPieceGrid,
  players,
  current,
  selectedPieceId,
  onPieceClick,
  getPlayerVisual = null,
}){
  elPieceGrid.innerHTML = "";
  const p = players[current];
  if (!p || p.isOff) return;
  const botTurn = !!p?.isBot;
  const visual = typeof getPlayerVisual === "function"
    ? getPlayerVisual(p.idx)
    : { color: p.color, theme: "dark", patternType: null };

  for (let pieceIndex = 0; pieceIndex < PIECES.length; pieceIndex++){
    const piece = PIECES[pieceIndex];
    const pieceOrdinal = pieceIndex + 1;
    const btn = document.createElement("button");
    btn.className = "pieceBtn ui-control";
    btn.type = "button";
    btn.dataset.id = piece.id;
    btn.dataset.playerIdx = String(p.idx);
    btn.dataset.visualTheme = visual.theme || "dark";
    if (visual.patternType){
      btn.dataset.playerPattern = visual.patternType;
    }
    if (botTurn) btn.disabled = true;

    const used = p.used.has(piece.id);
    if (used) btn.classList.add("used");
    if (selectedPieceId === piece.id) btn.classList.add("selected");

    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 120;

    btn.appendChild(c);
    elPieceGrid.appendChild(btn);

    const previewRotation = HORIZONTAL_PREVIEW_ORDINALS.has(pieceOrdinal) ? 1 : 0;
    drawMiniPiece(c, piece, visual.color || p.color, used, {
      theme: visual.theme || "dark",
      patternType: visual.patternType || null,
      playerIdx: p.idx,
      previewRotation,
    });

    btn.addEventListener("click", () => {
      if (typeof onPieceClick === "function"){
        onPieceClick({ piece, player:p, used, botTurn, button:btn, previewRotation });
      }
    });
  }
}

export function syncTurnControls({
  currentPlayer,
  btnPass,
  btnRotateLeft,
  btnRotateRight,
  btnFlip,
}){
  const botTurn = !!currentPlayer?.isBot;
  const offTurn = !!currentPlayer?.isOff;
  if (btnPass) btnPass.disabled = botTurn || offTurn;
  if (btnRotateLeft) btnRotateLeft.disabled = botTurn || offTurn;
  if (btnRotateRight) btnRotateRight.disabled = botTurn || offTurn;
  if (btnFlip) btnFlip.disabled = botTurn || offTurn;
}
