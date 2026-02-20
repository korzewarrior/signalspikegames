import { N, PIECES, START_CORNERS } from "./constants.js";
import { transformCells, shuffled } from "./utils.js";

export function createGameLogic(deps = {}){
  const {
    getBoard = () => [],
    getPlayers = () => [],
  } = deps;

  function getPiece(id){
    return PIECES.find((p) => p.id === id) || null;
  }

  function playerCorner(pIdx){
    return START_CORNERS[pIdx];
  }

  function inBounds(x,y){
    return x >= 0 && y >= 0 && x < N && y < N;
  }

  function validatePlacement(pIdx, pieceCells, anchorX, anchorY){
    const board = getBoard();
    const players = getPlayers();
    const player = players[pIdx];

    const res = { ok:true, reasons:[], coversCorner:false, diagTouch:false };
    if (!player || player.isOff){
      res.ok = false;
      res.reasons.push("Player is off.");
      return res;
    }
    const corner = playerCorner(pIdx);

    for (const c of pieceCells){
      const x = anchorX + c.x;
      const y = anchorY + c.y;
      if (!inBounds(x,y)){
        res.ok = false;
        res.reasons.push("Out of bounds.");
        return res;
      }
      if (board[y][x] !== -1){
        res.ok = false;
        res.reasons.push("Overlaps an occupied cell.");
        return res;
      }
    }

    const isFirst = !player.hasPlayed;

    for (const c of pieceCells){
      const x = anchorX + c.x;
      const y = anchorY + c.y;

      if (isFirst && x === corner.x && y === corner.y){
        res.coversCorner = true;
      }

      const edges = [
        {x:x+1, y}, {x:x-1, y}, {x, y:y+1}, {x, y:y-1},
      ];
      for (const n of edges){
        if (inBounds(n.x,n.y) && board[n.y][n.x] === pIdx){
          res.ok = false;
          res.reasons.push("Illegal: touches your piece by an edge.");
          return res;
        }
      }

      const diags = [
        {x:x+1,y:y+1},{x:x-1,y:y+1},{x:x+1,y:y-1},{x:x-1,y:y-1},
      ];
      for (const n of diags){
        if (inBounds(n.x,n.y) && board[n.y][n.x] === pIdx){
          res.diagTouch = true;
        }
      }
    }

    if (isFirst){
      if (!res.coversCorner){
        res.ok = false;
        res.reasons.push("First move must cover your corner.");
      }
      return res;
    }

    if (!res.diagTouch){
      res.ok = false;
      res.reasons.push("Must touch your pieces by a corner (diagonal).");
    }
    return res;
  }

  function playerHasAnyMove(pIdx){
    const players = getPlayers();
    const player = players[pIdx];
    if (!player || player.isOff) return false;
    for (const piece of PIECES){
      if (player.used.has(piece.id)) continue;
      for (let rot = 0; rot < 4; rot++){
        for (let flip = 0; flip < 2; flip++){
          const tf = transformCells(piece.cells, rot, !!flip);
          for (let y = -tf.h; y < N + tf.h; y++){
            for (let x = -tf.w; x < N + tf.w; x++){
              const v = validatePlacement(pIdx, tf.cells, x, y);
              if (v.ok) return true;
            }
          }
        }
      }
    }
    return false;
  }

  function scoreBotMove(pIdx, piece, pieceCells, anchorX, anchorY){
    const board = getBoard();
    const players = getPlayers();
    const p = players[pIdx];
    const frontier = new Set();
    let opponentEdgeContacts = 0;
    let edgePenalty = 0;
    let sumX = 0;
    let sumY = 0;

    for (const c of pieceCells){
      const x = anchorX + c.x;
      const y = anchorY + c.y;
      sumX += x;
      sumY += y;

      if (x === 0 || y === 0 || x === (N - 1) || y === (N - 1)){
        edgePenalty += 1;
      }

      const edges = [
        {x:x+1, y}, {x:x-1, y}, {x, y:y+1}, {x, y:y-1},
      ];
      for (const n of edges){
        if (!inBounds(n.x, n.y)) continue;
        const owner = board[n.y][n.x];
        if (owner !== -1 && owner !== pIdx){
          opponentEdgeContacts += 1;
        }
      }

      const diags = [
        {x:x+1, y:y+1},
        {x:x-1, y:y+1},
        {x:x+1, y:y-1},
        {x:x-1, y:y-1},
      ];
      for (const n of diags){
        if (!inBounds(n.x, n.y) || board[n.y][n.x] !== -1) continue;

        const touchesOwnEdge =
          (inBounds(n.x + 1, n.y) && board[n.y][n.x + 1] === pIdx) ||
          (inBounds(n.x - 1, n.y) && board[n.y][n.x - 1] === pIdx) ||
          (inBounds(n.x, n.y + 1) && board[n.y + 1][n.x] === pIdx) ||
          (inBounds(n.x, n.y - 1) && board[n.y - 1][n.x] === pIdx);

        if (!touchesOwnEdge){
          frontier.add(`${n.x},${n.y}`);
        }
      }
    }

    const cx = sumX / pieceCells.length;
    const cy = sumY / pieceCells.length;
    const boardCenter = (N - 1) * 0.5;
    const turnsTaken = p ? p.used.size : 0;
    const earlyGame = turnsTaken < 6;
    const centerBias = -(Math.abs(cx - boardCenter) + Math.abs(cy - boardCenter));
    const corner = playerCorner(pIdx);
    const cornerDistance = Math.abs(cx - corner.x) + Math.abs(cy - corner.y);
    const sizeWeight = earlyGame ? 360 : 250;
    const frontierWeight = earlyGame ? 20 : 13;
    const opponentWeight = earlyGame ? 1.6 : 2.8;
    const randomness = (Math.random() - 0.5) * (earlyGame ? 34 : 26);

    return (piece.size * sizeWeight) +
      (frontier.size * frontierWeight) +
      (opponentEdgeContacts * opponentWeight) +
      (centerBias * (earlyGame ? 1.05 : 0.7)) +
      (cornerDistance * (earlyGame ? 0.95 : 0.35)) -
      (edgePenalty * (earlyGame ? 0.9 : 0.55)) +
      randomness;
  }

  function findBestBotMove(pIdx){
    const players = getPlayers();
    const p = players[pIdx];
    if (!p || p.isOff) return null;

    const topMoves = [];
    const piecePool = shuffled(PIECES.filter((piece) => !p.used.has(piece.id)));
    for (const piece of piecePool){
      const rotations = shuffled([0, 1, 2, 3]);
      const flipOrder = Math.random() < 0.5 ? [0, 1] : [1, 0];
      for (const rot of rotations){
        for (const flip of flipOrder){
          const tf = transformCells(piece.cells, rot, !!flip);
          for (let y = (-tf.h + 1); y < N; y++){
            for (let x = (-tf.w + 1); x < N; x++){
              const v = validatePlacement(pIdx, tf.cells, x, y);
              if (!v.ok) continue;
              const score = scoreBotMove(pIdx, piece, tf.cells, x, y);
              topMoves.push({
                pieceId: piece.id,
                pieceSize: piece.size,
                cells: tf.cells,
                anchorX: x,
                anchorY: y,
                score,
              });
              topMoves.sort((a, b) => b.score - a.score);
              if (topMoves.length > 14){
                topMoves.length = 14;
              }
            }
          }
        }
      }
    }

    if (topMoves.length === 0) return null;
    if (topMoves.length === 1) return topMoves[0];

    const bestScore = topMoves[0].score;
    const temperature = Math.max(6, 20 - (p.used.size * 1.3));
    const weighted = topMoves.map((move) => {
      const delta = move.score - bestScore;
      return { move, weight: Math.exp(delta / temperature) };
    });

    let total = 0;
    for (const entry of weighted){
      total += entry.weight;
    }
    let pick = Math.random() * total;
    for (const entry of weighted){
      pick -= entry.weight;
      if (pick <= 0){
        return entry.move;
      }
    }
    return weighted[weighted.length - 1].move;
  }

  function computeScores(){
    const players = getPlayers();
    const scores = players.filter((p) => !p.isOff).map((p) => {
      let remaining = 0;
      for (const piece of PIECES){
        if (!p.used.has(piece.id)) remaining += piece.size;
      }
      let score = -remaining;
      if (remaining === 0){
        score += 15;
        if (p.lastPieceSize === 1) score += 5;
      }
      return { idx:p.idx, name:p.name, color:p.color, score, remaining, isBot:p.isBot };
    });
    scores.sort((a,b) => b.score - a.score);
    return scores;
  }

  return {
    getPiece,
    playerCorner,
    inBounds,
    validatePlacement,
    playerHasAnyMove,
    findBestBotMove,
    computeScores,
  };
}
