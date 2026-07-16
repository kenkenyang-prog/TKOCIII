"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  makeCombatant,
  buildTurnOrder,
  turnSide,
  checkResult,
  resolveCascade,
  launchBow,
  launchUltimate,
  beginRetreat,
  computeScore,
  emptyStats,
  type Combatant,
  type TurnOrder,
  type PlayerStats,
  type BattleResult,
  type BattleLogEntry,
  type ScoreBreakdown,
} from "@/lib/combat";
import {
  createBoard,
  simulateMove,
  swap,
  collapse,
  ensureMoveable,
  findHint,
  findAllMoves,
  isAdjacent,
  BOARD_SIZE,
  GEM_LABEL,
  GEM_COLOR,
  GEM_GLOW,
  type Board,
  type Cell,
  type Move,
} from "@/lib/match3";
import { pickAIMove } from "@/lib/ai";
import {
  GENERALS,
  FACTION_NAMES,
  FACTION_COLORS,
  type General,
} from "@/data/generals";

export interface GameOverPayload {
  result: BattleResult;
  stats: PlayerStats;
  totalRounds: number;
  score: number;
  breakdown: ScoreBreakdown;
  aiName: string;
}

interface Props {
  playerName: string;
  playerGeneral: General;
  onGameOver: (payload: GameOverPayload) => void;
}

