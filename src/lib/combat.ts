// Combat engine: combatants, damage formulas, turn order, scoring.
import {
  type General,
  getWeapon,
  getBow,
  getArmor,
  type Weapon,
  type Bow,
  type Armor,
} from "@/data/generals";
import type { MatchGroup, GemType } from "@/lib/match3";

export interface EquipDur {
  name: string;
  power: number; // attack or defense
  weight: number;
  maxDur: number;
  dur: number;
}

export interface Combatant {
  side: "player" | "ai";
  general: General;
  hp: number;
  maxHp: number;
  force: number;
  intel: number;
  virtue: number;
  weapon: EquipDur;
  bow: EquipDur | null;
  armor: EquipDur;
  bowAccum: number; // 0-50
  defenseAccum: number; // 0-70
  ultAccum: number; // 0-50
  rage: number; // 0-50
  retreatAccum: number; // 0-50
  retreatPending: boolean;
}

export function makeEquip(w: Weapon | Bow | Armor, key: "attack" | "defense"): EquipDur {
  const power = (w as unknown as Record<string, number>)[key] ?? 0;
  return {
    name: w.name,
    power,
    weight: w.weight,
    maxDur: w.durable,
    dur: w.durable,
  };
}

export function makeCombatant(general: General, side: "player" | "ai"): Combatant {
  const weapon = getWeapon(general.weapon);
  const bowDef = getBow(general.bow);
  const armor = getArmor(general.armor);
  return {
    side,
    general,
    hp: general.stamina,
    maxHp: general.stamina,
    force: general.force,
    intel: general.intelligence,
    virtue: general.virtue,
    weapon: makeEquip(weapon, "attack"),
    bow: bowDef ? makeEquip(bowDef, "attack") : null,
    armor: makeEquip(armor, "defense"),
    bowAccum: 0,
    defenseAccum: 0,
    ultAccum: 0,
    rage: 0,
    retreatAccum: 0,
    retreatPending: false,
  };
}

export function totalWeight(c: Combatant): number {
  return c.weapon.weight + (c.bow?.weight ?? 0) + c.armor.weight;
}

export function fourDimSum(c: Combatant): number {
  return c.force + c.intel + c.virtue + c.maxHp;
}

export function weaponAttack(c: Combatant): number {
  return c.weapon.dur > 0 ? c.weapon.power : 0;
}
export function bowAttack(c: Combatant): number {
  return c.bow && c.bow.dur > 0 ? c.bow.power : 0;
}
export function armorDefense(c: Combatant): number {
  return c.armor.dur > 0 ? c.armor.power : 0;
}

export function rageCoeff(c: Combatant): number {
  return 1 + (100 - c.virtue) / 10;
}

export interface DamageResult {
  damage: number;
  perfect: boolean;
}

// Physical attack from matching 武 gems.
export function physicalAttack(
  att: Combatant,
  def: Combatant,
  gemCount: number,
  coeff: number,
): { attack: number; defense: number; damage: number } {
  const attack = att.force + weaponAttack(att) + att.rage * 0.2;
  const defense =
    armorDefense(def) +
    def.defenseAccum +
    (def.force + weaponAttack(def)) / 2 -
    def.rage * 0.2;
  let damage = ((attack - defense) * gemCount) / 10 * coeff;
  if (damage < 0) damage = 0;
  return { attack, defense, damage };
}

// Apply damage to defender (handles rage, defense chip, perfect defense).
export function applyHit(
  def: Combatant,
  damage: number,
  perfectBonus: number,
  attackerUsesWeapon: boolean,
): { perfect: boolean; damage: number } {
  const perfect = damage <= 0;
  def.hp = Math.max(0, def.hp - damage);
  if (perfect) {
    def.ultAccum = Math.min(50, def.ultAccum + perfectBonus);
  } else {
    def.rage = Math.min(50, def.rage + damage * rageCoeff(def));
    def.defenseAccum = Math.max(0, def.defenseAccum - damage);
  }
  if (attackerUsesWeapon) {
    def.armor.dur = Math.max(0, def.armor.dur - 1);
  }
  return { perfect, damage };
}

