import { describe, expect, it } from "vitest"
import { BRAINROTS } from "@/data/brainrots"
import { CASES } from "@/data/cases"
import { START_BALANCE } from "@/lib/store"

describe("brainrot rules", () => {
  it("has no brainrots under 21M/s", () => {
    expect(BRAINROTS.every((b) => b.incomePerSec >= 21_000_000)).toBe(true)
  })

  it("prices by rarity, not income: a rarer brainrot always costs more", () => {
    const sorted = [...BRAINROTS].sort((a, b) => a.rarityScore - b.rarityScore)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].price).toBeGreaterThanOrEqual(sorted[i - 1].price)
  })

  it("has themed cases including Halloween, Crystal and Sea", () => {
    const ids = CASES.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(["halloween", "crystal", "sea"]))
    for (const c of CASES) expect(c.entries.length).toBeGreaterThan(2)
  })

  it("new players start with zero coins", () => {
    expect(START_BALANCE).toBe(0)
  })
})
