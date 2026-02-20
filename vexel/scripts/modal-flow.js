export function createModalFlow(deps = {}){
  const {
    modal = null,
    modalTitle = null,
    modalBody = null,
    setupModal = null,
    confirmModal = null,
    setupSummary = null,
    totalPlayers = 4,
    playerColorLabels = [],
    getSetupPlayerModes = () => [],
    setSetupPlayerModes = () => [],
    getConfiguredPlayerModes = () => [],
    setConfiguredPlayerModes = () => {},
    getDefaultPlayerModes = null,
    normalizePlayerModes = (modes) => modes,
    clearBotTurnTimer = () => {},
    scheduleBotTurn = () => {},
    saveGameState = () => {},
    playSfx = () => {},
    getHasGameProgress = () => false,
    startNewGame = () => {},
    computeScores = () => [],
    getPlayers = () => [],
  } = deps;

  let pendingNewGameConfirmAction = null;

  function updateSetupSummary(){
    if (!setupSummary) return;
    const playerModes = getSetupPlayerModes();
    const humans = playerModes.filter((mode) => mode === "human").length;
    const bots = playerModes.filter((mode) => mode === "bot").length;
    const off = totalPlayers - humans - bots;
    const picked = playerModes
      .map((mode, idx) => mode === "human" ? playerColorLabels[idx] : null)
      .filter(Boolean)
      .join(", ");
    setupSummary.textContent = `Players ${humans} (${picked || "none"}) | Bots ${bots} | Off ${off}`;
  }

  function showModal(){
    if (!modal) return;
    clearBotTurnTimer();
    if (confirmModal){
      confirmModal.hidden = true;
      pendingNewGameConfirmAction = null;
    }
    modal.hidden = false;
    saveGameState();
  }

  function hideModal(){
    if (!modal) return;
    modal.hidden = true;
    saveGameState();
  }

  function showSetupModal(){
    if (!setupModal) return;
    clearBotTurnTimer();
    hideModal();
    if (confirmModal){
      confirmModal.hidden = true;
      pendingNewGameConfirmAction = null;
    }
    const configuredModes = getConfiguredPlayerModes();
    const defaultModes = (typeof getDefaultPlayerModes === "function")
      ? getDefaultPlayerModes()
      : configuredModes;
    setSetupPlayerModes(normalizePlayerModes(defaultModes, configuredModes), { quiet:true });
    setupModal.hidden = false;
  }

  function hideSetupModal(){
    if (!setupModal) return;
    setupModal.hidden = true;
    scheduleBotTurn(220);
  }

  function showNewGameConfirmModal(onProceed){
    if (!confirmModal){
      if (typeof onProceed === "function") onProceed();
      return;
    }
    clearBotTurnTimer();
    pendingNewGameConfirmAction = typeof onProceed === "function" ? onProceed : null;
    confirmModal.hidden = false;
  }

  function hideNewGameConfirmModal(opts = {}){
    if (!confirmModal) return;
    const runAction = opts.runAction === true;
    confirmModal.hidden = true;

    const action = pendingNewGameConfirmAction;
    pendingNewGameConfirmAction = null;

    if (runAction && typeof action === "function"){
      action();
      return;
    }
    scheduleBotTurn(220);
  }

  function requestNewGameConfirmation(onProceed){
    if (!getHasGameProgress()){
      if (typeof onProceed === "function") onProceed();
      return;
    }
    showNewGameConfirmModal(onProceed);
  }

  function openSetupForNewGame(){
    requestNewGameConfirmation(() => {
      showSetupModal();
    });
  }

  function startConfiguredGameFromSetup(){
    const playerModes = getSetupPlayerModes();
    const configuredPlayerModes = normalizePlayerModes(playerModes, getConfiguredPlayerModes());
    setConfiguredPlayerModes(configuredPlayerModes);
    hideSetupModal();
    startNewGame({ force:true, playerModes: configuredPlayerModes });
  }

  function endGame(){
    if (!modalTitle || !modalBody) return;
    const scores = computeScores();
    const activePlayers = getPlayers().filter((p) => !p.isOff);

    modalTitle.textContent = "GAME OVER";
    const rows = scores.map((s, i) => `
      <tr>
        <td>${i+1}</td>
        <td><span class="resultPlayer">
          <span class="resultSwatch" data-player-idx="${s.idx}"></span>
          <strong>${s.name}${s.isBot ? " BOT" : ""}</strong>
        </span></td>
        <td>${s.score}</td>
        <td>${s.remaining}</td>
      </tr>
    `).join("");

    modalBody.innerHTML = `
      <p class="resultsLead">
        Ended after <strong>${activePlayers.length}</strong> consecutive passes.
      </p>
      <table class="table">
        <thead>
          <tr><th>#</th><th>Player</th><th>Score</th><th>Squares left</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="resultsNote">
        Scoring: -1 per unplaced square. If you place all pieces: +15 (and +5 more if your last piece was the single square).
      </p>
    `;

    showModal();
    playSfx("end");
    saveGameState();
  }

  function isConfirmModalOpen(){
    return !!confirmModal && confirmModal.hidden === false;
  }

  function isSetupModalOpen(){
    return !!setupModal && setupModal.hidden === false;
  }

  function isGameOverModalOpen(){
    return !!modal && modal.hidden === false;
  }

  return {
    updateSetupSummary,
    showModal,
    hideModal,
    showSetupModal,
    hideSetupModal,
    showNewGameConfirmModal,
    hideNewGameConfirmModal,
    requestNewGameConfirmation,
    openSetupForNewGame,
    startConfiguredGameFromSetup,
    endGame,
    isConfirmModalOpen,
    isSetupModalOpen,
    isGameOverModalOpen,
  };
}
