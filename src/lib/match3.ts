// 7x7 match-3 board engine (pure functions).

export type GemType = 0 | 1 | 2 | 3 | 4 | 5;
// 0=武(red) 1=计(blue) 2=防(green) 3=射(purple) 4=必(yellow) 5=撤(white)

export const BOARD_SIZE = 7;

export const GEM_LABEL: Record<GemType, string> = {
  0: "武",
  1: "计",
  2: "防",
  3: "射",
  4: "必",
  5: "撤",
};

export const GEM_COLOR: Record<GemType, string> = {
  0: "#dc2626", // red
  1: "#2563eb", // blue
  2: "#16a34a", // green
  3: "#9333ea", // purple
  4: "#eab308", // yellow
  5: "#e5e7eb", // white
};

export const GEM_GLOW: Record<GemType, string> = {
  0: "#fca5a5",
  1: "#93c5fd",
  2: "#86efac",
  3: "#d8b4fe",
  4: "#fde68a",
  5: "#ffffff",
};

// Drop probability ratio: 武15 计15 防20 射10 必20 撤20
const DROP_WEIGHTS = [15, 15, 20, 10, 20, 20];
const DROP_TOTAL = DROP_WEIGHTS.reduce((a, b) => a + b, 0);

export function randomGem(rng: () => number = Math.random): GemType {
  let r = rng() * DROP_TOTAL;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    if (r < DROP_WEIGHTS[i]) return i as GemType;
    r -= DROP_WEIGHTS[i];
  }
  return 5;
}

export type Board = GemType[][]; // [row][col], row 0 = top

export function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

export function createBoard(rng: () => number = Math.random): Board {
  // Generate a board with no initial matches, guaranteed to have a move.
  for (let attempt = 0; attempt < 200; attempt++) {
    const board: Board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: GemType[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        let g: GemType;
        do {
          g = randomGem(rng);
        } while (
          // avoid creating an initial 3-in-a-row
          (c >= 2 && row[c - 1] === g && row[c - 2] === g) ||
          (r >= 2 && board[r - 1][c] === g && board[r - 2][c] === g)
        );
        row.push(g);
      }
      board.push(row);
    }
    if (findMatches(board).length === 0 && hasAnyMove(board)) {
      return board;
    }
  }
  // Fallback: just produce any board.
  const board: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: GemType[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push(randomGem(rng));
    board.push(row);
  }
  return board;
}

export interface Cell {
  r: number;
  c: number;
}
export interface MatchGroup {
  type: GemType;
  cells: Cell[];
  size: number;
}

// Find all match groups using connected-components of same-type matched cells.
export function findMatches(board: Board): MatchGroup[] {
  const matched: boolean[][] = Array.from({ length: BOARD_SIZE }, () =>
    new Array(BOARD_SIZE).fill(false),
  );
  // Horizontal runs
  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      const g = board[r][c];
      let k = c + 1;
      while (k < BOARD_SIZE && board[r][k] === g) k++;
      if (k - c >= 3) {
        for (let i = c; i < k; i++) matched[r][i] = true;
      }
      c = k;
    }
  }
  // Vertical runs
  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      const g = board[r][c];
      let k = r + 1;
      while (k < BOARD_SIZE && board[k][c] === g) k++;
      if (k - r >= 3) {
        for (let i = r; i < k; i++) matched[i][c] = true;
      }
      r = k;
    }
  }
  // Connected components among matched cells of the same type.
  const visited: boolean[][] = Array.from({ length: BOARD_SIZE }, () =>
    new Array(BOARD_SIZE).fill(false),
  );
  const groups: MatchGroup[] = [];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!matched[r][c] || visited[r][c]) continue;
      const type = board[r][c];
      const stack: Cell[] = [{ r, c }];
      const cells: Cell[] = [];
      visited[r][c] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [dr, dc] of dirs) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (
            nr < 0 ||
            nr >= BOARD_SIZE ||
            nc < 0 ||
            nc >= BOARD_SIZE
          )
            continue;
          if (visited[nr][nc] || !matched[nr][nc]) continue;
          if (board[nr][nc] !== type) continue;
          visited[nr][nc] = true;
          stack.push({ r: nr, c: nc });
        }
      }
      groups.push({ type, cells, size: cells.length });
    }
  }
  return groups;
}

