"use client";

import type { GameOverPayload } from "@/components/GamePlay";
import { type General, FACTION_NAMES, FACTION_COLORS } from "@/data/generals";

interface Props {
  playerName: string;
  general: General;
  payload: GameOverPayload;
  onViewBoard: () => void;
  onPlayAgain: () => void;
}

export default function ResultScreen({
  playerName,
  general,
  payload,
  onViewBoard,
  onPlayAgain,
}: Props) {
  const b = payload.breakdown;
  const outcome =
    payload.result === "player_win"
      ? { text: "单挑胜利", color: "#fcd34d", emoji: "🏆" }
      : payload.result === "draw"
        ? { text: "兵器皆毁 · 平局", color: "#7dd3fc", emoji: "⚖️" }
        : { text: "单挑失败", color: "#fb7185", emoji: "💀" };

  const rows: { label: string; value: string; raw: number }[] = [
    { label: "连消率", value: pct(b.comboRate), raw: b.comboRate },
    { label: "45消率", value: pct(b.match45Rate), raw: b.match45Rate },
    { label: "必杀率", value: pct(b.ultimateRate), raw: b.ultimateRate },
    { label: "超杀率", value: pct(b.superRate), raw: b.superRate },
    { label: "射箭率", value: pct(b.bowRate), raw: b.bowRate },
    { label: "计略率", value: pct(b.strategyRate), raw: b.strategyRate },
    { label: "完防率", value: pct(b.perfectRate), raw: b.perfectRate },
  ];

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8 text-amber-50">
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-600/50 bg-stone-900/80 p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-5xl">{outcome.emoji}</div>
          <div className="mt-2 text-2xl font-black" style={{ color: outcome.color }}>
            {outcome.text}
          </div>
          <div className="mt-1 text-xs text-amber-200/70">
            {playerName} 率 <span style={{ color: FACTION_COLORS[general.faction] }}>{general.name}</span> 迎战{" "}
            {payload.aiName}
          </div>
        </div>

        <div className="my-5 rounded-xl bg-stone-950/60 py-4 text-center">
          <div className="text-5xl font-black text-amber-300">{payload.score}</div>
          <div className="text-[11px] uppercase tracking-widest text-amber-200/60">单场积分</div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-amber-200/70">{r.label}</span>
              <span className="font-bold text-amber-100">{r.value}</span>
            </div>
          ))}
          <div className="col-span-2 mt-1 flex items-center justify-between border-t border-stone-700 pt-1.5 text-sm">
            <span className="text-amber-200/70">总回合 / 玩家行动</span>
            <span className="font-bold text-amber-100">
              {payload.totalRounds} / {payload.stats.playerActions}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onViewBoard}
            className="w-full rounded-xl bg-amber-500 py-3 font-bold text-stone-900 transition hover:bg-amber-400"
          >
            🏆 查看完整积分榜
          </button>
          <button
            onClick={onPlayAgain}
            className="w-full rounded-xl border border-stone-600 bg-stone-800 py-3 font-bold text-amber-100 transition hover:bg-stone-700"
          >
            再战一局
          </button>
        </div>
      </div>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