export interface BattleLogEntry {
  text: string;
  kind: "attack" | "strategy" | "bow" | "ultimate" | "super" | "defense" | "info" | "retreat";
  side: "player" | "ai";
}

export interface CascadeOutcome {
  logs: BattleLogEntry[];
  stats: Partial<PlayerStats>;
  bowAccumFilled: boolean;
}

export interface PlayerStats {
  combo2: number;
  combo2plus: number;
  match4: number;
  match5: number;
  ultimate: number;
  superUltimate: number;
  bowShots: number;
  strategyUses: number;
  perfectDefenses: number;
  playerActions: number;
}

export function emptyStats(): PlayerStats {
  return {
    combo2: 0,
    combo2plus: 0,
    match4: 0,
    match5: 0,
    ultimate: 0,
    superUltimate: 0,
    bowShots: 0,
    strategyUses: 0,
    perfectDefenses: 0,
    playerActions: 0,
  };
}

const ACCUM_MULT = 3;

// Resolve a full cascade (array of match-group steps) applying effects.
export function resolveCascade(
  att: Combatant,
  def: Combatant,
  steps: MatchGroup[][],
  stats: PlayerStats,
  isPlayer: boolean,
): { logs: BattleLogEntry[]; hadBigMatch: boolean; depth: number } {
  const logs: BattleLogEntry[] = [];
  let hadBigMatch = false;
  let strategyThisCascade = false;
  for (let depth = 0; depth < steps.length; depth++) {
    const coeff = depth + 1 <= 1 ? 1 : depth + 1 === 2 ? 1.5 : depth + 1 === 3 ? 2 : 3;
    const groups = steps[depth];
    for (const g of groups) {
      const type = g.type as GemType;
      const count = g.size;
      if (count >= 4) {
        hadBigMatch = true;
        if (isPlayer) {
          if (count >= 5) stats.match5++;
          else stats.match4++;
        }
      }
      switch (type) {
        case 0: {
          // 武 physical attack
          att.weapon.dur = Math.max(0, att.weapon.dur - 1);
          const r = physicalAttack(att, def, count, coeff);
          const res = applyHit(def, r.damage, 10, true);
          logs.push({
            text: `武攻 ${count}连×${coeff} 造成 ${Math.round(r.damage)} 伤害${res.perfect ? "（完美防御！）" : ""}`,
            kind: res.perfect ? "defense" : "attack",
            side: att.side,
          });
          if (res.perfect && !isPlayer) stats.perfectDefenses++;
          break;
        }
        case 1: {
          // 计 strategy provocation
          strategyThisCascade = true;
          let dmg = ((att.intel - def.intel) * count) / 15 * coeff;
          if (dmg < 5) dmg = 5;
          def.hp = Math.max(0, def.hp - dmg);
          def.ultAccum = Math.max(0, def.ultAccum - dmg);
          def.defenseAccum = Math.max(0, def.defenseAccum - dmg);
          def.retreatAccum = Math.max(0, def.retreatAccum - 5);
          def.rage = Math.min(50, def.rage + 5 + dmg * rageCoeff(def));
          logs.push({
            text: `计略 ${count}连×${coeff} 造成 ${Math.round(dmg)} 伤害，敌必杀/防御下降`,
            kind: "strategy",
            side: att.side,
          });
          break;
        }
        case 2: {
          // 防 defense accumulation
          const gain = count * coeff * ACCUM_MULT;
          const before = att.defenseAccum;
          att.defenseAccum = Math.min(70, att.defenseAccum + gain);
          logs.push({
            text: `防御 ${count}连×${coeff} 防御累积 +${Math.round(att.defenseAccum - before)}`,
            kind: "defense",
            side: att.side,
          });
          break;
        }
        case 3: {
          // 射 bow accumulation
          if (att.bow) {
            const gain = count * coeff * ACCUM_MULT;
            const before = att.bowAccum;
            att.bowAccum = Math.min(50, att.bowAccum + gain);
            logs.push({
              text: `弓箭 ${count}连×${coeff} 弓箭累积 +${Math.round(att.bowAccum - before)}（${att.bowAccum}/50）`,
              kind: "info",
              side: att.side,
            });
          }
          break;
        }
        case 4: {
          // 必 ultimate accumulation
          const gain = count * coeff * ACCUM_MULT;
          const before = att.ultAccum;
          att.ultAccum = Math.min(50, att.ultAccum + gain);
          logs.push({
            text: `必杀 ${count}连×${coeff} 必杀累积 +${Math.round(att.ultAccum - before)}（${att.ultAccum}/50）`,
            kind: "info",
            side: att.side,
          });
          break;
        }
        case 5: {
          // 撤 retreat accumulation
          const gain = count * coeff * ACCUM_MULT;
          const before = att.retreatAccum;
          att.retreatAccum = Math.min(50, att.retreatAccum + gain);
          logs.push({
            text: `撤退 ${count}连×${coeff} 撤退累积 +${Math.round(att.retreatAccum - before)}（${att.retreatAccum}/50）`,
            kind: "info",
            side: att.side,
          });
          break;
        }
      }
    }
  }
  const depth = steps.length;
  if (isPlayer) {
    if (depth === 2) stats.combo2++;
    else if (depth >= 3) stats.combo2plus++;
    if (strategyThisCascade) stats.strategyUses++;
  }
  return { logs, hadBigMatch, depth };
}