export function swap(board: Board, a: Cell, b: Cell): Board {
  const nb = cloneBoard(board);
  const tmp = nb[a.r][a.c];
  nb[a.r][a.c] = nb[b.r][b.c];
  nb[b.r][b.c] = tmp;
  return nb;
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr + dc === 1;
}

// Remove matched cells, apply gravity, refill from top. Returns new board.
export function collapse(board: Board, groups: MatchGroup[], rng: () => number = Math.random): Board {
  const nb = cloneBoard(board);
  for (const g of groups) {
    for (const cell of g.cells) {
      nb[cell.r][cell.c] = -1 as unknown as GemType; // empty marker
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    const stack: GemType[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = nb[r][c] as unknown as number;
      if (v !== -1) stack.push(v as GemType);
    }
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const idx = BOARD_SIZE - 1 - r;
      if (idx < stack.length) {
        nb[r][c] = stack[idx];
      } else {
        nb[r][c] = randomGem(rng);
      }
    }
  }
  return nb;
}

// A "move" is two adjacent cells that, when swapped, produce at least one match.
export interface Move {
  a: Cell;
  b: Cell;
  groups: MatchGroup[];
  maxSize: number;
}

function testSwap(board: Board, a: Cell, b: Cell): MatchGroup[] {
  const nb = swap(board, a, b);
  return findMatches(nb);
}

export function hasAnyMove(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c + 1 < BOARD_SIZE) {
        const g = testSwap(board, { r, c }, { r, c: c + 1 });
        if (g.length) return true;
      }
      if (r + 1 < BOARD_SIZE) {
        const g = testSwap(board, { r, c }, { r: r + 1, c });
        if (g.length) return true;
      }
    }
  }
  return false;
}

export function findAllMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const candidates: Cell[] = [];
      if (c + 1 < BOARD_SIZE) candidates.push({ r, c: c + 1 });
      if (r + 1 < BOARD_SIZE) candidates.push({ r: r + 1, c });
      for (const b of candidates) {
        const groups = testSwap(board, { r, c }, b);
        if (groups.length) {
          moves.push({
            a: { r, c },
            b,
            groups,
            maxSize: Math.max(...groups.map((g) => g.size)),
          });
        }
      }
    }
  }
  return moves;
}

// Find a hint move, preferring 4/5 matches if available.
export function findHint(board: Board): Move | null {
  const moves = findAllMoves(board);
  if (!moves.length) return null;
  const big = moves.filter((m) => m.maxSize >= 4);
  const pool = big.length ? big : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

// If the board has no moves, reshuffle gems (keeping counts) until it does.
export function ensureMoveable(board: Board, rng: () => number = Math.random): Board {
  if (hasAnyMove(board)) return board;
  let nb = cloneBoard(board);
  for (let attempt = 0; attempt < 100; attempt++) {
    // flatten and shuffle
    const flat: GemType[] = [];
    for (const row of nb) for (const g of row) flat.push(g);
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    nb = [];
    let idx = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: GemType[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) row.push(flat[idx++]);
      nb.push(row);
    }
    if (findMatches(nb).length === 0 && hasAnyMove(nb)) return nb;
  }
  // Last resort: regenerate.
  return createBoard(rng);
}

// Fully resolve cascades for a board, returning cascade steps + final board.
export interface CascadeResult {
  steps: MatchGroup[][]; // matches per cascade depth
  finalBoard: Board;
  maxDepth: number;
}

export function simulateMove(board: Board, a: Cell, b: Cell, rng: () => number = Math.random): CascadeResult {
  let work = swap(board, a, b);
  const steps: MatchGroup[][] = [];
  let depth = 0;
  while (true) {
    const groups = findMatches(work);
    if (!groups.length) break;
    steps.push(groups);
    depth++;
    work = collapse(work, groups, rng);
  }
  return { steps, finalBoard: work, maxDepth: depth };
}

export function comboCoefficient(depth: number): number {
  if (depth <= 1) return 1;
  if (depth === 2) return 1.5;
  if (depth === 3) return 2;
  return 3;
}
