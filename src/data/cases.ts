import { BRAINROTS, BRAINROT_BY_ID, type Brainrot } from "./brainrots"

export type Drop =
  | { kind: "coins"; amount: number }
  | { kind: "brainrot"; id: string }

export interface CaseEntry {
  drop: Drop
  weight: number
}

export type CaseKind = "free" | "tag" | "referral" | "paid"

export interface CaseDef {
  id: string
  name: string
  subtitle: string
  kind: CaseKind
  price: number
  cooldownHours?: number
  accent: string
  cover: string
  entries: CaseEntry[]
}

export const TAG = "@brainrotdroppbot"

export function dropValue(d: Drop) {
  return d.kind === "coins" ? d.amount : (BRAINROT_BY_ID[d.id]?.price ?? 0)
}

const byIncome = (minM: number, maxM: number) =>
  BRAINROTS.filter((b) => b.incomePerSec >= minM * 1e6 && b.incomePerSec <= maxM * 1e6)

const coins = (amount: number): Drop => ({ kind: "coins", amount })
const rot = (b: Brainrot): Drop => ({ kind: "brainrot", id: b.id })

// Weights proportional to value^-k, with k found by bisection so the case returns
// `rtp` of its price on average. Cheap drops are common, jackpots stay rare.
function balance(drops: Drop[], price: number, rtp = 0.92): CaseEntry[] {
  const values = drops.map(dropValue)
  const target = price * rtp
  const ev = (k: number) => {
    const w = values.map((v) => Math.pow(v, -k))
    const sum = w.reduce((a, b) => a + b, 0)
    return values.reduce((acc, v, i) => acc + (v * w[i]) / sum, 0)
  }
  let lo = 0
  let hi = 12
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (ev(mid) > target) lo = mid
    else hi = mid
  }
  const k = (lo + hi) / 2
  const raw = values.map((v) => Math.pow(v, -k))
  const sum = raw.reduce((a, b) => a + b, 0)
  return drops.map((drop, i) => ({ drop, weight: raw[i] / sum }))
}

// Fixed split between a coin group and a brainrot group (used by bonus cases).
function split(coinDrops: number[], coinShare: number, rots: Brainrot[]): CaseEntry[] {
  const coinW = coinShare / coinDrops.length
  const inv = rots.map((r) => 1 / r.price)
  const invSum = inv.reduce((a, b) => a + b, 0)
  return [
    ...coinDrops.map((a) => ({ drop: coins(a), weight: coinW })),
    ...rots.map((r, i) => ({ drop: rot(r), weight: (1 - coinShare) * (inv[i] / invSum) })),
  ]
}

const cover = (id: string) => BRAINROT_BY_ID[id].image

export const CASES: CaseDef[] = [
  {
    id: "free",
    name: "Бесплатный",
    subtitle: "Раз в 24 часа · 1% на редкого брейнрота",
    kind: "free",
    price: 0,
    cooldownHours: 24,
    accent: "#22c55e",
    cover: cover("money-money-puggy"),
    entries: split([5, 10, 15, 25, 40], 0.99, byIncome(21, 30)),
  },
  {
    id: "tag",
    name: "Кейс за тег",
    subtitle: `Добавь ${TAG} в ник · раз в 24 ч`,
    kind: "tag",
    price: 0,
    cooldownHours: 24,
    accent: "#38bdf8",
    cover: cover("los-bros"),
    entries: split([20, 40, 60, 100, 150], 0.8, byIncome(21, 40)),
  },
  {
    id: "referral",
    name: "Реферальный",
    subtitle: "Пригласи друга · раз в 12 ч",
    kind: "referral",
    price: 0,
    cooldownHours: 12,
    accent: "#f472b6",
    cover: cover("los-puggies"),
    entries: split([30, 60, 100, 150, 200], 0.7, byIncome(21, 50)),
  },
  {
    id: "trash",
    name: "Мусорный",
    subtitle: "Брейнроты 21–35M/s",
    kind: "paid",
    price: 199,
    accent: "#84cc16",
    cover: cover("tralaledon"),
    entries: balance([coins(40), coins(90), ...byIncome(21, 35).map(rot)], 199),
  },
  {
    id: "sahur",
    name: "Сахур",
    subtitle: "Брейнроты 30–75M/s",
    kind: "paid",
    price: 449,
    accent: "#a855f7",
    cover: cover("tictac-sahur"),
    entries: balance([coins(150), ...byIncome(30, 75).map(rot)], 449),
  },
  {
    id: "combinasion",
    name: "Комбинасьон",
    subtitle: "Брейнроты 50–200M/s",
    kind: "paid",
    price: 999,
    accent: "#f59e0b",
    cover: cover("la-supreme-combinasion"),
    entries: balance([coins(300), ...byIncome(50, 200).map(rot)], 999),
  },
  {
    id: "dragon",
    name: "Драконий",
    subtitle: "Брейнроты 150–425M/s",
    kind: "paid",
    price: 2499,
    accent: "#ef4444",
    cover: cover("hydra-dragon-cannelloni"),
    entries: balance([coins(900), ...byIncome(150, 425).map(rot)], 2499),
  },
  {
    id: "og",
    name: "OG Легенды",
    subtitle: "Брейнроты 300M–1B/s",
    kind: "paid",
    price: 5999,
    accent: "#f472b6",
    cover: cover("strawberry-elephant"),
    entries: balance([coins(2500), ...byIncome(300, 1000).map(rot)], 5999),
  },
]

export function rollCase(c: CaseDef): Drop {
  let r = Math.random()
  for (const e of c.entries) {
    r -= e.weight
    if (r <= 0) return e.drop
  }
  return c.entries[c.entries.length - 1].drop
}

export function sortedEntries(c: CaseDef) {
  return [...c.entries].sort((a, b) => dropValue(b.drop) - dropValue(a.drop))
}