// Launch bow attack (explicit action, requires bowAccum == 50).
export function launchBow(
  att: Combatant,
  def: Combatant,
): { entry: BattleLogEntry; perfect: boolean } {
  let damage = att.force + bowAttack(att) - ((def.force + weaponAttack(def)) / 2 + armorDefense(def));
  if (damage < 0) damage = 0;
  if (att.bow) att.bow.dur = Math.max(0, att.bow.dur - 1);
  const res = applyHit(def, damage, 20, true);
  att.bowAccum = 0;
  return {
    entry: {
      text: `弓箭齐射！造成 ${Math.round(damage)} 伤害${res.perfect ? "（完美防御！）" : ""}`,
      kind: res.perfect ? "defense" : "bow",
      side: att.side,
    },
    perfect: res.perfect,
  };
}

// Launch ultimate (explicit action, requires ultAccum == 50).
export function launchUltimate(
  att: Combatant,
  def: Combatant,
): { entry: BattleLogEntry; super: boolean; perfect: boolean } {
  const base = physicalAttack(att, def, 3, 1).damage;
  const isSuper = att.rage >= 50;
  const damage = base * (isSuper ? 5 : 3);
  att.weapon.dur = Math.max(0, att.weapon.dur - 1);
  const res = applyHit(def, damage, isSuper ? 50 : 30, true);
  att.ultAccum = 0;
  if (isSuper) att.rage = 0;
  return {
    entry: {
      text: `${isSuper ? "超必杀技！" : "必杀技！"} 造成 ${Math.round(damage)} 伤害${res.perfect ? "（完美防御！）" : ""}`,
      kind: isSuper ? "super" : "ultimate",
      side: att.side,
    },
    super: isSuper,
    perfect: res.perfect,
  };
}

// Begin retreat (explicit action, requires retreatAccum == 50).
export function beginRetreat(c: Combatant): void {
  c.retreatPending = true;
  c.defenseAccum = 0;
}

