import {
  MUSIC_TICK,
  MUSIC_LOOKAHEAD,
  MUSIC_ROOTS,
  MUSIC_ARP,
  MUSIC_CHORDS,
  MUSIC_LEAD,
} from "./constants.js";
import { clamp, clampVolume, midiToFreq, volumePct } from "./utils.js";

const DEFAULT_KEYS = {
  sfxVolume: "voidline-sfx-volume-v2",
  musicEnabled: "voidline-music-enabled-v1",
  musicVolume: "voidline-music-volume-v1",
};

export function createAudioController(opts = {}){
  const {
    inputMusicVolume = null,
    inputSfxVolume = null,
    toast = () => {},
    storageKeys = {},
  } = opts;

  const keys = {
    ...DEFAULT_KEYS,
    ...storageKeys,
  };

  let sfxVolume = 0.58;
  let musicEnabled = true;
  let musicVolume = 0.72;

  let audioCtx = null;
  let audioMaster = null;
  let musicBus = null;
  let musicScheduler = null;
  let musicNextTime = 0;
  let musicStep = 0;

  function musicGainTarget(){
    return Math.max(0.0001, 0.12 * Math.pow(clampVolume(musicVolume), 1.05));
  }

  function sfxGainTarget(){
    return Math.max(0.0001, 0.24 * Math.pow(clampVolume(sfxVolume), 2));
  }

  function readCssPx(el, cssVar, fallback){
    if (!el || typeof window === "undefined" || !window.getComputedStyle) return fallback;
    const raw = window.getComputedStyle(el).getPropertyValue(cssVar).trim();
    const px = Number.parseFloat(raw);
    return Number.isFinite(px) && px > 0 ? px : fallback;
  }

  function snapSliderPct(rawPct, el){
    const pct = clamp(rawPct, 0, 100);
    if (!el) return pct;

    const segPx = readCssPx(el, "--slider-seg", 12);
    const width = el.clientWidth || el.getBoundingClientRect().width || 0;
    if (!Number.isFinite(segPx) || segPx <= 0 || !Number.isFinite(width) || width <= 0){
      return pct;
    }

    // Snap using physical pixel segment size so filled/empty bars stay phase-aligned.
    const rawPx = (pct / 100) * width;
    const snappedPx = Math.round(rawPx / segPx) * segPx;
    return clamp((clamp(snappedPx, 0, width) / width) * 100, 0, 100);
  }

  function writeChunkedSlider(el, rawPct){
    if (!el) return clamp(rawPct, 0, 100);
    const snappedPct = snapSliderPct(rawPct, el);
    const sliderPct = clamp(Math.round(snappedPct), 0, 100);
    el.value = String(sliderPct);
    el.style.setProperty("--slider-pct", `${sliderPct}%`);
    return sliderPct;
  }

  function updateMusicSlider(){
    if (!inputMusicVolume) return;
    const pct = volumePct(musicVolume);
    const snappedPct = writeChunkedSlider(inputMusicVolume, pct);
    musicVolume = clampVolume(snappedPct / 100);
  }

  function loadMusicEnabled(){
    let enabled = true;
    try {
      const raw = localStorage.getItem(keys.musicEnabled);
      if (raw !== null) enabled = raw !== "0";
    } catch (_) {}
    musicEnabled = enabled;
  }

  function saveMusicEnabled(){
    try { localStorage.setItem(keys.musicEnabled, musicEnabled ? "1" : "0"); } catch (_) {}
  }

  function setMusicVolume(next, opts = {}){
    const persist = opts.persist !== false;
    const quiet = opts.quiet === true;

    musicVolume = clampVolume(next);
    updateMusicSlider();

    if (audioCtx && musicBus){
      const now = audioCtx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setTargetAtTime(musicEnabled ? musicGainTarget() : 0.0001, now, musicEnabled ? 0.22 : 0.14);
    }

    if (persist){
      try { localStorage.setItem(keys.musicVolume, String(musicVolume.toFixed(3))); } catch (_) {}
    }

    if (!quiet && musicEnabled){
      toast(`Music ${volumePct(musicVolume)}%.`, "good");
    }
  }

  function loadMusicVolume(){
    let next = musicVolume;
    try {
      const raw = localStorage.getItem(keys.musicVolume);
      if (raw !== null){
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) next = parsed;
      }
    } catch (_) {}
    setMusicVolume(next, { persist:false, quiet:true });
  }

  function playMusicVoice(time, midi, duration, opts = {}){
    if (!audioCtx || !musicBus || !musicEnabled) return;

    const freq = midiToFreq(midi);
    const oscA = audioCtx.createOscillator();
    const oscB = audioCtx.createOscillator();
    const filt = audioCtx.createBiquadFilter();
    const amp = audioCtx.createGain();
    const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

    oscA.type = opts.waveA || "triangle";
    oscB.type = opts.waveB || "sawtooth";
    oscA.frequency.setValueAtTime(freq, time);
    oscB.frequency.setValueAtTime(freq * (opts.ratio || 1.006), time);
    oscB.detune.setValueAtTime(opts.detune || 3, time);

    filt.type = "lowpass";
    filt.frequency.setValueAtTime(opts.cutoff || 1800, time);
    filt.Q.value = opts.q || 0.62;

    const peak = Math.max(0.0001, opts.gain || 0.035);
    const atk = Math.max(0.01, opts.attack || 0.04);
    const rel = Math.max(0.03, opts.release || Math.min(0.36, duration * 0.8));
    const end = time + duration;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + atk);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + rel);

    oscA.connect(filt);
    oscB.connect(filt);
    filt.connect(amp);
    if (pan){
      pan.pan.setValueAtTime(clamp(opts.pan || 0, -1, 1), time);
      amp.connect(pan);
      pan.connect(musicBus);
    } else {
      amp.connect(musicBus);
    }

    oscA.start(time);
    oscB.start(time);
    oscA.stop(end + rel + 0.02);
    oscB.stop(end + rel + 0.02);
  }

  function playMusicKick(time, gainMul = 1){
    if (!audioCtx || !musicBus || !musicEnabled) return;
    const osc = audioCtx.createOscillator();
    const filt = audioCtx.createBiquadFilter();
    const amp = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(128, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.2);

    filt.type = "lowpass";
    filt.frequency.setValueAtTime(240, time);
    filt.Q.value = 0.6;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.017 * gainMul, time + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(filt);
    filt.connect(amp);
    amp.connect(musicBus);
    osc.start(time);
    osc.stop(time + 0.23);

    playMusicVoice(time + 0.0015, 86, MUSIC_TICK * 0.11, {
      waveA: "triangle",
      waveB: "square",
      gain: 0.0028 * gainMul,
      cutoff: 2200,
      attack: 0.0022,
      release: 0.03,
      detune: 12,
      ratio: 1.12,
    });
  }

  function playMusicSnare(time, gainMul = 1){
    playMusicVoice(time, 63, MUSIC_TICK * 0.36, {
      waveA: "square",
      waveB: "sawtooth",
      gain: 0.008 * gainMul,
      cutoff: 2200,
      attack: 0.003,
      release: 0.09,
      detune: 14,
      ratio: 1.8,
      pan: 0.03,
    });
    playMusicVoice(time + 0.01, 51, MUSIC_TICK * 0.2, {
      waveA: "triangle",
      waveB: "triangle",
      gain: 0.0045 * gainMul,
      cutoff: 760,
      attack: 0.004,
      release: 0.07,
      ratio: 1.01,
      pan: -0.02,
    });
  }

  function playMusicHat(time, open = false){
    playMusicVoice(time, 86, MUSIC_TICK * (open ? 0.46 : 0.18), {
      waveA: "square",
      waveB: "square",
      gain: open ? 0.0038 : 0.0026,
      cutoff: open ? 3000 : 3600,
      attack: 0.002,
      release: open ? 0.12 : 0.05,
      detune: 22,
      ratio: 1.5,
      pan: open ? 0.08 : -0.04,
    });
  }

  function scheduleMusicStep(step, time){
    const barStep = step % 16;
    const bar = Math.floor(step / 16);
    const root = MUSIC_ROOTS[bar % MUSIC_ROOTS.length];
    const chord = MUSIC_CHORDS[bar % MUSIC_CHORDS.length];
    const phrase = Math.floor(bar / 4) % 2;

    if (barStep === 0){
      chord.forEach((n, i) => {
        playMusicVoice(time + (i * 0.012), root + n, MUSIC_TICK * 15.4, {
          waveA: "sine",
          waveB: "triangle",
          gain: 0.014,
          cutoff: 980,
          attack: 0.2,
          release: 0.58,
          pan: -0.12 + (i * 0.08),
          ratio: 1.0013,
          detune: 1,
        });
      });
    }

    if (barStep % 4 === 0){
      const bassOffsets = [0, 7, 10, 7];
      const bassStep = (barStep / 4) % bassOffsets.length;
      const bassMidi = root - 12 + bassOffsets[bassStep];
      playMusicVoice(time, bassMidi, MUSIC_TICK * 3.2, {
        waveA: "triangle",
        waveB: "sine",
        gain: 0.015,
        cutoff: 660,
        attack: 0.016,
        release: 0.28,
        ratio: 1.002,
        detune: 1,
        pan: -0.02,
      });
      playMusicVoice(time + 0.01, bassMidi - 12, MUSIC_TICK * 2.9, {
        waveA: "sine",
        waveB: "triangle",
        gain: 0.009,
        cutoff: 460,
        attack: 0.012,
        release: 0.24,
        ratio: 1.001,
        detune: 0,
        pan: -0.05,
      });
      if (bassStep === 2){
        playMusicVoice(time + (MUSIC_TICK * 2), bassMidi + 2, MUSIC_TICK * 1.1, {
          waveA: "triangle",
          waveB: "sawtooth",
          gain: 0.005,
          cutoff: 760,
          attack: 0.008,
          release: 0.1,
          pan: 0.02,
          ratio: 1.004,
          detune: 2,
        });
      }
    }

    const arpIndex = (barStep + (bar * 2)) % MUSIC_ARP.length;
    const arp = root + 12 + MUSIC_ARP[arpIndex];
    const pan = ((barStep % 8) - 3.5) * 0.05;
    if ((barStep % 2 === 0) && barStep !== 4 && barStep !== 12){
      playMusicVoice(time, arp, MUSIC_TICK * 0.94, {
        waveA: "sawtooth",
        waveB: "triangle",
        gain: 0.012,
        cutoff: 1900,
        attack: 0.01,
        release: 0.14,
        pan,
        ratio: 1.005,
        detune: 3,
      });
    }

    if ((bar % 4 === 3) && (barStep === 8 || barStep === 12)){
      const idx = (barStep - 8) / 4;
      const lead = root + MUSIC_LEAD[idx % MUSIC_LEAD.length] + (phrase ? 0 : 12);
      playMusicVoice(time, lead, MUSIC_TICK * 1.75, {
        waveA: "triangle",
        waveB: "sine",
        gain: 0.009,
        cutoff: 2200,
        attack: 0.02,
        release: 0.22,
        pan: 0.12,
        ratio: 1.002,
        detune: 2,
      });
    }

    if (barStep === 0 || barStep === 8){
      playMusicKick(time, barStep === 0 ? 1.1 : 0.95);
    }
    if (barStep === 12){
      playMusicKick(time, 0.62);
    }
    if (barStep === 4 || barStep === 12){
      playMusicSnare(time, 0.9);
    }
    if (barStep % 4 === 3){
      playMusicHat(time, false);
    }
    if (barStep === 15){
      playMusicHat(time, true);
    }

    if (step % 16 === 8){
      playMusicVoice(time, root + 24 + (phrase ? 7 : 5), MUSIC_TICK * 0.85, {
        waveA: "triangle",
        waveB: "square",
        gain: 0.0045,
        cutoff: 2200,
        attack: 0.008,
        release: 0.09,
        pan: -0.08,
        ratio: 1.004,
        detune: 3,
      });
    }
  }

  function scheduleMusic(){
    if (!audioCtx || !musicBus || !musicEnabled) return;
    const horizon = audioCtx.currentTime + MUSIC_LOOKAHEAD;
    while (musicNextTime < horizon){
      scheduleMusicStep(musicStep, musicNextTime);
      musicStep += 1;
      musicNextTime += MUSIC_TICK;
    }
  }

  function startMusicLoop(){
    if (!audioCtx || !musicBus || !musicEnabled || musicScheduler) return;
    if (musicNextTime <= 0 || musicNextTime < audioCtx.currentTime){
      musicNextTime = audioCtx.currentTime + 0.08;
    }
    scheduleMusic();
    musicScheduler = setInterval(scheduleMusic, 120);
  }

  function stopMusicLoop(){
    if (musicScheduler){
      clearInterval(musicScheduler);
      musicScheduler = null;
    }
  }

  function setMusicEnabled(next, opts = {}){
    const persist = opts.persist !== false;
    const quiet = opts.quiet === true;
    musicEnabled = !!next;
    if (persist) saveMusicEnabled();

    if (audioCtx && musicBus){
      const now = audioCtx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setTargetAtTime(musicEnabled ? musicGainTarget() : 0.0001, now, musicEnabled ? 0.42 : 0.16);
    }
    if (musicEnabled){
      startMusicLoop();
    } else {
      stopMusicLoop();
    }

    if (!quiet){
      toast(`Music ${musicEnabled ? "on" : "off"}.`, musicEnabled ? "good" : "warn");
      if (sfxVolume > 0.001) playSfx("ui");
    }
  }

  function ensureAudioReady(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    if (!audioCtx){
      audioCtx = new Ctx();
      audioMaster = audioCtx.createGain();
      audioMaster.gain.value = 1;
      audioMaster.connect(audioCtx.destination);

      musicBus = audioCtx.createGain();
      musicBus.gain.value = musicEnabled ? musicGainTarget() : 0.0001;
      musicBus.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended"){
      audioCtx.resume().catch(() => {});
    }

    if (musicEnabled){
      startMusicLoop();
    } else {
      stopMusicLoop();
    }
    return true;
  }

  function setSfxVolume(next, opts = {}){
    const persist = opts.persist !== false;
    const quiet = opts.quiet === true;

    sfxVolume = clampVolume(next);
    if (inputSfxVolume){
      const pct = volumePct(sfxVolume);
      const snappedPct = writeChunkedSlider(inputSfxVolume, pct);
      sfxVolume = clampVolume(snappedPct / 100);
    }

    if (persist){
      try { localStorage.setItem(keys.sfxVolume, String(sfxVolume.toFixed(3))); } catch (_) {}
    }

    if (!quiet){
      toast(`SFX ${volumePct(sfxVolume)}%.`, sfxVolume > 0.001 ? "good" : "warn");
    }
  }

  function loadSfxVolume(){
    let next = sfxVolume;
    try {
      const raw = localStorage.getItem(keys.sfxVolume);
      if (raw !== null){
        const parsed = Number(raw);
        if (Number.isFinite(parsed)){
          next = parsed;
        }
      }
    } catch (_) {}

    setSfxVolume(next, { persist:false, quiet:true });
  }

  function playTone(opts = {}){
    if (sfxVolume <= 0.001) return;
    if (!ensureAudioReady() || !audioCtx || !audioMaster) return;

    const now = audioCtx.currentTime;
    const type = opts.type || "triangle";
    const freq = Math.max(40, opts.freq || 440);
    const freqEnd = Math.max(40, opts.freqEnd || freq);
    const duration = Math.max(0.02, opts.duration || 0.08);
    const attack = Math.max(0.002, opts.attack || 0.005);
    const release = Math.max(0.02, opts.release || 0.06);
    const volume = clamp(opts.volume ?? 1, 0, 2);
    const panValue = clamp(opts.pan ?? 0, -1, 1);
    const detune = opts.detune || 0;

    const osc = audioCtx.createOscillator();
    const filt = audioCtx.createBiquadFilter();
    const amp = audioCtx.createGain();
    const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    if (detune) osc.detune.setValueAtTime(detune, now);

    filt.type = "lowpass";
    filt.frequency.setValueAtTime(opts.cutoff || 3600, now);
    filt.Q.value = 0.7;

    const target = Math.max(0.0001, volume * sfxGainTarget());
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(target, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    osc.connect(filt);
    filt.connect(amp);
    if (pan){
      pan.pan.setValueAtTime(panValue, now);
      amp.connect(pan);
      pan.connect(audioMaster);
    } else {
      amp.connect(audioMaster);
    }

    osc.start(now);
    osc.stop(now + duration + release + 0.01);
  }

  function playSfx(name){
    if (sfxVolume <= 0.001) return;
    switch (name){
      case "ui":
        playTone({ type:"triangle", freq:560, freqEnd:640, duration:0.045, volume:0.6, pan:-0.05 });
        break;
      case "select":
        playTone({
          type:"sine",
          freq:250,
          freqEnd:340,
          duration:0.085,
          volume:0.52,
          pan:0.01,
          cutoff:1200,
          attack:0.01,
          release:0.12,
        });
        playTone({
          type:"sine",
          freq:170,
          freqEnd:135,
          duration:0.07,
          volume:0.2,
          pan:-0.01,
          cutoff:820,
          attack:0.009,
          release:0.1,
        });
        break;
      case "transform":
        playTone({ type:"triangle", freq:690, freqEnd:780, duration:0.05, volume:0.58 });
        break;
      case "place":
        playTone({
          type:"triangle",
          freq:240,
          freqEnd:340,
          duration:0.12,
          volume:0.56,
          pan:-0.05,
          cutoff:1050,
          attack:0.011,
          release:0.15,
        });
        playTone({
          type:"sine",
          freq:180,
          freqEnd:125,
          duration:0.105,
          volume:0.3,
          pan:0.06,
          cutoff:760,
          attack:0.012,
          release:0.16,
        });
        break;
      case "invalid":
        playTone({ type:"sawtooth", freq:210, freqEnd:120, duration:0.09, volume:0.88, cutoff:1200, release:0.09 });
        break;
      case "pass":
        playTone({ type:"triangle", freq:370, freqEnd:300, duration:0.08, volume:0.62, cutoff:1800 });
        break;
      case "turn":
        playTone({ type:"sine", freq:380, freqEnd:420, duration:0.04, volume:0.38, cutoff:2200 });
        break;
      case "undo":
        playTone({ type:"triangle", freq:520, freqEnd:320, duration:0.08, volume:0.65, cutoff:2100, pan:-0.05 });
        break;
      case "move":
        playTone({
          type:"sine",
          freq:190,
          freqEnd:170,
          duration:0.03,
          volume:0.1,
          cutoff:780,
          attack:0.005,
          release:0.045,
        });
        break;
      case "new":
        playTone({ type:"sine", freq:360, freqEnd:520, duration:0.07, volume:0.55, pan:-0.04 });
        playTone({ type:"sine", freq:520, freqEnd:760, duration:0.07, volume:0.48, pan:0.06 });
        break;
      case "end":
        playTone({ type:"triangle", freq:520, freqEnd:620, duration:0.1, volume:0.55 });
        playTone({ type:"triangle", freq:660, freqEnd:840, duration:0.12, volume:0.52, pan:0.05 });
        break;
      default:
        playTone();
        break;
    }
  }

  return {
    getMusicEnabled: () => musicEnabled,
    getMusicVolume: () => musicVolume,
    getSfxVolume: () => sfxVolume,
    loadMusicEnabled,
    loadMusicVolume,
    loadSfxVolume,
    setMusicEnabled,
    setMusicVolume,
    setSfxVolume,
    ensureAudioReady,
    playSfx,
  };
}
