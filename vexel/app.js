import {
  N,
  TOTAL_PLAYERS,
  PIECES,
} from "./scripts/constants.js";
import {
  approach,
  clampVolume,
  volumePct,
  makeBoard,
  makePlayers,
  transformCells,
  hexToRgba,
} from "./scripts/utils.js";
import { createAudioController } from "./scripts/audio-controller.js";
import { createGameLogic } from "./scripts/game-logic.js";
import { createGameStorage } from "./scripts/game-storage.js";
import { createTurnActions } from "./scripts/turn-actions.js";
import { createModalFlow } from "./scripts/modal-flow.js";
import { createInputHandlers } from "./scripts/input-handlers.js";
import {
  rebuildScoreboard as renderScoreboard,
  rebuildPieceGrid as renderPieceGrid,
  syncTurnControls as renderTurnControls,
} from "./scripts/ui-render.js";
import {
  roundedRectPath,
  drawBevelSquare,
} from "./scripts/canvas-primitives.js";
import {
  VISUAL_THEME_KEY,
  VISUAL_THEME_DARK,
  VISUAL_THEME_LIGHT,
  normalizeVisualTheme,
  isLightTheme as isLightVisualTheme,
  getThemeColorByIndex as themeColorByIndex,
  getThemePatternByIndex as themePatternByIndex,
  resolveThemeColorFromBase,
} from "./scripts/theme-utils.js";

/* Vexel
   One HTML, modular CSS, modular JS. No libraries. */

