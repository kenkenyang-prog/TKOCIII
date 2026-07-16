// AI opponent: picks a swap (or special action) based on a heuristic.
import type { Combatant } from "@/lib/combat";
import {
  findAllMoves,
  simulateMove,
  type Board,
  type Move,
  type GemType,
} from "@/lib/match3";

function typeWeight(type: GemType, ai: Combatant): number {
  switch (type) {
    case 0:
      return Math.max(1.2, ai.force / 24); // 武 physical
    case 1:
      return Math.max(1.2, ai.intel / 24); // 计 strategy
    case 2:
      return ai.hp < ai.maxHp * 0.55 ? 3.2 : 1.5; // 防 defense (more if hurt)
    case 3:
      return ai.bow ? (ai.bowAccum < 50 ? 2.4 : 0.6) : 0.3; // 射 bow
    case 4:
      return ai.ultAccum < 50 ? 2.6 : 0.6; // 必 ultimate
    case 5:
      return ai.hp < ai.maxHp * 0.3 ? 1.8 : 0.3; // 撤 retreat (only if desperate)
    default:
      return 1;
  }
}

export function pickAIMove(board: Board, ai: Combatant): Move | null {
  const moves = findAllMoves(board);
  if (!moves.length) return null;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const sim = simulateMove(board, m.a, m.b);
    let score = 0;
    let depth = 0;
    for (const step of sim.steps) {
      for (const g of step) {
        const w = typeWeight(g.type as GemType, ai);
        score += g.size * w;
        if (g.size >= 5) score += 9;
        else if (g.size === 4) score += 4.5;
      }
      depth++;
    }
    score += depth * 3.2;
    score += Math.random() * 1.6;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
