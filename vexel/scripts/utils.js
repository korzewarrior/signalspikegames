import { PLAYER_NAMES, PLAYER_PIECE_COLORS } from "./constants.js";

function lerp(a,b,t){
  return a + (b - a) * t;
}

export function approach(a,b,rate,dt){
  const t = 1 - Math.exp(-rate * dt);
  return lerp(a,b,t);
}

export function clamp(v,min,max){
  return Math.max(min, Math.min(max, v));
}

export function clampVolume(v){
  return clamp(Number.isFinite(v) ? v : Number(v), 0, 1);
}

export function volumePct(v){
  return Math.round(clampVolume(v) * 100);
}

export function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function shuffled(items){
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function makeBoard(n){
  return Array.from({length:n}, () => Array.from({length:n}, () => -1));
}

export function makePlayers(k, botCount = 0){
  const clampedBotCount = clamp(Math.round(botCount), 0, k);
  const firstBotIndex = k - clampedBotCount;
  return Array.from({length:k}, (_,i) => ({
    idx: i,
    name: PLAYER_NAMES[i],
    color: PLAYER_PIECE_COLORS[i],
    isBot: i >= firstBotIndex,
    used: new Set(),
    placedCells: 0,
    hasPlayed: false,
    lastPieceSize: null,
  }));
}

export function transformCells(cells, rot, flip){
  let out = cells.map(([x,y]) => ({x, y}));
  if (flip){
    out = out.map(p => ({x: -p.x, y: p.y}));
  }
  for (let i = 0; i < rot; i++){
    out = out.map(p => ({x: p.y, y: -p.x}));
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const p of out){
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  out = out.map(p => ({x: p.x - minX, y: p.y - minY}));
  const grab = out[0] ? {x: out[0].x, y: out[0].y} : {x:0, y:0};
  let maxX = 0;
  let maxY = 0;
  for (const p of out){
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {cells: out, grab, w: maxX + 1, h: maxY + 1};
}

export function hexToRgba(hex, a){
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
