"use client";

import { useCallback, useState } from "react";
import GeneralSelect from "@/components/GeneralSelect";
import GamePlay, { type GameOverPayload } from "@/components/GamePlay";
import Leaderboard from "@/components/Leaderboard";
import ResultScreen from "@/components/ResultScreen";
import { type General, FACTION_NAMES } from "@/data/generals";

type Screen = "intro" | "select" | "game" | "result" | "leaderboard";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [playerName, setPlayerName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [general, setGeneral] = useState<General | null>(null);
  const [payload, setPayload] = useState<GameOverPayload | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGameOver = useCallback(
    async (p: GameOverPayload) => {
      setPayload(p);
      setLastScore(p.score);
      setScreen("result");
      setSaving(true);
      if (p.result === "player_win") {
        const resultLabel = "win";
        const res = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerName: playerName || "无名武将",
            generalId: general?.id ?? "",
            generalName: general?.name ?? "",
            opponentId: p.aiId ?? "",
            opponentName: p.aiName ?? "",
            result: resultLabel,
            score: p.score,
            totalRounds: p.totalRounds,
            playerActions: p.stats.playerActions,
            comboRate: p.breakdown.comboRate,
            match45Rate: p.breakdown.match45Rate,
            ultimateRate: p.breakdown.ultimateRate,
            superUltimateRate: p.breakdown.superRate,
            bowRate: p.breakdown.bowRate,
            strategyRate: p.breakdown.strategyRate,
            perfectDefenseRate: p.breakdown.perfectRate,
          }),
        });
        const data = await res.json();
        if (data.id) setHighlightId(data.id);
      }
      setSaving(false);
    },
    [playerName, general],
  );

  if (screen === "intro") {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 text-amber-50">
        <DecoBg />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="mb-2 text-5xl">⚔️</div>
          <h1 className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-3xl font-black tracking-widest text-transparent sm:text-5xl">
            三国武将
          </h1>
          <h2 className="mt-1 text-lg font-bold tracking-[0.3em] text-amber-300/90 sm:text-2xl">
            三消单挑
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-amber-100/60">
            消除宝石发动攻击、计略、弓箭与必杀，以武将四维与装备一决高下。手机与电脑皆可流畅对战。
          </p>

          <div className="mx-auto mt-7 max-w-sm">
            <label className="mb-1 block text-left text-xs text-amber-200/70">输入主公名号</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value.slice(0, 16))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftName.trim()) {
                  setPlayerName(draftName.trim());
                  setScreen("select");
                }
              }}
              placeholder="例如：常山赵子龙"
              className="w-full rounded-xl border border-stone-600 bg-stone-900/80 px-4 py-3 text-center text-lg outline-none focus:border-amber-500"
            />
            <button
              disabled={!draftName.trim()}
              onClick={() => {
                setPlayerName(draftName.trim());
                setScreen("select");
              }}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-lg font-black text-stone-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              进入点将台
            </button>
            <button
              onClick={() => setScreen("leaderboard")}
              className="mt-3 w-full text-xs text-amber-200/60 underline-offset-2 hover:underline"
            >
              查看历史积分榜
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "select") {
    return (
      <GeneralSelect
        playerName={playerName}
        onPick={(g) => {
          setGeneral(g);
          setScreen("game");
        }}
        onBack={() => setScreen("intro")}
      />
    );
  }

  if (screen === "game" && general) {
    return (
      <GamePlay
        key={`${general.id}-${Date.now()}`}
        playerName={playerName}
        playerGeneral={general}
        onGameOver={handleGameOver}
      />
    );
  }

  if (screen === "result" && general && payload) {
    return (
      <ResultScreen
        playerName={playerName}
        general={general}
        payload={payload}
        onViewBoard={() => setScreen("leaderboard")}
        onPlayAgain={() => setScreen("select")}
      />
    );
  }

  return (
    <Leaderboard
      highlightId={highlightId}
      onPlayAgain={() => {
        setLastScore(null);
        setHighlightId(null);
        setScreen(playerName ? "select" : "intro");
      }}
    />
  );
}

function DecoBg() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-30">
      <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-rose-700/40 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-52 w-52 rounded-full bg-amber-600/30 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-sky-700/30 blur-3xl" />
    </div>
  );
}