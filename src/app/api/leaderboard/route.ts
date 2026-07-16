import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaderboard } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(leaderboard)
      .orderBy(desc(leaderboard.score), desc(leaderboard.createdAt))
      .limit(50);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load leaderboard", detail: String(err) },
      { status: 500 },
    );
  }
}

interface SubmitBody {
  playerName: string;
  generalId: string;
  generalName: string;
  result: string;
  score: number;
  totalRounds: number;
  playerActions: number;
  comboRate: number;
  match45Rate: number;
  ultimateRate: number;
  superUltimateRate: number;
  bowRate: number;
  strategyRate: number;
  perfectDefenseRate: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;
    const name = (body.playerName ?? "").toString().trim().slice(0, 24) || "无名武将";
    if (
      typeof body.score !== "number" ||
      typeof body.totalRounds !== "number" ||
      typeof body.playerActions !== "number"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const num = (v: number | undefined, fallback = 0) =>
      Number.isFinite(v as number) ? (v as number) : fallback;
    const [inserted] = await db
      .insert(leaderboard)
      .values({
        playerName: name,
        generalId: (body.generalId ?? "").toString().slice(0, 40),
        generalName: (body.generalName ?? "").toString().slice(0, 40),
        result: (body.result ?? "win").toString().slice(0, 16),
        score: Math.max(0, Math.floor(body.score)),
        totalRounds: Math.max(0, Math.floor(body.totalRounds)),
        playerActions: Math.max(0, Math.floor(body.playerActions)),
        comboRate: num(body.comboRate).toFixed(4),
        match45Rate: num(body.match45Rate).toFixed(4),
        ultimateRate: num(body.ultimateRate).toFixed(4),
        superUltimateRate: num(body.superUltimateRate).toFixed(4),
        bowRate: num(body.bowRate).toFixed(4),
        strategyRate: num(body.strategyRate).toFixed(4),
        perfectDefenseRate: num(body.perfectDefenseRate).toFixed(4),
      })
      .returning();
    // Keep table trimmed to the most recent 500 entries to avoid unbounded growth.
    await db.execute(
      sql`DELETE FROM ${leaderboard} WHERE id NOT IN (SELECT id FROM ${leaderboard} ORDER BY ${desc(leaderboard.createdAt)} LIMIT 500)`,
    );
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save score", detail: String(err) },
      { status: 500 },
    );
  }
}
