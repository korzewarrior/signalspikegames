export const N = 20;

export const PLAYER_PIECE_COLORS = ["#FF1A2E", "#43D8FF", "#BAFF58", "#BA8DFF"];
export const PLAYER_NAMES  = ["P1", "P2", "P3", "P4"];
export const TOTAL_PLAYERS = PLAYER_NAMES.length;

export const START_CORNERS = [
  {x:0,   y:0},
  {x:N-1, y:N-1},
  {x:0,   y:N-1},
  {x:N-1, y:0},
];

// 21-piece set: 1 mono, 1 domino, 2 tromino, 5 tetromino, 12 pentomino.
export const PIECES = [
  { id:"1",  name:"Mono", size:1,  cells: [[0,0]] },
  { id:"2",  name:"Domino", size:2, cells: [[0,0],[1,0]] },

  { id:"I3", name:"I3", size:3, cells: [[0,0],[1,0],[2,0]] },
  { id:"V3", name:"V3", size:3, cells: [[0,0],[0,1],[1,0]] },

  { id:"I4", name:"I4", size:4, cells: [[0,0],[1,0],[2,0],[3,0]] },
  { id:"O4", name:"O4", size:4, cells: [[0,0],[1,0],[0,1],[1,1]] },
  { id:"L4", name:"L4", size:4, cells: [[0,0],[0,1],[0,2],[1,2]] },
  { id:"T4", name:"T4", size:4, cells: [[0,0],[1,0],[2,0],[1,1]] },
  { id:"Z4", name:"Z4", size:4, cells: [[0,0],[1,0],[1,1],[2,1]] },

  { id:"F", name:"F", size:5, cells: [[1,0],[0,1],[1,1],[1,2],[2,2]] },
  { id:"I", name:"I", size:5, cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
  { id:"L", name:"L", size:5, cells: [[0,0],[0,1],[0,2],[0,3],[1,3]] },
  { id:"P", name:"P", size:5, cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] },
  { id:"N", name:"N", size:5, cells: [[0,0],[0,1],[0,2],[1,2],[1,3]] },
  { id:"T", name:"T", size:5, cells: [[0,0],[1,0],[2,0],[1,1],[1,2]] },
  { id:"U", name:"U", size:5, cells: [[0,0],[2,0],[0,1],[1,1],[2,1]] },
  { id:"V", name:"V", size:5, cells: [[0,0],[0,1],[0,2],[1,2],[2,2]] },
  { id:"W", name:"W", size:5, cells: [[0,0],[0,1],[1,1],[1,2],[2,2]] },
  { id:"X", name:"X", size:5, cells: [[1,0],[0,1],[1,1],[2,1],[1,2]] },
  { id:"Y", name:"Y", size:5, cells: [[0,0],[0,1],[0,2],[0,3],[1,1]] },
  { id:"Z", name:"Z", size:5, cells: [[0,0],[1,0],[1,1],[1,2],[2,2]] },
];

const MUSIC_TEMPO = 78;
export const MUSIC_TICK = (60 / MUSIC_TEMPO) / 4;
export const MUSIC_LOOKAHEAD = 1.4;
export const MUSIC_ROOTS = [45, 45, 50, 43, 48, 41, 43, 45];
export const MUSIC_ARP = [0, 7, 10, 12, 14, 12, 10, 7, 5, 7, 10, 12, 10, 7, 5, 3];
export const MUSIC_CHORDS = [
  [0, 3, 7, 10],
  [0, 5, 7, 10],
  [0, 3, 7, 12],
  [0, 3, 8, 10],
];
export const MUSIC_LEAD = [12, 14, 15, 14, 12, 10, 7, 5];