(() => {
  "use strict";

  // ---------- DOM ----------
  const elBoard = document.getElementById("board");
  const ctx = elBoard.getContext("2d");

  const elPieceGrid = document.getElementById("pieceGrid");
  const elScoreList = document.getElementById("scoreList");
  const elStatus = document.getElementById("statusText");
  const elToast = document.getElementById("toast");
  const elStageFrame = document.querySelector(".stageFrame");
  const btnThemeToggle = document.getElementById("themeTogglePlay");

  const inputMusicVolume = document.getElementById("musicVolume");
  const inputSfxVolume = document.getElementById("sfxVolume");
  const btnNew = document.getElementById("btnNew");
  const btnUndo = document.getElementById("btnUndo");
  const btnPass = document.getElementById("btnPass");
  const btnRotateLeft = document.getElementById("btnRotateLeft");
  const btnRotateRight = document.getElementById("btnRotateRight");
  const btnFlip = document.getElementById("btnFlip");

  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalClose = document.getElementById("modalClose");
  const modalNew = document.getElementById("modalNew");
  const setupModal = document.getElementById("setupModal");
  const setupClose = document.getElementById("setupClose");
  const setupHumanPicker = document.getElementById("setupHumanPicker");
  const setupHumanButtons = setupHumanPicker
    ? Array.from(setupHumanPicker.querySelectorAll(".humanPick[data-player]"))
    : [];
  const setupSummary = document.getElementById("setupSummary");
  const setupStart = document.getElementById("setupStart");
  const confirmModal = document.getElementById("confirmModal");
  const confirmClose = document.getElementById("confirmClose");
  const confirmCancel = document.getElementById("confirmCancel");
  const confirmProceed = document.getElementById("confirmProceed");

  // ---------- State ----------
  const PLAYER_MODE_HUMAN = "human";
  const PLAYER_MODE_BOT = "bot";
  const PLAYER_MODE_OFF = "off";
  const VALID_PLAYER_MODES = new Set([PLAYER_MODE_HUMAN, PLAYER_MODE_BOT, PLAYER_MODE_OFF]);
  const DEFAULT_PLAYER_MODES = [PLAYER_MODE_HUMAN, PLAYER_MODE_BOT, PLAYER_MODE_BOT, PLAYER_MODE_BOT];
  const PLAYER_COLOR_LABELS = ["Red", "Blue", "Green", "Purple"];
  let visualTheme = VISUAL_THEME_LIGHT;
  let configuredPlayerModes = [...DEFAULT_PLAYER_MODES];
  let board = makeBoard(N);
  let players = makePlayers(TOTAL_PLAYERS, 0);
  applyPlayerModesToPlayers(configuredPlayerModes);
  let current = firstActivePlayerIndex(players);

  let selectedPieceId = null;
  let rotation = 0;     // 0..3
  let flipped = false;  // mirror X

  let hoverCell = null; // {x,y}
  let moveHistory = [];
  let consecutivePasses = 0;
  let placementBursts = [];
  let hoverSmooth = {x:0, y:0, alpha:0};
  let ghostAnchor = {x:0, y:0, alpha:0, key:"", active:false};
  let touchAssist = {active:false, pointerId:null, px:0, py:0};
  let hoverMoveSfx = { x:-1, y:-1, t:0 };
  let botTurnTimer = null;
  let botTurnToken = 0;
  // rendering layout
  let dpr = 1;
  let cell = 1;
  let origin = {x:0,y:0};
  const VALID_STATUS_TONES = new Set(["neutral", "warn", "bad", "good"]);
  const PIECE_SIZES = PIECES.reduce((acc, piece) => {
    acc[piece.id] = piece.size;
    return acc;
  }, {});
  const MOBILE_SCROLL_CLASS_ABOVE = "mobile-scroll-has-above";
  const MOBILE_SCROLL_CLASS_BELOW = "mobile-scroll-has-below";
  const MOBILE_LAYOUT_QUERY = "(max-width: 860px)";
  let mobileScrollCueRaf = 0;

  // ---------- Helpers ----------
  function toInt(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  function pieceSizeById(id){
    return PIECE_SIZES[id] || 0;
  }
  function playerLabel(p){
    if (!p) return "";
    if (p.isOff) return `${p.name} off`;
    return p.isBot ? `${p.name} bot` : p.name;
  }
  function normalizePlayerMode(rawMode, fallbackMode = PLAYER_MODE_BOT){
    if (VALID_PLAYER_MODES.has(rawMode)) return rawMode;
    if (typeof rawMode === "boolean") return rawMode ? PLAYER_MODE_HUMAN : PLAYER_MODE_BOT;
    return VALID_PLAYER_MODES.has(fallbackMode) ? fallbackMode : PLAYER_MODE_BOT;
  }
  function normalizePlayerModes(rawModes, fallbackModes = DEFAULT_PLAYER_MODES){
    const fallback = Array.isArray(fallbackModes) ? fallbackModes : DEFAULT_PLAYER_MODES;
    const normalized = Array.from(
      { length: TOTAL_PLAYERS },
      (_, idx) => normalizePlayerMode(fallback[idx], DEFAULT_PLAYER_MODES[idx])
    );
    if (Array.isArray(rawModes)){
      for (let i = 0; i < TOTAL_PLAYERS; i++){
        normalized[i] = normalizePlayerMode(rawModes[i], normalized[i]);
      }
    }
    const activeIndexes = normalized
      .map((mode, idx) => (mode !== PLAYER_MODE_OFF ? idx : -1))
      .filter((idx) => idx >= 0);
    if (activeIndexes.length === 0){
      normalized[0] = PLAYER_MODE_HUMAN;
      if (TOTAL_PLAYERS > 1){
        normalized[1] = PLAYER_MODE_BOT;
      }
      return normalized;
    }
    if (activeIndexes.length === 1){
      const extraIdx = normalized.findIndex((mode, idx) => idx !== activeIndexes[0] && mode === PLAYER_MODE_OFF);
      if (extraIdx >= 0){
        const fallbackMode = normalizePlayerMode(fallback[extraIdx], DEFAULT_PLAYER_MODES[extraIdx]);
        normalized[extraIdx] = fallbackMode === PLAYER_MODE_OFF ? PLAYER_MODE_BOT : fallbackMode;
      }
    }
    return normalized;
  }
  function modeToLabel(mode){
    if (mode === PLAYER_MODE_HUMAN) return "Player";
    if (mode === PLAYER_MODE_BOT) return "Bot";
    return "Off";
  }
  function nextPlayerMode(mode){
    if (mode === PLAYER_MODE_HUMAN) return PLAYER_MODE_BOT;
    if (mode === PLAYER_MODE_BOT) return PLAYER_MODE_OFF;
    return PLAYER_MODE_HUMAN;
  }
  function modeFromPlayer(player){
    if (!player) return PLAYER_MODE_OFF;
    if (player.isOff) return PLAYER_MODE_OFF;
    if (player.isBot) return PLAYER_MODE_BOT;
    return PLAYER_MODE_HUMAN;
  }
  function modesFromPlayers(fromPlayers = players){
    return normalizePlayerModes(
      fromPlayers.map((player) => modeFromPlayer(player)),
      configuredPlayerModes
    );
  }
  function firstActivePlayerIndex(fromPlayers = players){
    const idx = fromPlayers.findIndex((p) => !p?.isOff);
    return idx >= 0 ? idx : 0;
  }
  function getSetupPlayerModes(){
    if (!setupHumanButtons.length){
      return normalizePlayerModes(configuredPlayerModes);
    }
    const modes = normalizePlayerModes(configuredPlayerModes);
    setupHumanButtons.forEach((btn) => {
      const idx = toInt(btn.dataset.player, -1);
      if (idx < 0 || idx >= TOTAL_PLAYERS) return;
      modes[idx] = normalizePlayerMode(btn.dataset.mode, modes[idx]);
    });
    return normalizePlayerModes(modes, configuredPlayerModes);
  }
  function setSetupPlayerModes(nextModes, opts = {}){
    const quiet = opts.quiet === true;
    const modes = normalizePlayerModes(nextModes, configuredPlayerModes);
    setupHumanButtons.forEach((btn) => {
      const idx = toInt(btn.dataset.player, -1);
      if (idx < 0 || idx >= TOTAL_PLAYERS) return;
      const mode = modes[idx];
      const isHuman = mode === PLAYER_MODE_HUMAN;
      const isBot = mode === PLAYER_MODE_BOT;
      const isOff = mode === PLAYER_MODE_OFF;
      btn.dataset.mode = mode;
      btn.classList.toggle("is-active", isHuman);
      btn.classList.toggle("is-human", isHuman);
      btn.classList.toggle("is-bot", isBot);
      btn.classList.toggle("is-off", isOff);
      btn.setAttribute("aria-pressed", String(isHuman));
      btn.setAttribute("aria-label", `${PLAYER_COLOR_LABELS[idx]} ${modeToLabel(mode).toLowerCase()}`);
      const modeEl = btn.querySelector(".pickMode");
      if (modeEl){
        modeEl.textContent = modeToLabel(modes[idx]);
      }
    });
    updateSetupSummary();
    if (!quiet){
      playSfx("ui");
    }
    return modes;
  }
  function applyPlayerModesToPlayers(modes){
    const normalized = normalizePlayerModes(modes, configuredPlayerModes);
    for (let i = 0; i < players.length; i++){
      const mode = normalized[i];
      players[i].isOff = mode === PLAYER_MODE_OFF;
      players[i].isBot = mode === PLAYER_MODE_BOT;
    }
  }

  function readStoredVisualTheme(){
    const fromDom = document.documentElement?.getAttribute("data-vexel-theme");
    if (fromDom){
      return normalizeVisualTheme(fromDom);
    }
    try {
      return normalizeVisualTheme(localStorage.getItem(VISUAL_THEME_KEY));
    } catch (_) {
      return VISUAL_THEME_LIGHT;
    }
  }

  function isLightTheme(){
    return isLightVisualTheme(visualTheme);
  }

  function getThemeColorByIndex(idx){
    return themeColorByIndex(visualTheme, idx);
  }

  function getThemePatternByIndex(idx){
    return themePatternByIndex(idx);
  }

  function getPlayerVisual(idx){
    return {
      theme: visualTheme,
      color: getThemeColorByIndex(idx),
      patternType: getThemePatternByIndex(idx),
      playerIdx: idx,
    };
  }

  function syncThemeToggleUi(){
    if (!btnThemeToggle) return;
    const isLight = isLightTheme();
    btnThemeToggle.setAttribute("aria-checked", String(isLight));
    btnThemeToggle.setAttribute(
      "aria-label",
      isLight ? "Use dark mode visual theme" : "Use light mode visual theme"
    );
    btnThemeToggle.dataset.theme = visualTheme;
  }

  function applyVisualTheme(nextTheme, opts = {}){
    const persist = opts.persist !== false;
    const forceRefresh = opts.refresh !== false;
    visualTheme = normalizeVisualTheme(nextTheme);
    document.documentElement.setAttribute("data-vexel-theme", visualTheme);
    syncThemeToggleUi();
    if (persist){
      try {
        localStorage.setItem(VISUAL_THEME_KEY, visualTheme);
      } catch (_) {}
    }
    if (forceRefresh){
      rebuildScoreboard();
      rebuildPieceGrid();
    }
  }

  function updateMobileScrollCues(){
    if (!document.body) return;
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches){
      document.body.classList.remove(MOBILE_SCROLL_CLASS_ABOVE, MOBILE_SCROLL_CLASS_BELOW);
      return;
    }

    const scroller = document.scrollingElement || document.documentElement;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const scrollTop = scroller ? scroller.scrollTop : (window.scrollY || 0);
    const scrollHeight = scroller ? scroller.scrollHeight : document.body.scrollHeight;
    const maxScroll = Math.max(0, scrollHeight - viewportHeight);

    if (maxScroll <= 6){
      document.body.classList.remove(MOBILE_SCROLL_CLASS_ABOVE, MOBILE_SCROLL_CLASS_BELOW);
      return;
    }

    document.body.classList.toggle(MOBILE_SCROLL_CLASS_ABOVE, scrollTop > 6);
    document.body.classList.toggle(MOBILE_SCROLL_CLASS_BELOW, scrollTop < (maxScroll - 6));
  }

  function scheduleMobileScrollCueUpdate(){
    if (mobileScrollCueRaf) return;
    mobileScrollCueRaf = requestAnimationFrame(() => {
      mobileScrollCueRaf = 0;
      updateMobileScrollCues();
    });
  }

  function pulseClass(el, className, ms = 360){
    if (!el) return;
    el.classList.remove(className);
    // Restart CSS keyframe animations when the same class is reapplied.
    void el.offsetWidth;
    el.classList.add(className);
    const timerKey = `__${className}Timer`;
    clearTimeout(el[timerKey]);
    el[timerKey] = setTimeout(() => el.classList.remove(className), ms);
  }

  function updateLastPieceSizesFromHistory(){
    for (const p of players){
      p.lastPieceSize = null;
    }
    for (const move of moveHistory){
      const p = players[move.player];
      if (!p) continue;
      p.lastPieceSize = pieceSizeById(move.pieceId) || null;
    }
  }

  function resetTransientState(){
    hoverCell = null;
    placementBursts = [];
    hoverSmooth.x = 0;
    hoverSmooth.y = 0;
    hoverSmooth.alpha = 0;
    ghostAnchor.x = 0;
    ghostAnchor.y = 0;
    ghostAnchor.alpha = 0;
    ghostAnchor.key = "";
    ghostAnchor.active = false;
    touchAssist.active = false;
    touchAssist.pointerId = null;
    touchAssist.px = 0;
    touchAssist.py = 0;
    hoverMoveSfx.x = -1;
    hoverMoveSfx.y = -1;
    hoverMoveSfx.t = 0;
  }

  const gameStorage = createGameStorage({
    storageKey: "vexel-game-state-v1",
    version: 1,
    boardSize: N,
    totalPlayers: TOTAL_PLAYERS,
    pieces: PIECES,
    makePlayers,
    normalizePlayerModes,
    validStatusTones: VALID_STATUS_TONES,
  });

  function saveGameState(){
    configuredPlayerModes = modesFromPlayers(players);
    gameStorage.save({
      configuredPlayerModes,
      board,
      players: players.map((p) => ({
        idx: p.idx,
        isBot: p.isBot,
        isOff: !!p.isOff,
        used: Array.from(p.used),
        placedCells: p.placedCells,
        hasPlayed: p.hasPlayed,
        lastPieceSize: p.lastPieceSize,
      })),
      current,
      selectedPieceId,
      rotation,
      flipped,
      moveHistory: moveHistory.map((move) => ({
        player: move.player,
        pieceId: move.pieceId,
        placed: move.placed.map((c) => ({ x: c.x, y: c.y })),
      })),
      consecutivePasses,
      statusText: elStatus ? elStatus.textContent : "",
      statusTone: elStatus?.dataset?.tone || "neutral",
      gameOver: !modal.hidden,
      savedAt: Date.now(),
    });
  }

  function loadSavedGameState(){
    return gameStorage.load();
  }

  function restoreSavedGameState(){
    const saved = loadSavedGameState();
    if (!saved) return null;

    configuredPlayerModes = normalizePlayerModes(saved.configuredPlayerModes, configuredPlayerModes);
    board = saved.board;
    players = saved.players;
    applyPlayerModesToPlayers(configuredPlayerModes);
    const savedCurrent = Number.isFinite(saved.current) ? saved.current : 0;
    current = (players[savedCurrent] && !players[savedCurrent].isOff)
      ? savedCurrent
      : firstActivePlayerIndex(players);
    selectedPieceId = saved.selectedPieceId;
    rotation = saved.rotation;
    flipped = saved.flipped;
    moveHistory = saved.moveHistory;
    consecutivePasses = saved.consecutivePasses;
    updateLastPieceSizesFromHistory();
    resetTransientState();

    if (setupModal) setupModal.hidden = true;
    if (confirmModal) confirmModal.hidden = true;
    if (modal) modal.hidden = true;

    return saved;
  }

  function defaultTurnStatus(){
    const p = players[current];
    if (!p) return `Pick a piece to begin. ${keyHint()}`;
    if (p.isOff) return "Select at least one active color in New Game setup.";
    if (p.isBot) return `${p.name} bot is thinking...`;
    const hasMove = playerHasAnyMove(current);
    if (!hasMove) return `${p.name} has no legal moves. Press Pass.`;
    return `Your move. Select a piece. ${keyHint()}`;
  }

  const audio = createAudioController({
    inputMusicVolume,
    inputSfxVolume,
    toast,
  });
  const {
    playSfx,
    ensureAudioReady,
    loadMusicEnabled,
    loadMusicVolume,
    loadSfxVolume,
    setMusicEnabled,
    setMusicVolume,
    setSfxVolume,
  } = audio;

  function toast(msg, tone = "neutral"){
    elToast.textContent = msg;
    if (tone === "neutral"){
      delete elToast.dataset.tone;
    } else {
      elToast.dataset.tone = tone;
    }
    elToast.classList.remove("show");
    void elToast.offsetWidth;
    elToast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => elToast.classList.remove("show"), 1500);
  }

  function setStatus(msg, tone = "neutral"){
    elStatus.textContent = msg;
    if (tone === "neutral"){
      delete elStatus.dataset.tone;
    } else {
      elStatus.dataset.tone = tone;
    }
    pulseClass(elStatus, "flash-status", 300);
    saveGameState();
  }

  function keyHint(){
    return "Use Turn/Flip buttons or R/F keys. Esc clears.";
  }

  function canTransformSelectedPiece(){
    if (players[current]?.isOff){
      setStatus("This color is off. Start a new game to change active colors.", "warn");
      toast("This color is off.", "warn");
      return false;
    }
    if (players[current]?.isBot){
      setStatus(`${players[current].name} bot is taking this turn.`, "warn");
      toast("Wait for the bot turn.", "warn");
      return false;
    }
    if (selectedPieceId) return true;
    setStatus("Select a piece first, then turn or flip it.", "warn");
    toast("Select a piece first.", "warn");
    pulseClass(elPieceGrid, "pulse-grid", 220);
    playSfx("invalid");
    return false;
  }

  function rotateSelection(dir){
    if (!canTransformSelectedPiece()) return;
    // Invert step mapping so right controls rotate visually right, left controls left.
    rotation = (rotation + (dir > 0 ? 3 : 1)) % 4;
    playSfx("transform");
    saveGameState();
  }

  function flipSelection(){
    if (!canTransformSelectedPiece()) return;
    flipped = !flipped;
    playSfx("transform");
    saveGameState();
  }

  function resetSelection(){
    selectedPieceId = null;
    rotation = 0;
    flipped = false;
    ghostAnchor.active = false;
  }

  const logic = createGameLogic({
    getBoard: () => board,
    getPlayers: () => players,
  });
  const {
    getPiece,
    playerCorner,
    inBounds,
    validatePlacement,
    playerHasAnyMove,
    findBestBotMove,
    computeScores,
  } = logic;

  const modalFlow = createModalFlow({
    modal,
    modalTitle,
    modalBody,
    setupModal,
    confirmModal,
    setupSummary,
    totalPlayers: TOTAL_PLAYERS,
    playerColorLabels: PLAYER_COLOR_LABELS,
    getSetupPlayerModes,
    setSetupPlayerModes,
    getConfiguredPlayerModes: () => configuredPlayerModes,
    setConfiguredPlayerModes: (modes) => {
      configuredPlayerModes = modes;
    },
    getDefaultPlayerModes: () => [...DEFAULT_PLAYER_MODES],
    normalizePlayerModes,
    clearBotTurnTimer,
    scheduleBotTurn,
    saveGameState,
    playSfx,
    getHasGameProgress: () => {
      if (moveHistory.length > 0) return true;
      return players.some((p) => p.used.size > 0 || p.placedCells > 0 || p.hasPlayed);
    },
    startNewGame: (opts) => newGame(opts),
    computeScores,
    getPlayers: () => players,
  });
  const {
    updateSetupSummary,
    showModal,
    hideModal,
    showSetupModal,
    hideSetupModal,
    hideNewGameConfirmModal,
    requestNewGameConfirmation,
    openSetupForNewGame,
    startConfiguredGameFromSetup,
    endGame,
    isConfirmModalOpen,
    isSetupModalOpen,
    isGameOverModalOpen,
  } = modalFlow;

  // ---------- UI Build ----------
  function rebuildScoreboard(){
    renderScoreboard({
      elScoreList,
      players,
      current,
      getPlayerVisual,
    });
    scheduleMobileScrollCueUpdate();
  }

  function rebuildPieceGrid(){
    renderPieceGrid({
      elPieceGrid,
      players,
      current,
      selectedPieceId,
      getPlayerVisual,
      onPieceClick: ({ piece, player, previewRotation = 0 }) => {
        if (player.isBot){
          toast("Bot turn in progress.", "warn");
          return;
        }
        if (player.used.has(piece.id)){
          toast("That piece is already used.", "warn");
          pulseClass(elPieceGrid, "pulse-grid", 260);
          playSfx("invalid");
          return;
        }
        if (selectedPieceId === piece.id){
          selectedPieceId = null;
          ghostAnchor.active = false;
          setStatus(`Selection cleared. ${keyHint()}`);
          playSfx("ui");
        } else {
          selectedPieceId = piece.id;
          rotation = ((Math.trunc(previewRotation) % 4) + 4) % 4;
          flipped = false;
          ghostAnchor.active = false;
          setStatus(`Selected ${piece.name}. Place on board. ${keyHint()}`);
          playSfx("select");
        }
        rebuildPieceGrid();
        saveGameState();
      },
    });
    scheduleMobileScrollCueUpdate();
  }

  function syncTurnControls(){
    renderTurnControls({
      currentPlayer: players[current],
      btnPass,
      btnRotateLeft,
      btnRotateRight,
      btnFlip,
    });
  }

  function clearBotTurnTimer(){
    botTurnToken += 1;
    if (botTurnTimer){
      clearTimeout(botTurnTimer);
      botTurnTimer = null;
    }
  }

  function scheduleBotTurn(delayMs = 420){
    clearBotTurnTimer();
    const p = players[current];
    if (!p || p.isOff || !p.isBot) return;
    if (modal.hidden === false) return;
    if (setupModal && setupModal.hidden === false) return;
    if (confirmModal && confirmModal.hidden === false) return;

    const token = botTurnToken;
    const delay = Math.max(120, Number(delayMs) || 420);
    botTurnTimer = setTimeout(() => {
      botTurnTimer = null;
      if (token !== botTurnToken) return;
      executeBotTurn();
    }, delay);
  }

  // ---------- Canvas Drawing ----------
  function resizeCanvas(){
    const rect = elBoard.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    elBoard.width = Math.round(rect.width * dpr);
    elBoard.height = Math.round(rect.height * dpr);

    // layout metrics
    const w = elBoard.width, h = elBoard.height;
    const min = Math.min(w,h);
    cell = Math.max(1, Math.floor(min / N));
    origin = { x: 0, y: 0 };
    scheduleMobileScrollCueUpdate();
  }

  function boardToCell(px, py){
    const x = Math.floor((px - origin.x) / cell);
    const y = Math.floor((py - origin.y) / cell);
    if (x < 0 || y < 0 || x >= N || y >= N) return null;
    return {x,y};
  }

  function cellToPx(x,y){
    return { x: origin.x + x*cell, y: origin.y + y*cell };
  }

  function boardBubbleRect(x, y, insetScale = 0.13){
    const inset = Math.max(0.8, cell * insetScale);
    const size = Math.max(1, cell - (inset * 2));
    const radius = Math.max(2, size * 0.24);
    return {
      x: origin.x + (x * cell) + inset,
      y: origin.y + (y * cell) + inset,
      size,
      radius,
    };
  }

  function addPlacementBursts(cells, color){
    const base = performance.now();
    for (let i = 0; i < cells.length; i++){
      placementBursts.push({
        x: cells[i].x,
        y: cells[i].y,
        color,
        start: base + (i * 20),
        duration: 460,
      });
    }
  }

  function drawPlacementBursts(now){
    if (placementBursts.length === 0) return;
    const keep = [];
    for (const fx of placementBursts){
      const age = now - fx.start;
      if (age < 0){
        keep.push(fx);
        continue;
      }
      if (age > fx.duration) continue;

      const t = age / fx.duration;
      const eased = 1 - Math.pow(1 - t, 2);
      const px = cellToPx(fx.x, fx.y);
      const cx = px.x + (cell * 0.5);
      const cy = px.y + (cell * 0.5);
      const half = cell * (0.34 + (0.32 * eased));
      const fxColor = resolveThemeColorFromBase(visualTheme, fx.color);

      ctx.save();
      ctx.globalAlpha = (1 - eased) * 0.72;
      ctx.strokeStyle = hexToRgba(fxColor, 0.95);
      ctx.lineWidth = Math.max(1, dpr * (1.8 - eased));
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);

      ctx.globalAlpha = (1 - eased) * 0.24;
      ctx.fillStyle = hexToRgba(fxColor, 0.84);
      ctx.fillRect(px.x + 1, px.y + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
      ctx.restore();

      keep.push(fx);
    }
    placementBursts = keep;
  }

  function drawBoardPlaySpace(now){
    const pulse = 0.5 + (0.5 * Math.sin(now * 0.0015));
    const hoverActive = !!hoverCell && hoverSmooth.alpha > 0.02;
    const hoverRadiusCells = 2.7;
    const hoverPulse = 0.5 + (0.5 * Math.sin(now * 0.0068));
    const hoverFocusPower = 1.32;

    function hoverFalloffForCell(x, y){
      if (!hoverActive) return 0;
      if (board[y][x] !== -1) return 0;
      const dx = x - hoverSmooth.x;
      const dy = y - hoverSmooth.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= hoverRadiusCells) return 0;
      const t = 1 - (dist / hoverRadiusCells);
      const smooth = t * t * (3 - (2 * t));
      const focused = Math.pow(smooth, hoverFocusPower);
      return Math.min(1, focused * 1.08) * hoverSmooth.alpha;
    }

    if (isLightTheme()){
      const veilAlpha = 0.74 + (0.05 * pulse);
      const tintAlpha = 0.1 + (0.025 * pulse);
      const ringAlpha = 0.24 + (0.05 * pulse);
      const ringColor = `rgba(78,58,166,${ringAlpha})`;

      ctx.save();
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = Math.max(1, 0.95 * dpr);
      for (let y=0; y<N; y++){
        for (let x=0; x<N; x++){
          const bubble = boardBubbleRect(x, y, 0.13);
          const hoverFactor = hoverFalloffForCell(x, y);
          const scale = 1 + (hoverFactor * (0.108 + (hoverPulse * 0.09)));
          const size = bubble.size * scale;
          const bx = bubble.x + ((bubble.size - size) * 0.5);
          const by = bubble.y + ((bubble.size - size) * 0.5);
          const radius = Math.max(2, bubble.radius * (1 + (hoverFactor * 0.14)));
          const veilBoost = veilAlpha + (hoverFactor * 0.12);
          const tintBoost = tintAlpha + (hoverFactor * 0.08);
          const ringBoost = ringAlpha + (hoverFactor * 0.12);

          roundedRectPath(ctx, bx, by, size, size, radius);
          ctx.fillStyle = `rgba(248,250,255,${veilBoost})`;
          ctx.fill();
          roundedRectPath(ctx, bx, by, size, size, radius);
          ctx.fillStyle = `rgba(132,108,244,${tintBoost})`;
          ctx.fill();
          roundedRectPath(ctx, bx, by, size, size, radius);
          ctx.strokeStyle = `rgba(78,58,166,${ringBoost})`;
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    const veilAlpha = 0.62 + (0.05 * pulse);
    const tintAlpha = 0.03 + (0.015 * pulse);
    const ringAlpha = 0.16 + (0.05 * pulse);
    const ringColor = `rgba(210,212,218,${ringAlpha})`;
    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = Math.max(1, 0.95 * dpr);
    for (let y=0; y<N; y++){
      for (let x=0; x<N; x++){
        const bubble = boardBubbleRect(x, y, 0.13);
        const hoverFactor = hoverFalloffForCell(x, y);
        const scale = 1 + (hoverFactor * (0.108 + (hoverPulse * 0.09)));
        const size = bubble.size * scale;
        const bx = bubble.x + ((bubble.size - size) * 0.5);
        const by = bubble.y + ((bubble.size - size) * 0.5);
        const radius = Math.max(2, bubble.radius * (1 + (hoverFactor * 0.14)));
        const veilBoost = veilAlpha + (hoverFactor * 0.1);
        const tintBoost = tintAlpha + (hoverFactor * 0.05);
        const ringBoost = ringAlpha + (hoverFactor * 0.1);

        roundedRectPath(ctx, bx, by, size, size, radius);
        ctx.fillStyle = `rgba(4,4,6,${veilBoost})`;
        ctx.fill();
        roundedRectPath(ctx, bx, by, size, size, radius);
        ctx.fillStyle = `rgba(255,255,255,${tintBoost})`;
        ctx.fill();
        roundedRectPath(ctx, bx, by, size, size, radius);
        ctx.strokeStyle = `rgba(210,212,218,${ringBoost})`;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawGridFocusLines(now){
    if (!hoverCell || hoverSmooth.alpha <= 0.03) return;

    const x = hoverCell.x;
    const y = hoverCell.y;
    const pulse = 0.52 + (0.48 * Math.sin(now * 0.01));
    const ringAlpha = (0.2 + (0.12 * pulse)) * hoverSmooth.alpha;
    const fillAlpha = (0.04 + (0.03 * pulse)) * hoverSmooth.alpha;
    const turnPlayer = players[current];
    const showTurnGlow = !!turnPlayer && !turnPlayer.isBot;
    const turnColor = getThemeColorByIndex(turnPlayer?.idx ?? current);
    const bubble = boardBubbleRect(x, y, 0.1);
    const cx = bubble.x + (bubble.size * 0.5);
    const cy = bubble.y + (bubble.size * 0.5);
    ctx.save();
    if (showTurnGlow){
      const tint = ctx.createRadialGradient(cx, cy, bubble.size * 0.18, cx, cy, bubble.size * 1.45);
      tint.addColorStop(0, hexToRgba(turnColor, (isLightTheme() ? 0.18 : 0.22) * hoverSmooth.alpha));
      tint.addColorStop(1, hexToRgba(turnColor, 0));
      ctx.fillStyle = tint;
      ctx.fillRect(cx - (bubble.size * 1.6), cy - (bubble.size * 1.6), bubble.size * 3.2, bubble.size * 3.2);
    }

    ctx.fillStyle = isLightTheme()
      ? `rgba(111,133,244,${fillAlpha * 1.2})`
      : `rgba(242,244,250,${fillAlpha * 0.7})`;
    roundedRectPath(ctx, bubble.x, bubble.y, bubble.size, bubble.size, bubble.radius);
    ctx.fill();

    ctx.strokeStyle = isLightTheme()
      ? `rgba(51,73,170,${ringAlpha * 1.08})`
      : `rgba(224,226,234,${ringAlpha * 0.82})`;
    ctx.lineWidth = Math.max(1, 1.25 * dpr);
    roundedRectPath(
      ctx,
      bubble.x - 0.5,
      bubble.y - 0.5,
      bubble.size + 1,
      bubble.size + 1,
      bubble.radius + 1
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawTouchPlacementAssist(){
    if (!touchAssist.active || !hoverCell || !selectedPieceId) return;
    const p = players[current];
    if (!p || p.isBot || p.used.has(selectedPieceId)) return;
    const piece = getPiece(selectedPieceId);
    if (!piece) return;

    const tf = transformCells(piece.cells, rotation, flipped);
    const anchorX = hoverCell.x - tf.grab.x;
    const anchorY = hoverCell.y - tf.grab.y;
    const placement = validatePlacement(p.idx, tf.cells, anchorX, anchorY);
    const isValid = !!placement.ok;

    const targetX = origin.x + ((hoverCell.x + 0.5) * cell);
    const targetY = origin.y + ((hoverCell.y + 0.5) * cell);
    const markerRadius = Math.max(12, Math.min(cell * 0.44, 22 * dpr));
    const markerPad = markerRadius + (8 * dpr);
    const desiredMarkerY = touchAssist.py - Math.max(cell * 1.2, 38 * dpr);
    const markerX = Math.max(markerPad, Math.min(elBoard.width - markerPad, touchAssist.px));
    const markerY = Math.max(markerPad, Math.min(elBoard.height - markerPad, desiredMarkerY));

    const tone = isValid
      ? (isLightTheme()
        ? {
          line: "rgba(63,84,184,.9)",
          fill: "rgba(246,248,255,.96)",
          glyph: "rgba(48,68,168,.96)",
          dot: "rgba(56,78,177,.9)",
        }
        : {
          line: "rgba(229,232,240,.92)",
          fill: "rgba(27,31,42,.9)",
          glyph: "rgba(236,238,246,.94)",
          dot: "rgba(233,235,243,.9)",
        })
      : (isLightTheme()
        ? {
          line: "rgba(158,56,84,.9)",
          fill: "rgba(255,241,246,.96)",
          glyph: "rgba(153,47,77,.95)",
          dot: "rgba(156,55,83,.88)",
        }
        : {
          line: "rgba(205,122,147,.92)",
          fill: "rgba(50,30,38,.9)",
          glyph: "rgba(223,154,174,.94)",
          dot: "rgba(212,138,162,.9)",
        });

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([Math.max(2, cell * 0.12), Math.max(2, cell * 0.11)]);
    ctx.strokeStyle = tone.line;
    ctx.lineWidth = Math.max(1, 1.25 * dpr);
    ctx.beginPath();
    ctx.moveTo(markerX, markerY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(markerX, markerY, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = tone.fill;
    ctx.fill();
    ctx.strokeStyle = tone.line;
    ctx.lineWidth = Math.max(1, 1.35 * dpr);
    ctx.stroke();

    const mark = markerRadius * 0.45;
    ctx.strokeStyle = tone.glyph;
    ctx.lineWidth = Math.max(1, 1.25 * dpr);
    ctx.beginPath();
    if (isValid){
      ctx.moveTo(markerX - mark, markerY);
      ctx.lineTo(markerX + mark, markerY);
      ctx.moveTo(markerX, markerY - mark);
      ctx.lineTo(markerX, markerY + mark);
    } else {
      ctx.moveTo(markerX - mark, markerY - mark);
      ctx.lineTo(markerX + mark, markerY + mark);
      ctx.moveTo(markerX + mark, markerY - mark);
      ctx.lineTo(markerX - mark, markerY + mark);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, Math.max(2, cell * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = tone.dot;
    ctx.fill();
    ctx.restore();
  }

  function draw(){
    const now = performance.now();
    const prev = draw._prevTime || now;
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    draw._prevTime = now;

    ctx.clearRect(0,0,elBoard.width, elBoard.height);

    drawBoardPlaySpace(now);

    // starting corners
    for (let p=0;p<players.length;p++){
      const c = playerCorner(p);
      const playerColor = getThemeColorByIndex(p);
      const pulse = 0.5 + (0.18 * (0.5 + 0.5 * Math.sin((now * 0.0026) + (p * 0.8))));
      const marker = boardBubbleRect(c.x, c.y, 0.13);
      ctx.save();
      roundedRectPath(ctx, marker.x, marker.y, marker.size, marker.size, marker.radius);
      ctx.fillStyle = hexToRgba(playerColor, isLightTheme() ? (0.28 + (0.14 * pulse)) : (0.2 + (0.13 * pulse)));
      ctx.fill();
      ctx.strokeStyle = hexToRgba(playerColor, isLightTheme() ? (0.72 + (0.16 * pulse)) : (0.62 + (0.18 * pulse)));
      ctx.lineWidth = Math.max(1, 1.05 * dpr);
      ctx.stroke();
      ctx.restore();
    }

    // placed pieces
    for (let y=0;y<N;y++){
      for (let x=0;x<N;x++){
        const v = board[y][x];
        if (v === -1) continue;
        const px = cellToPx(x,y);
        drawBevelSquare(
          ctx,
          px.x,
          px.y,
          cell,
          getThemeColorByIndex(v),
          0.95,
          0.18,
          {
            theme: visualTheme,
            patternType: getThemePatternByIndex(v),
            playerIdx: v,
          }
        );
      }
    }

    drawPlacementBursts(now);

    if (hoverCell){
      hoverSmooth.x = hoverCell.x;
      hoverSmooth.y = hoverCell.y;
      hoverSmooth.alpha = approach(hoverSmooth.alpha, 1, 13, dt);
    } else {
      hoverSmooth.alpha = approach(hoverSmooth.alpha, 0, 10, dt);
    }

    drawGridFocusLines(now);

    // hover preview
    if (hoverCell && selectedPieceId){
      const p = players[current];
      const themeColor = getThemeColorByIndex(current);
      const themePattern = getThemePatternByIndex(current);
      const piece = getPiece(selectedPieceId);
      if (piece && !p.used.has(piece.id)){
        const tf = transformCells(piece.cells, rotation, flipped);
        const anchorX = hoverCell.x - tf.grab.x;
        const anchorY = hoverCell.y - tf.grab.y;
        const v = validatePlacement(p.idx, tf.cells, anchorX, anchorY);

        const ghostKey = `${current}|${piece.id}|${rotation}|${flipped ? 1 : 0}`;
        if (!ghostAnchor.active || ghostAnchor.key !== ghostKey){
          ghostAnchor = { x:anchorX, y:anchorY, alpha:0, key:ghostKey, active:true };
        }
        ghostAnchor.x = approach(ghostAnchor.x, anchorX, 24, dt);
        ghostAnchor.y = approach(ghostAnchor.y, anchorY, 24, dt);
        ghostAnchor.alpha = approach(ghostAnchor.alpha, 1, 16, dt);

        const ghostPulse = 0.08 + (0.08 * (0.5 + 0.5 * Math.sin(now * 0.014)));
        ctx.save();
        for (const c of tf.cells){
          const x = anchorX + c.x;
          const y = anchorY + c.y;
          const px = origin.x + (ghostAnchor.x + c.x) * cell;
          const py = origin.y + (ghostAnchor.y + c.y) * cell;
          if (px + cell < -2 || py + cell < -2 || px > elBoard.width + 2 || py > elBoard.height + 2) continue;
          const inside = inBounds(x,y);
          const alpha = inside
            ? (v.ok ? (0.42 + ghostPulse) : (0.16 + ghostPulse * 0.35))
            : (0.22 + (ghostPulse * 0.22));
          drawBevelSquare(
            ctx,
            px,
            py,
            cell,
            inside ? themeColor : (isLightTheme() ? "#9F3F55" : "#A14A65"),
            alpha * ghostAnchor.alpha,
            0.18,
            {
              theme: visualTheme,
              patternType: inside ? themePattern : null,
              playerIdx: current,
            }
          );

          if (!inside){
            ctx.save();
            ctx.globalAlpha = 0.65 * ghostAnchor.alpha;
            ctx.strokeStyle = isLightTheme() ? "rgba(143,52,80,.9)" : "rgba(176,84,112,.9)";
            ctx.lineWidth = Math.max(1, 1.2 * dpr);
            ctx.setLineDash([Math.max(2, cell * 0.12), Math.max(2, cell * 0.11)]);
            roundedRectPath(
              ctx,
              px + 1.5,
              py + 1.5,
              Math.max(1, cell - 3),
              Math.max(1, cell - 3),
              Math.max(2, (cell - 3) * 0.2)
            );
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(px + (cell * 0.24), py + (cell * 0.24));
            ctx.lineTo(px + (cell * 0.76), py + (cell * 0.76));
            ctx.moveTo(px + (cell * 0.76), py + (cell * 0.24));
            ctx.lineTo(px + (cell * 0.24), py + (cell * 0.76));
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();

        // outline
        ctx.save();
        ctx.globalAlpha = (v.ok ? 0.95 : 0.88) * ghostAnchor.alpha;
        ctx.strokeStyle = v.ok
          ? (isLightTheme() ? "rgba(51,74,172,.92)" : "rgba(230,232,238,.94)")
          : (isLightTheme() ? "rgba(150,49,79,.9)" : "rgba(176,84,112,.9)");
        ctx.lineWidth = Math.max(1, (v.ok ? 1.9 : 2.15) * dpr);
        for (const c of tf.cells){
          const x = anchorX + c.x;
          const y = anchorY + c.y;
          const px = origin.x + (ghostAnchor.x + c.x) * cell;
          const py = origin.y + (ghostAnchor.y + c.y) * cell;
          if (px + cell < -2 || py + cell < -2 || px > elBoard.width + 2 || py > elBoard.height + 2) continue;
          if (!inBounds(x,y)) continue;
          roundedRectPath(
            ctx,
            px + 1.5,
            py + 1.5,
            Math.max(1, cell - 3),
            Math.max(1, cell - 3),
            Math.max(2, (cell - 3) * 0.22)
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      ghostAnchor.alpha = approach(ghostAnchor.alpha, 0, 10, dt);
      if (ghostAnchor.alpha < 0.03) ghostAnchor.active = false;
    }

    drawTouchPlacementAssist();
    requestAnimationFrame(draw);
  }

  const turnActions = createTurnActions({
    getPlayers: () => players,
    getBoard: () => board,
    getCurrent: () => current,
    setCurrent: (v) => {
      current = v;
    },
    getMoveHistory: () => moveHistory,
    getConsecutivePasses: () => consecutivePasses,
    setConsecutivePasses: (v) => {
      consecutivePasses = v;
    },
    getPiece,
    inBounds,
    findBestBotMove,
    playerHasAnyMove,
    addPlacementBursts,
    pulseClass,
    stageFrameEl: elStageFrame,
    toast,
    playSfx,
    rebuildPieceGrid,
    rebuildScoreboard,
    syncTurnControls,
    scheduleBotTurn,
    clearBotTurnTimer,
    setStatus,
    keyHint,
    playerLabel,
    resetSelection,
    endGame,
    saveGameState,
    isBlockingModalOpen: () => (
      isGameOverModalOpen() ||
      isSetupModalOpen() ||
      isConfirmModalOpen()
    ),
    setUndoDisabled: (disabled) => {
      if (btnUndo) btnUndo.disabled = disabled;
    },
  });
  const {
    applyPlacement,
    executeBotTurn,
    passTurn,
    undo,
  } = turnActions;

  // ---------- Events ----------
  const inputHandlers = createInputHandlers({
    elBoard,
    getDpr: () => dpr,
    boardToCell,
    setHoverCell: (nextCell) => {
      hoverCell = nextCell;
    },
    getHoverCell: () => hoverCell,
    getSelectedPieceId: () => selectedPieceId,
    hoverMoveSfx,
    playSfx,
    getPlayers: () => players,
    getCurrent: () => current,
    toast,
    setStatus,
    keyHint,
    pulseClass,
    getPiece,
    transformCells,
    getRotation: () => rotation,
    getFlipped: () => flipped,
    validatePlacement,
    applyPlacement,
    isConfirmModalOpen,
    isSetupModalOpen,
    isGameOverModalOpen,
    hideNewGameConfirmModal,
    hideSetupModal,
    hideModal,
    clearSelection: resetSelection,
    rebuildPieceGrid,
    rotateSelection,
    flipSelection,
    setTouchAssist: ({ pointerId, px, py }) => {
      touchAssist.active = true;
      touchAssist.pointerId = pointerId;
      touchAssist.px = px;
      touchAssist.py = py;
    },
    clearTouchAssist: () => {
      touchAssist.active = false;
      touchAssist.pointerId = null;
      touchAssist.px = 0;
      touchAssist.py = 0;
    },
  });
  const {
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClickBoard,
    onKeyDown,
  } = inputHandlers;

  function newGame(opts = {}){
    const force = opts.force === true;
    if (!force){
      requestNewGameConfirmation(() => {
        newGame({ ...opts, force:true });
      });
      return;
    }
    clearBotTurnTimer();

    const legacyModes = Array.isArray(opts.humanMask)
      ? opts.humanMask.map((isHuman) => isHuman ? PLAYER_MODE_HUMAN : PLAYER_MODE_BOT)
      : null;
    const playerModes = normalizePlayerModes(
      opts.playerModes,
      legacyModes || configuredPlayerModes
    );
    configuredPlayerModes = playerModes;

    board = makeBoard(N);
    players = makePlayers(TOTAL_PLAYERS, 0);
    applyPlayerModesToPlayers(configuredPlayerModes);
    current = firstActivePlayerIndex(players);
    selectedPieceId = null;
    rotation = 0;
    flipped = false;
    moveHistory = [];
    consecutivePasses = 0;
    resetTransientState();

    hideModal();
    hideSetupModal();
    hideNewGameConfirmModal();

    rebuildPieceGrid();
    rebuildScoreboard();
    syncTurnControls();
    if (players[current]?.isBot){
      setStatus(`New game. ${players[current].name} bot to move.`);
    } else {
      setStatus(`New game. ${players[current].name} to move. ${keyHint()}`);
    }
    toast("New game.", "good");
    playSfx("new");
    btnUndo.disabled = true;
    scheduleBotTurn(520);
    saveGameState();
  }

  // ---------- Wire up ----------
  function init(){
    applyVisualTheme(readStoredVisualTheme(), { persist:false, refresh:false });
    loadMusicEnabled();
    loadMusicVolume();
    loadSfxVolume();
    const shouldEnableMusic = audio.getMusicVolume() > 0.001;
    if (audio.getMusicEnabled() !== shouldEnableMusic){
      setMusicEnabled(shouldEnableMusic, { quiet:true, persist:false });
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("scroll", scheduleMobileScrollCueUpdate, { passive:true });
    if (window.visualViewport){
      window.visualViewport.addEventListener("resize", scheduleMobileScrollCueUpdate);
    }

    elBoard.addEventListener("pointermove", onPointerMove);
    elBoard.addEventListener("pointerleave", onPointerLeave);
    elBoard.addEventListener("pointerdown", (e) => {
      elBoard.setPointerCapture?.(e.pointerId);
      if (e.pointerType === "touch") e.preventDefault();
      onPointerDown(e);
    });
    elBoard.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") e.preventDefault();
      onPointerUp(e);
    });
    elBoard.addEventListener("pointercancel", onPointerCancel);
    elBoard.addEventListener("click", onClickBoard);

    if (btnThemeToggle){
      btnThemeToggle.addEventListener("click", () => {
        const nextTheme = isLightTheme() ? VISUAL_THEME_DARK : VISUAL_THEME_LIGHT;
        applyVisualTheme(nextTheme, { persist:true, refresh:true });
      });
      btnThemeToggle.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter"){
          event.preventDefault();
          btnThemeToggle.click();
        }
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== VISUAL_THEME_KEY) return;
      applyVisualTheme(normalizeVisualTheme(event.newValue), { persist:false, refresh:true });
    });

    if (inputMusicVolume){
      inputMusicVolume.addEventListener("input", (e) => {
        const next = clampVolume(Number(e.target.value) / 100);
        setMusicVolume(next, { quiet:true, persist:false });
        if (next > 0.001 && !audio.getMusicEnabled()){
          setMusicEnabled(true, { quiet:true, persist:false });
        }
      });
      inputMusicVolume.addEventListener("change", () => {
        setMusicVolume(audio.getMusicVolume(), { quiet:true, persist:true });
        toast(`Music ${volumePct(audio.getMusicVolume())}%.`, "good");
      });
    }
    if (inputSfxVolume){
      inputSfxVolume.addEventListener("input", (e) => {
        const next = clampVolume(Number(e.target.value) / 100);
        setSfxVolume(next, { quiet:true, persist:false });
      });
      inputSfxVolume.addEventListener("change", () => {
        setSfxVolume(audio.getSfxVolume(), { quiet:true, persist:true });
        toast(`SFX ${volumePct(audio.getSfxVolume())}%.`, audio.getSfxVolume() > 0.001 ? "good" : "warn");
        if (audio.getSfxVolume() > 0.001) playSfx("ui");
      });
    }
    if (btnRotateLeft){
      btnRotateLeft.addEventListener("click", () => rotateSelection(-1));
    }
    if (btnRotateRight){
      btnRotateRight.addEventListener("click", () => rotateSelection(1));
    }
    if (btnFlip){
      btnFlip.addEventListener("click", flipSelection);
    }
    setupHumanButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = toInt(btn.dataset.player, -1);
        if (idx < 0 || idx >= TOTAL_PLAYERS) return;
        const modes = getSetupPlayerModes();
        const currentMode = modes[idx];
        let nextMode = nextPlayerMode(currentMode);
        if (nextMode === PLAYER_MODE_OFF){
          const enabledCount = modes.filter((mode) => mode !== PLAYER_MODE_OFF).length;
          if (enabledCount <= 2){
            // Avoid trapping an active color on "Bot" when only two colors remain.
            nextMode = PLAYER_MODE_HUMAN;
          }
        }
        modes[idx] = nextMode;
        setSetupPlayerModes(modes);
      });
    });
    btnNew.addEventListener("click", openSetupForNewGame);
    btnPass.addEventListener("click", passTurn);
    btnUndo.addEventListener("click", undo);

    [btnRotateLeft, btnRotateRight, btnFlip, btnNew, btnPass, btnUndo, modalClose, modalNew, setupClose, setupStart, confirmClose, confirmCancel, confirmProceed].filter(Boolean).forEach((btn) => {
      btn.addEventListener("pointerdown", () => pulseClass(btn, "flash-press", 220));
    });

    modalClose.addEventListener("click", hideModal);
    modalNew.addEventListener("click", openSetupForNewGame);
    modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
    if (setupClose) setupClose.addEventListener("click", hideSetupModal);
    if (setupStart) setupStart.addEventListener("click", startConfiguredGameFromSetup);
    if (setupModal){
      setupModal.addEventListener("click", (e) => {
        if (e.target === setupModal) hideSetupModal();
      });
    }
    if (confirmClose) confirmClose.addEventListener("click", () => hideNewGameConfirmModal());
    if (confirmCancel) confirmCancel.addEventListener("click", () => hideNewGameConfirmModal());
    if (confirmProceed) confirmProceed.addEventListener("click", () => hideNewGameConfirmModal({ runAction:true }));
    if (confirmModal){
      confirmModal.addEventListener("click", (e) => {
        if (e.target === confirmModal) hideNewGameConfirmModal();
      });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", ensureAudioReady, {passive:true});
    window.addEventListener("keydown", ensureAudioReady);
    window.addEventListener("beforeunload", saveGameState);

    const restored = restoreSavedGameState();
    rebuildPieceGrid();
    rebuildScoreboard();
    syncTurnControls();
    setSetupPlayerModes(configuredPlayerModes, { quiet:true });
    btnUndo.disabled = moveHistory.length === 0;

    if (restored){
      if (restored.statusText){
        setStatus(restored.statusText, restored.statusTone);
      } else {
        const tone = (players[current] && !players[current].isBot && !playerHasAnyMove(current)) ? "warn" : "neutral";
        setStatus(defaultTurnStatus(), tone);
      }
      if (restored.gameOver){
        endGame();
      } else {
        scheduleBotTurn(320);
        toast("Resumed saved game.", "good");
      }
    } else {
      setStatus(`Pick a piece to begin. ${keyHint()}`);
      saveGameState();
    }

    scheduleMobileScrollCueUpdate();
    requestAnimationFrame(draw);
  }

  init();
})();