// ---- Turn order ----
const RATIO_PATTERNS: { ratio: number; a: number; pattern: string }[] = [
  { ratio: 1 / 2, a: 1, pattern: "AAB" },
  { ratio: 2 / 3, a: 2, pattern: "ABAAB" },
  { ratio: 3 / 4, a: 3, pattern: "ABABAAB" },
  { ratio: 4 / 5, a: 4, pattern: "ABABABAAB" },
  { ratio: 6 / 7, a: 6, pattern: "ABABABABAAB" },
  { ratio: 7 / 8, a: 7, pattern: "ABABABABABAAB" },
  { ratio: 8 / 9, a: 8, pattern: "ABABABABABABAAB" },
  { ratio: 9 / 10, a: 9, pattern: "ABABABABABABABAAB" },
];

export interface TurnOrder {
  pattern: string; // of A/B
  aSide: "player" | "ai";
}

export function buildTurnOrder(player: Combatant, ai: Combatant): TurnOrder {
  const pw = totalWeight(player);
  const aw = totalWeight(ai);
  if (pw === aw) {
    // Equal weight -> alternating, higher 4-dim sum first.
    const aSide = fourDimSum(player) >= fourDimSum(ai) ? "player" : "ai";
    return { pattern: "AB", aSide };
  }
  const lighterIsPlayer = pw < aw;
  const light = Math.min(pw, aw);
  const heavy = Math.max(pw, aw);
  const ratio = light / heavy;
  let chosen = RATIO_PATTERNS[0];
  if (ratio >= 1 / 2) {
    let best = RATIO_PATTERNS[0];
    let bestDiff = Infinity;
    for (const p of RATIO_PATTERNS) {
      const diff = Math.abs(p.ratio - ratio);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    chosen = best;
  }
  const aSide: "player" | "ai" = lighterIsPlayer ? "player" : "ai";
  return { pattern: chosen.pattern, aSide };
}

export function turnSide(order: TurnOrder, index: number): "player" | "ai" {
  const ch = order.pattern[index % order.pattern.length];
  return ch === "A" ? order.aSide : order.aSide === "player" ? "ai" : "player";
}

// ---- Win conditions ----
export type BattleResult = "ongoing" | "player_win" | "player_lose" | "draw";

export function checkResult(player: Combatant, ai: Combatant): BattleResult {
  // retreat resolved where the acting side is handled in the controller.
  const playerWeaponsDead = player.weapon.dur <= 0 && (!player.bow || player.bow.dur <= 0);
  const aiWeaponsDead = ai.weapon.dur <= 0 && (!ai.bow || ai.bow.dur <= 0);
  if (playerWeaponsDead && aiWeaponsDead) return "draw";
  if (player.hp <= 0) return "player_lose";
  if (ai.hp <= 0) return "player_win";
  return "ongoing";
}

// ---- Scoring ----
export interface ScoreInput extends PlayerStats {
  totalRounds: number;
}

export interface ScoreBreakdown {
  score: number;
  totalRounds: number;
  comboRate: number;
  match45Rate: number;
  ultimateRate: number;
  superRate: number;
  bowRate: number;
  strategyRate: number;
  perfectRate: number;
}

export function computeScore(s: ScoreInput, general: General): ScoreBreakdown {
  const totalRounds = Math.max(1, s.totalRounds);
  const numerator =
    s.combo2 * 5 +
    s.combo2plus * 10 +
    s.match4 * 10 +
    s.match5 * 20 +
    s.ultimate * 20 +
    s.superUltimate * 50 +
    s.bowShots * 20 +
    s.strategyUses * 10 +
    s.perfectDefenses * 20 +
    (100 - general.force) * 10 +
    (100 - general.intelligence) * 5 +
    general.virtue * 5 +
    (100 - general.stamina) * 10;
  const score = Math.floor(numerator / totalRounds);
  const r = (n: number) => totalRounds > 0 ? n / totalRounds : 0;
  return {
    score,
    totalRounds,
    comboRate: r(s.combo2 + s.combo2plus),
    match45Rate: r(s.match4 + s.match5),
    ultimateRate: r(s.ultimate),
    superRate: r(s.superUltimate),
    bowRate: r(s.bowShots),
    strategyRate: r(s.strategyUses),
    perfectRate: r(s.perfectDefenses),
  };
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
