"use client";

import { useEffect, useState } from "react";
import type { LeaderboardRow } from "@/db/schema";

interface Props {
  onPlayAgain: () => void;
  highlightScore?: number | null;
}

export default function Leaderboard({ onPlayAgain, highlightScore }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.rows) setRows(d.rows as LeaderboardRow[]);
        else setError(d.error || "加载失败");
      })
      .catch(() => alive && setError("网络错误"));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-900 via-stone-950 to-black px-3 py-5 text-amber-50">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black tracking-wider text-amber-300 sm:text-2xl">
            🏆 积分榜 · 前五十名将
          </h1>
          <button
            onClick={onPlayAgain}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-stone-900 hover:bg-amber-400"
          >
            再战一局
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-stone-700">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-800 text-amber-200">
                <Th>#</Th>
                <Th>玩家</Th>
                <Th>武将</Th>
                <Th right>积分</Th>
                <Th right>总回合</Th>
                <Th right>行动</Th>
                <Th right>连消率</Th>
                <Th right>45消率</Th>
                <Th right>必杀率</Th>
                <Th right>超杀率</Th>
                <Th right>射箭率</Th>
                <Th right>计略率</Th>
                <Th right>完防率</Th>
              </tr>
            </thead>
            <tbody>
              {rows === null && !error && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-amber-200/50">
                    加载中...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-rose-300">
                    {error}
                  </td>
                </tr>
              )}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-amber-200/50">
                    榜单尚无记录，去拿下榜首吧！
                  </td>
                </tr>
              )}
              {rows &&
                rows.map((r, i) => {
                  const hi =
                    highlightScore != null &&
                    Number(r.score) === highlightScore &&
                    i < 3;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-stone-800 ${
                        hi ? "bg-amber-500/20" : i % 2 ? "bg-stone-900/40" : ""
                      }`}
                    >
                      <Td>
                        <span
                          className={`font-bold ${
                            i === 0
                              ? "text-yellow-300"
                              : i === 1
                                ? "text-stone-200"
                                : i === 2
                                  ? "text-amber-600"
                                  : "text-amber-200/60"
                          }`}
                        >
                          {i + 1}
                        </span>
                      </Td>
                      <Td>{r.playerName}</Td>
                      <Td>
                        <span className="text-amber-100">{r.generalName}</span>
                        <span className="ml-1 text-[10px] text-amber-200/40">{r.result}</span>
                      </Td>
                      <Td right>
                        <b className="text-amber-300">{r.score}</b>
                      </Td>
                      <Td right>{r.totalRounds}</Td>
                      <Td right>{r.playerActions}</Td>
                      <Td right>{pct(r.comboRate)}</Td>
                      <Td right>{pct(r.match45Rate)}</Td>
                      <Td right>{pct(r.ultimateRate)}</Td>
                      <Td right>{pct(r.superUltimateRate)}</Td>
                      <Td right>{pct(r.bowRate)}</Td>
                      <Td right>{pct(r.strategyRate)}</Td>
                      <Td right>{pct(r.perfectDefenseRate)}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function pct(n: string | number): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "0%";
  return `${Math.round(v * 100)}%`;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-2 py-2 font-bold ${right ? "text-right" : ""}`}>{children}</th>
  );
}
function Td({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td className={`px-2 py-1.5 align-middle ${right ? "text-right" : ""}`}>{children}</td>
  );
}
