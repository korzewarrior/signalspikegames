import { transformCells } from "./utils.js";

export function roundedRectPath(cctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  cctx.beginPath();
  cctx.moveTo(x + rr, y);
  cctx.arcTo(x + w, y, x + w, y + h, rr);
  cctx.arcTo(x + w, y + h, x, y + h, rr);
  cctx.arcTo(x, y + h, x, y, rr);
  cctx.arcTo(x, y, x + w, y, rr);
  cctx.closePath();
}

function applyPatternOverlay(cctx, x, y, w, h, radius, patternType, opts = {}){
  if (!patternType) return;

  cctx.save();
  roundedRectPath(cctx, x, y, w, h, radius);
  cctx.clip();
  cctx.strokeStyle = opts.strokeStyle || "rgba(255,255,255,.5)";
  cctx.fillStyle = opts.fillStyle || "rgba(255,255,255,.44)";
  cctx.lineWidth = Math.max(1, Math.min(w, h) * 0.06);

  const spacing = Math.max(4, Math.min(w, h) * 0.34);
  const max = Math.max(w, h) * 2;

  if (patternType === "diag-forward" || patternType === "crosshatch"){
    for (let i = -max; i <= max; i += spacing){
      cctx.beginPath();
      cctx.moveTo(x + i, y + h);
      cctx.lineTo(x + i + h, y);
      cctx.stroke();
    }
  }

  if (patternType === "diag-back" || patternType === "crosshatch"){
    for (let i = -max; i <= max; i += spacing){
      cctx.beginPath();
      cctx.moveTo(x + i, y);
      cctx.lineTo(x + i + h, y + h);
      cctx.stroke();
    }
  }

  if (patternType === "horizontal"){
    for (let yy = y + (spacing * 0.5); yy < y + h; yy += spacing){
      cctx.beginPath();
      cctx.moveTo(x, yy);
      cctx.lineTo(x + w, yy);
      cctx.stroke();
    }
  }

  if (patternType === "dots"){
    const dotStep = Math.max(5, Math.min(w, h) * 0.35);
    const dotRadius = Math.max(0.8, Math.min(w, h) * 0.08);
    for (let yy = y + dotStep * 0.5; yy < y + h; yy += dotStep){
      for (let xx = x + dotStep * 0.5; xx < x + w; xx += dotStep){
        cctx.beginPath();
        cctx.arc(xx, yy, dotRadius, 0, Math.PI * 2);
        cctx.fill();
      }
    }
  }

  cctx.restore();
}

export function drawBevelSquare(cctx, x, y, s, color, alpha = 1, bevel = 0.28, opts = {}){
  const rawTheme = opts.theme;
  const theme = rawTheme === "light" ? "light" : "dark";
  const patternType = opts.patternType || null;

  cctx.save();
  cctx.globalAlpha = alpha;

  const w = Math.max(1.5, s - 2);
  const h = Math.max(1.5, s - 2);
  const rx = x + 1;
  const ry = y + 1;
  const radius = Math.max(2, Math.min(w, h) * (0.2 + (bevel * 0.35)));
  const darkBlueprint = theme === "dark";
  roundedRectPath(cctx, rx, ry, w, h, radius);
  cctx.fillStyle = color;
  cctx.fill();

  cctx.save();
  roundedRectPath(cctx, rx, ry, w, h, radius);
  cctx.clip();
  const sheen = cctx.createLinearGradient(rx, ry, rx + w, ry + h);
  if (darkBlueprint){
    sheen.addColorStop(0, "rgba(255,255,255,.22)");
    sheen.addColorStop(0.52, "rgba(255,255,255,.05)");
    sheen.addColorStop(1, "rgba(0,0,0,.48)");
  } else {
    sheen.addColorStop(0, "rgba(255,255,255,.36)");
    sheen.addColorStop(0.52, "rgba(255,255,255,.08)");
    sheen.addColorStop(1, "rgba(20,39,112,.18)");
  }
  cctx.fillStyle = sheen;
  cctx.fillRect(rx, ry, w, h);
  applyPatternOverlay(cctx, rx, ry, w, h, radius, patternType, {
    strokeStyle: darkBlueprint ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.5)",
    fillStyle: darkBlueprint ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.44)",
  });
  cctx.restore();

  roundedRectPath(
    cctx,
    rx + 0.5,
    ry + 0.5,
    Math.max(1, w - 1),
    Math.max(1, h - 1),
    Math.max(1, radius - 0.6)
  );
  cctx.strokeStyle = darkBlueprint ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.5)";
  cctx.lineWidth = Math.max(0.8, s * 0.03);
  cctx.stroke();

  roundedRectPath(
    cctx,
    rx + 1.1,
    ry + 1.1,
    Math.max(1, w - 2.2),
    Math.max(1, h - 2.2),
    Math.max(1, radius - 1.1)
  );
  cctx.strokeStyle = darkBlueprint ? "rgba(0,0,0,.66)" : "rgba(27,45,119,.46)";
  cctx.lineWidth = Math.max(0.7, s * 0.02);
  cctx.stroke();

  cctx.restore();
}

export function drawMiniPiece(canvas, piece, color, used, opts = {}){
  const cctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  cctx.clearRect(0,0,w,h);

  const rawPreviewRotation = Number(opts.previewRotation);
  const previewRotation = Number.isFinite(rawPreviewRotation)
    ? ((Math.trunc(rawPreviewRotation) % 4) + 4) % 4
    : 0;
  const previewFlip = !!opts.previewFlip;
  const tf = transformCells(piece.cells, previewRotation, previewFlip);
  const bbW = tf.w;
  const bbH = tf.h;

  const scale = Math.min((w * 0.78) / bbW, (h * 0.78) / bbH);
  const offX = (w - bbW * scale) / 2;
  const offY = (h - bbH * scale) / 2;

  for (const c of tf.cells){
    drawBevelSquare(
      cctx,
      offX + c.x * scale,
      offY + c.y * scale,
      scale - 2,
      color,
      used ? 0.28 : 0.95,
      0.08,
      opts
    );
  }
}
