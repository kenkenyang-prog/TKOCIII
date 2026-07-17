import { promises as fs } from "fs";
import path from "path";

export interface LeaderboardEntry {
  id: number;
  playerName: string;
  generalId: string;
  generalName: string;
  opponentId: string;
  opponentName: string;
  result: string;
  score: number;
  totalRounds: number;
  playerActions: number;
  comboRate: string;
  match45Rate: string;
  ultimateRate: string;
  superUltimateRate: string;
  bowRate: string;
  strategyRate: string;
  perfectDefenseRate: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leaderboard.json");
const MAX_ENTRIES = 500;

async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readAll(): Promise<LeaderboardEntry[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

async function writeAll(entries: LeaderboardEntry[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function getTopEntries(limit = 50): Promise<LeaderboardEntry[]> {
  const entries = await readAll();
  return entries
    .sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function addEntry(
  input: Omit<LeaderboardEntry, "id" | "createdAt">,
): Promise<LeaderboardEntry> {
  const entries = await readAll();
  const nextId = entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1;
  const entry: LeaderboardEntry = {
    ...input,
    id: nextId,
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  // Keep only the most recent MAX_ENTRIES entries
  const trimmed = entries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_ENTRIES);
  await writeAll(trimmed);
  return entry;
}