interface GameRef {
  player: Combatant;
  ai: Combatant;
  order: TurnOrder;
  orderIndex: number;
  stats: PlayerStats;
  totalRounds: number;
  actionsInSlot: number;
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function randomAiGeneral(excludeId: string): General {
  const pool = GENERALS.filter((g) => g.faction !== "dark" && g.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function GamePlay({ playerName, playerGeneral, onGameOver }: Props) {
  const boardRef = useRef<Board>(createBoard());
  const gameRef = useRef<GameRef | null>(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const busyRef = useRef(false);
  const overRef = useRef(false);

  const [board, setBoardState] = useState<Board>(boardRef.current);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [hintCells, setHintCells] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [logs, setLogs] = useState<BattleLogEntry[]>([]);
  const [phase, setPhase] = useState<"player" | "busy" | "ai" | "over">("player");
  const [result, setResult] = useState<BattleResult>("ongoing");
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const setBoardBoth = useCallback((b: Board) => {
    boardRef.current = b;
    setBoardState(b);
  }, []);

  const addLogs = useCallback((entries: BattleLogEntry[]) => {
    setLogs((prev) => {
      const next = [...prev, ...entries];
      return next.slice(-50);
    });
  }, []);

  // Initialise game once.
  useEffect(() => {
    const aiGeneral = randomAiGeneral(playerGeneral.id);
    const player = makeCombatant(playerGeneral, "player");
    const ai = makeCombatant(aiGeneral, "ai");
    const order = buildTurnOrder(player, ai);
    gameRef.current = {
      player,
      ai,
      order,
      orderIndex: 0,
      stats: emptyStats(),
      totalRounds: 0,
      actionsInSlot: 0,
    };
    const starting = turnSide(order, 0);
    setPhase(starting === "player" ? "player" : "ai");
    forceRender();
    if (starting === "ai") {
      void (async () => {
        await sleep(700);
        await runAiAction();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSide = useCallback((): "player" | "ai" => {
    const g = gameRef.current!;
    return turnSide(g.order, g.orderIndex);
  }, []);

  const registerAction = useCallback((isPlayer: boolean) => {
    const g = gameRef.current!;
    g.totalRounds++;
    g.actionsInSlot++;
    if (isPlayer) g.stats.playerActions++;
  }, []);

  const ensureBoardMoveable = useCallback(() => {
    const b = ensureMoveable(boardRef.current);
    if (b !== boardRef.current) setBoardBoth(b);
  }, [setBoardBoth]);

  const animateCascades = useCallback(
    async (a: Cell, b: Cell, steps: import("@/lib/match3").MatchGroup[][]) => {
      let work = swap(boardRef.current, a, b);
      setBoardBoth(work);
      setPopping(new Set());
      await sleep(150);
      for (let d = 0; d < steps.length; d++) {
        const cells = steps[d].flatMap((g) => g.cells);
        setPopping(new Set(cells.map((c) => `${c.r}-${c.c}`)));
        await sleep(240);
        work = collapse(work, steps[d]);
        setBoardBoth(work);
        setPopping(new Set());
        await sleep(130);
      }
    },
    [setBoardBoth],
  );

  const performSwap = useCallback(
    async (
      a: Cell,
      b: Cell,
      attacker: Combatant,
      defender: Combatant,
      attackerIsPlayer: boolean,
    ): Promise<boolean> => {
      const res = simulateMove(boardRef.current, a, b);
      await animateCascades(a, b, res.steps);
      const out = resolveCascade(
        attacker,
        defender,
        res.steps,
        gameRef.current!.stats,
        attackerIsPlayer,
      );
      addLogs(out.logs);
      return out.hadBigMatch;
    },
    [animateCascades, addLogs],
  );

  const finalize = useCallback(
    (res: BattleResult) => {
      if (overRef.current) return;
      overRef.current = true;
      const g = gameRef.current!;
      setResult(res);
      setPhase("over");
      const breakdown = computeScore(
        { ...g.stats, totalRounds: g.totalRounds },
        playerGeneral,
      );
      setFinalScore(breakdown.score);
      forceRender();
    },
    [playerGeneral],
  );

  const endAction = useCallback(
    async (sideActed: "player" | "ai", hadBig: boolean) => {
      const g = gameRef.current!;
      if (g.totalRounds > 500) {
        finalize("draw");
        return;
      }
      let res = checkResult(g.player, g.ai);
      if (res !== "ongoing") {
        finalize(res);
        return;
      }
      if (hadBig && g.actionsInSlot < 5) {
        // bonus extra action for the same side
        if (sideActed === "player") {
          ensureBoardMoveable();
          setPhase("player");
          forceRender();
        } else {
          await sleep(360);
          await runAiAction();
        }
        return;
      }
      // advance to next turn in the order
      g.orderIndex++;
      g.actionsInSlot = 0;
      const next = turnSide(g.order, g.orderIndex);
      const nextC = next === "player" ? g.player : g.ai;
      if (nextC.retreatPending) {
        finalize(next === "player" ? "player_lose" : "player_win");
        return;
      }
      res = checkResult(g.player, g.ai);
      if (res !== "ongoing") {
        finalize(res);
        return;
      }
      if (next === "player") {
        ensureBoardMoveable();
        setPhase("player");
        forceRender();
      } else {
        setPhase("ai");
        forceRender();
        await sleep(480);
        await runAiAction();
      }
    },
    [ensureBoardMoveable, finalize],
  );

  const runAiAction = useCallback(async () => {
    if (overRef.current) return;
    const g = gameRef.current!;
    ensureBoardMoveable();
    let hadBig = false;
    if (g.ai.ultAccum >= 50) {
      registerAction(false);
      const r = launchUltimate(g.ai, g.player);
      addLogs([r.entry]);
      if (r.perfect) g.stats.perfectDefenses++;
      forceRender();
      await sleep(280);
    } else if (g.ai.bowAccum >= 50 && g.ai.bow) {
      registerAction(false);
      const r = launchBow(g.ai, g.player);
      addLogs([r.entry]);
      if (r.perfect) g.stats.perfectDefenses++;
      forceRender();
      await sleep(280);
    } else {
      const move: Move | null = pickAIMove(boardRef.current, g.ai);
      if (!move) {
        ensureBoardMoveable();
        await endAction("ai", false);
        return;
      }
      registerAction(false);
      hadBig = await performSwap(move.a, move.b, g.ai, g.player, false);
      forceRender();
      await sleep(150);
    }
    await endAction("ai", hadBig);
  }, [ensureBoardMoveable, registerAction, addLogs, performSwap, endAction]);

  // ---- Player interactions ----
  const attemptPlayerSwap = useCallback(
    async (a: Cell, b: Cell) => {
      if (busyRef.current || phase !== "player" || overRef.current) return;
      busyRef.current = true;
      const res = simulateMove(boardRef.current, a, b);
      if (res.maxDepth === 0) {
        setFlash(`${a.r}-${a.c}|${b.r}-${b.c}`);
        setSelected(null);
        await sleep(320);
        setFlash(null);
        busyRef.current = false;
        return;
      }
      setPhase("busy");
      setSelected(null);
      registerAction(true);
      const hadBig = await performSwap(a, b, gameRef.current!.player, gameRef.current!.ai, true);
      forceRender();
      await sleep(120);
      busyRef.current = false;
      await endAction("player", hadBig);
    },
    [phase, registerAction, performSwap, endAction],
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (phase !== "player" || busyRef.current) return;
      const cell = { r, c };
      if (!selected) {
        setSelected(cell);
        return;
      }
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        return;
      }
      if (isAdjacent(selected, cell)) {
        void attemptPlayerSwap(selected, cell);
      } else {
        setSelected(cell);
      }
    },
    [phase, selected, attemptPlayerSwap],
  );

  const doUltimate = useCallback(async () => {
    if (phase !== "player" || busyRef.current || overRef.current) return;
    const p = gameRef.current!.player;
    if (p.ultAccum < 50) return;
    busyRef.current = true;
    setPhase("busy");
    registerAction(true);
    const r = launchUltimate(p, gameRef.current!.ai);
    addLogs([r.entry]);
    if (r.super) gameRef.current!.stats.superUltimate++;
    else gameRef.current!.stats.ultimate++;
    forceRender();
    await sleep(260);
    busyRef.current = false;
    await endAction("player", false);
  }, [phase, registerAction, addLogs, endAction]);

  const doBow = useCallback(async () => {
    if (phase !== "player" || busyRef.current || overRef.current) return;
    const p = gameRef.current!.player;
    if (p.bowAccum < 50 || !p.bow) return;
    busyRef.current = true;
    setPhase("busy");
    registerAction(true);
    const r = launchBow(p, gameRef.current!.ai);
    addLogs([r.entry]);
    gameRef.current!.stats.bowShots++;
    forceRender();
    await sleep(260);
    busyRef.current = false;
    await endAction("player", false);
  }, [phase, registerAction, addLogs, endAction]);

  const doRetreat = useCallback(async () => {
    if (phase !== "player" || busyRef.current || overRef.current) return;
    const p = gameRef.current!.player;
    if (p.retreatAccum < 50) return;
    busyRef.current = true;
    setPhase("busy");
    registerAction(true);
    beginRetreat(p);
    addLogs([
      { text: "你下达撤退命令，将在敌方下一回合后撤离！", kind: "retreat", side: "player" },
    ]);
    forceRender();
    await sleep(260);
    busyRef.current = false;
    await endAction("player", false);
  }, [phase, registerAction, addLogs, endAction]);

  const showHint = useCallback(() => {
    if (phase !== "player") return;
    const m = findHint(boardRef.current);
    if (!m) return;
    const cells = new Set<string>([
      `${m.a.r}-${m.a.c}`,
      `${m.b.r}-${m.b.c}`,
    ]);
    setHintCells(cells);
    setTimeout(() => setHintCells(new Set()), 1800);
  }, [phase]);

  if (!gameRef.current) {
    return <div className="p-8 text-center text-amber-100">排兵布阵中...</div>;
  }
  const g = gameRef.current;
  const side = currentSide();
  const isPlayerTurn = phase === "player";
  const bigMoveAvailable = useMemo(() => {
    if (phase !== "player") return false;
    return findAllMoves(boardRef.current).some((m) => m.maxSize >= 4);
  }, [phase, board]);

  const outcomeText =
    result === "player_win"
      ? "单挑胜利！"
      : result === "player_lose"
        ? "单挑失败..."
        : result === "draw"
          ? "兵器皆毁，平局"
          : "";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-900 via-stone-950 to-black text-amber-50">
      <div className="mx-auto w-full max-w-3xl px-2 py-3 sm:px-4">
        <Header
          order={g.order}
          orderIndex={g.orderIndex}
          round={g.totalRounds}
          side={side}
          phase={phase}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <FighterCard c={g.player} current={side === "player" && phase !== "over"} you label={`${playerName}`} />
          <FighterCard c={g.ai} current={side === "ai" && phase !== "over"} />
        </div>

        <BoardView
          board={board}
          selected={selected}
          popping={popping}
          hintCells={hintCells}
          flash={flash}
          interactive={isPlayerTurn}
          onCell={handleCellClick}
        />

        {bigMoveAvailable && (
          <div className="mt-2 text-center text-xs font-bold text-amber-300 animate-pulse">
            ⚡ 棋盘存在 4 / 5 消机会，留意出手！
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <ActionButton
            label={`必杀 ${g.player.ultAccum}/50`}
            color="bg-yellow-600"
            disabled={!isPlayerTurn || g.player.ultAccum < 50}
            onClick={doUltimate}
          />
          <ActionButton
            label={`弓箭 ${g.player.bowAccum}/50`}
            color="bg-purple-600"
            disabled={!isPlayerTurn || g.player.bowAccum < 50 || !g.player.bow}
            onClick={doBow}
          />
          <ActionButton
            label={`撤退 ${g.player.retreatAccum}/50`}
            color="bg-stone-500"
            disabled={!isPlayerTurn || g.player.retreatAccum < 50}
            onClick={doRetreat}
          />
          <ActionButton label="提示" color="bg-sky-700" disabled={!isPlayerTurn} onClick={showHint} />
        </div>

        <Legend />

        <LogPanel logs={logs} />

        {phase === "over" && finalScore !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border-2 border-amber-500/60 bg-stone-900 p-6 text-center shadow-2xl">
              <div
                className={`text-3xl font-black ${
                  result === "player_win"
                    ? "text-amber-300"
                    : result === "draw"
                      ? "text-sky-300"
                      : "text-rose-400"
                }`}
              >
                {outcomeText}
              </div>
              <div className="mt-2 text-sm text-amber-100/80">
                对手：{g.ai.general.name}（{g.ai.general.title || FACTION_NAMES[g.ai.general.faction]}）
              </div>
              <div className="mt-4 text-5xl font-black text-amber-300">{finalScore}</div>
              <div className="text-xs uppercase tracking-widest text-amber-200/70">单场积分</div>
              <button
                className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-stone-900 transition hover:bg-amber-400"
                onClick={() =>
                  onGameOver({
                    result,
                    stats: g.stats,
                    totalRounds: g.totalRounds,
                    score: finalScore,
                    breakdown: computeScore(
                      { ...g.stats, totalRounds: g.totalRounds },
                      playerGeneral,
                    ),
                    aiName: g.ai.general.name,
                  })
                }
              >
                查看战绩与榜单
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function Header({
  order,
  orderIndex,
  round,
  side,
  phase,
}: {
  order: TurnOrder;
  orderIndex: number;
  round: number;
  side: "player" | "ai";
  phase: string;
}) {
  const letters: { ch: string; me: boolean }[] = [];
  for (let i = 0; i < 9; i++) {
    const idx = (orderIndex + i) % order.pattern.length;
    const ch = order.pattern[idx];
    const isA = ch === "A";
    const me = (isA && order.aSide === "player") || (!isA && order.aSide !== "player");
    letters.push({ ch, me });
  }
  return (
    <div className="rounded-xl border border-amber-700/40 bg-stone-900/70 px-3 py-2">
      <div className="flex items-center justify-between text-xs text-amber-200/80">
        <span>第 {round + 1} 手</span>
        <span
          className={`rounded-full px-3 py-1 font-bold ${
            phase === "over"
              ? "bg-stone-700 text-amber-200"
              : side === "player"
                ? "bg-emerald-600 text-white"
                : "bg-rose-700 text-white"
          }`}
        >
          {phase === "over" ? "战斗结束" : side === "player" ? "你的回合" : "敌方回合"}
        </span>
        <span>出手顺序（玩/敌）</span>
      </div>
      <div className="mt-1 flex justify-center gap-1">
        {letters.map((l, i) => (
          <span
            key={i}
            className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold ${
              i === 0 ? "ring-2 ring-amber-300" : ""
            } ${l.me ? "bg-emerald-600 text-white" : "bg-rose-700 text-white"}`}
          >
            {l.me ? "玩" : "敌"}
          </span>
        ))}
      </div>
    </div>
  );
}

function FighterCard({
  c,
  current,
  you,
  label,
}: {
  c: Combatant;
  current: boolean;
  you?: boolean;
  label?: string;
}) {
  const gen = c.general;
  const hpPct = Math.max(0, (c.hp / c.maxHp) * 100);
  const name = label ?? gen.name;
  return (
    <div
      className={`rounded-xl border p-2 ${
        current ? "border-amber-400 bg-stone-800/80" : "border-stone-700 bg-stone-900/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span
              className="truncate text-sm font-bold"
              style={{ color: you ? "#fcd34d" : FACTION_COLORS[gen.faction] }}
            >
              {you ? "🛡 " : "⚔ "}
              {name}
            </span>
          </div>
          <div className="truncate text-[10px] text-amber-200/60">
            {gen.title || FACTION_NAMES[gen.faction]} · 武{c.force} 智{c.intel}
          </div>
        </div>
        <div className="text-right text-[10px] text-amber-100/70">
          {Math.ceil(c.hp)}/{c.maxHp}
        </div>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-stone-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-600 to-red-400 transition-all duration-300"
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        <MiniBar label="怒" v={c.rage} max={50} color="#f97316" />
        <MiniBar label="必" v={c.ultAccum} max={50} color="#eab308" />
        <MiniBar label="防" v={c.defenseAccum} max={70} color="#22c55e" />
        <MiniBar label="弓" v={c.bowAccum} max={50} color="#a855f7" />
        <MiniBar label="撤" v={c.retreatAccum} max={50} color="#94a3b8" />
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-amber-100/70">
        <EquipTag name={c.weapon.name} dur={c.weapon.dur} max={c.weapon.maxDur} />
        {c.bow && <EquipTag name={c.bow.name} dur={c.bow.dur} max={c.bow.maxDur} />}
        <EquipTag name={c.armor.name} dur={c.armor.dur} max={c.armor.maxDur} />
      </div>
    </div>
  );
}

function MiniBar({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  const p = Math.min(100, (v / max) * 100);
  const full = v >= max;
  return (
    <div className="text-center">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${full ? "animate-pulse" : ""}`}
          style={{ width: `${p}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-0.5 text-[8px] text-amber-100/60">
        {label}
        {Math.round(v)}
      </div>
    </div>
  );
}

function EquipTag({ name, dur, max }: { name: string; dur: number; max: number }) {
  const dead = dur <= 0;
  return (
    <span
      className={`rounded px-1 ${
        dead ? "bg-rose-900/60 text-rose-300 line-through" : "bg-stone-700/70"
      }`}
    >
      {name} {dur}
    </span>
  );
}

function BoardView({
  board,
  selected,
  popping,
  hintCells,
  flash,
  interactive,
  onCell,
}: {
  board: Board;
  selected: Cell | null;
  popping: Set<string>;
  hintCells: Set<string>;
  flash: string | null;
  interactive: boolean;
  onCell: (r: number, c: number) => void;
}) {
  const flashSet = new Set(flash ? flash.split("|") : []);
  return (
    <div className="mx-auto mt-3 w-full max-w-[30rem]">
      <div
        className="grid touch-manipulation select-none gap-1 rounded-xl border border-amber-800/40 bg-stone-950/60 p-1.5"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((row, r) =>
          row.map((gem, c) => {
            const key = `${r}-${c}`;
            const isSel = selected && selected.r === r && selected.c === c;
            const isPop = popping.has(key);
            const isHint = hintCells.has(key);
            const isFlash = flashSet.has(key);
            return (
              <button
                key={key}
                onClick={() => onCell(r, c)}
                disabled={!interactive}
                className={`relative aspect-square rounded-lg transition-all duration-150 ${
                  isSel ? "ring-4 ring-white scale-105 z-10" : ""
                } ${isHint ? "ring-2 ring-sky-300 animate-pulse" : ""} ${
                  isFlash ? "ring-4 ring-rose-500" : ""
                }`}
                style={{
                  backgroundColor: GEM_COLOR[gem],
                  boxShadow: `inset 0 -3px 6px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.4)`,
                  transform: isPop ? "scale(0.3)" : isSel ? "scale(1.05)" : "scale(1)",
                  opacity: isPop ? 0.4 : 1,
                }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center text-sm font-black sm:text-lg"
                  style={{
                    color: gem === 5 ? "#1f2937" : "#fff",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  {GEM_LABEL[gem]}
                </span>
                <span
                  className="pointer-events-none absolute inset-x-1 top-1 h-1/3 rounded-full opacity-40"
                  style={{ backgroundColor: GEM_GLOW[gem] }}
                />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-xs font-bold text-white shadow transition ${
        disabled ? "cursor-not-allowed bg-stone-700 opacity-50" : `${color} hover:brightness-110 active:scale-95`
      }`}
    >
      {label}
    </button>
  );
}

function Legend() {
  const items: { t: number; desc: string }[] = [
    { t: 0, desc: "武:物理攻击" },
    { t: 1, desc: "计:挑衅" },
    { t: 2, desc: "防:防御累积" },
    { t: 3, desc: "射:弓箭累积" },
    { t: 4, desc: "必:必杀累积" },
    { t: 5, desc: "撤:撤退累积" },
  ];
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-amber-100/70">
      {items.map((it) => (
        <span key={it.t} className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ backgroundColor: GEM_COLOR[it.t as 0] }}
          />
          {it.desc}
        </span>
      ))}
    </div>
  );
}

function LogPanel({ logs }: { logs: BattleLogEntry[] }) {
  const recent = [...logs].reverse();
  return (
    <div className="mt-3 h-28 overflow-y-auto rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-[11px] leading-relaxed">
      {recent.length === 0 && <div className="text-amber-200/40">战报将显示在此...</div>}
      {recent.map((l, i) => (
        <div
          key={i}
          className={
            l.side === "player" ? "text-emerald-300/90" : "text-rose-300/90"
          }
        >
          <span className="text-amber-200/40">›</span> {l.text}
        </div>
      ))}
    </div>
  );
}
