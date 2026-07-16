import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const leaderboard = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  generalId: text("general_id").notNull(),
  generalName: text("general_name").notNull(),
  result: text("result").notNull(),
  score: integer("score").notNull(),
  totalRounds: integer("total_rounds").notNull(),
  playerActions: integer("player_actions").notNull(),
  comboRate: numeric("combo_rate", { precision: 6, scale: 4 }).notNull(),
  match45Rate: numeric("match45_rate", { precision: 6, scale: 4 }).notNull(),
  ultimateRate: numeric("ultimate_rate", { precision: 6, scale: 4 }).notNull(),
  superUltimateRate: numeric("super_ultimate_rate", { precision: 6, scale: 4 }).notNull(),
  bowRate: numeric("bow_rate", { precision: 6, scale: 4 }).notNull(),
  strategyRate: numeric("strategy_rate", { precision: 6, scale: 4 }).notNull(),
  perfectDefenseRate: numeric("perfect_defense_rate", { precision: 6, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LeaderboardRow = typeof leaderboard.$inferSelect;
export type NewLeaderboardRow = typeof leaderboard.$inferInsert;
