"use client";

import { useMemo, useState } from "react";
import {
  GENERALS,
  FACTION_NAMES,
  FACTION_COLORS,
  type General,
  type FactionId,
} from "@/data/generals";

interface Props {
  playerName: string;
  onPick: (g: General) => void;
  onBack: () => void;
}

const FACTION_ORDER: FactionId[] = ["shu", "wei", "wu", "hebei", "xiliang", "qun", "dark"];

export default function GeneralSelect({ playerName, onPick, onBack }: Props) {
  const [faction, setFaction] = useState<FactionId | "all">("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let arr = GENERALS.slice();
    if (faction !== "all") arr = arr.filter((g) => g.faction === faction);
    if (q.trim()) {
      const s = q.trim();
      arr = arr.filter((g) => g.name.includes(s) || g.title.includes(s) || g.id.includes(s));
    }
    return arr;
  }, [faction, q]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-900 via-stone-950 to-black px-3 py-5 text-amber-50">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg bg-stone-800 px-3 py-1.5 text-sm text-amber-200 hover:bg-stone-700"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-black tracking-wider text-amber-300 sm:text-2xl">
            点将台
          </h1>
          <div className="text-xs text-amber-200/70">主公：{playerName}</div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <FilterBtn active={faction === "all"} onClick={() => setFaction("all")}>
              全部
            </FilterBtn>
            {FACTION_ORDER.map((f) => (
              <FilterBtn key={f} active={faction === f} onClick={() => setFaction(f)}>
                {FACTION_NAMES[f]}
              </FilterBtn>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索武将..."
            className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-1.5 text-sm outline-none focus:border-amber-500 sm:w-48"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((g) => (
            <GeneralCard key={g.id} g={g} onPick={() => onPick(g)} />
          ))}
        </div>
        {list.length === 0 && (
          <div className="mt-10 text-center text-amber-200/50">未找到武将</div>
        )}
      </div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
        active
          ? "bg-amber-500 text-stone-900"
          : "bg-stone-800 text-amber-200 hover:bg-stone-700"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-stone-950/60 px-1 text-[10px] text-amber-100/80">
      {label}
      <b className="ml-0.5 text-amber-300">{value}</b>
    </span>
  );
}

function GeneralCard({ g, onPick }: { g: General; onPick: () => void }) {
  const sum = g.force + g.intelligence + g.virtue + g.stamina;
  return (
    <button
      onClick={onPick}
      className="group flex flex-col rounded-xl border border-stone-700 bg-stone-900/70 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-stone-800"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-base font-black text-amber-100">{g.name}</div>
          <div className="truncate text-[10px] text-amber-200/60">
            {g.title || FACTION_NAMES[g.faction]}
          </div>
        </div>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ backgroundColor: FACTION_COLORS[g.faction] }}
        >
          {FACTION_NAMES[g.faction]}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Stat label="武" value={g.force} />
        <Stat label="智" value={g.intelligence} />
        <Stat label="德" value={g.virtue} />
        <Stat label="体" value={g.stamina} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-amber-100/60">
        <span>
          兵性 {g.military} · 四维 {sum}
        </span>
      </div>
      <div className="mt-1 truncate text-[9px] text-amber-200/50">
        {g.weapon}
        {g.bow ? ` · ${g.bow}` : ""} · {g.armor}
      </div>
      <div className="mt-2 rounded-md bg-amber-500/90 py-1 text-center text-[11px] font-bold text-stone-900 opacity-0 transition group-hover:opacity-100">
        选此人出战
      </div>
    </button>
  );
}
