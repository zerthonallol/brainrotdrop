import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { TAG, type CaseDef, type Drop } from "@/data/cases"
import {
  DEMO_INVITED_FRIENDS,
  DEMO_START_BALANCE,
  DEMO_START_INVENTORY,
  DEMO_USER,
  type DemoUser,
} from "@/data/fixtures"
import { initTelegram } from "./telegram"

export interface InvItem {
  uid: string
  brainrotId: string
  obtainedAt: number
  status: "owned" | "withdrawing"
}

export interface TransferRequest {
  id: string
  type: "deposit" | "withdraw"
  brainrotId: string
  robloxNick: string
  creditAs?: "coins" | "brainrot"
  status: "pending" | "approved" | "rejected"
  createdAt: number
}

interface Store {
  user: DemoUser
  inTelegram: boolean
  balance: number
  inventory: InvItem[]
  requests: TransferRequest[]
  invitedFriends: number
  cooldowns: Record<string, number>
  hasTag: boolean
  canAfford: (n: number) => boolean
  spend: (n: number) => boolean
  credit: (n: number) => void
  grant: (d: Drop) => InvItem | null
  removeItems: (uids: string[]) => void
  sellItem: (uid: string) => void
  claimCase: (c: CaseDef) => void
  caseReadyAt: (c: CaseDef) => number
  requestDeposit: (brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => void
  requestWithdraw: (uid: string, robloxNick: string) => void
}

const Ctx = createContext<Store | null>(null)
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser>(DEMO_USER)
  const [inTelegram, setInTelegram] = useState(false)
  const [balance, setBalance] = useState(DEMO_START_BALANCE)
  const [inventory, setInventory] = useState<InvItem[]>(() =>
    DEMO_START_INVENTORY.map((id, i) => ({ uid: "seed" + i, brainrotId: id, obtainedAt: 0, status: "owned" })),
  )
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})

  useEffect(() => {
    // telegram-web-app.js may finish loading after hydration, so retry briefly.
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const u = initTelegram()
      if (u) {
        setInTelegram(true)
        setUser({ id: u.id, firstName: u.first_name, lastName: u.last_name, username: u.username, photoUrl: u.photo_url })
      } else if (!window.Telegram && tries++ < 30) {
        timer = setTimeout(attempt, 100)
      }
    }
    attempt()
    return () => clearTimeout(timer)
  }, [])

  const hasTag = `${user.firstName} ${user.lastName ?? ""}`.toLowerCase().includes(TAG)

  // Ref mirrors balance so rapid consecutive bets can't overspend between renders.
  const balanceRef = useRef(balance)
  balanceRef.current = balance
  const spend = useCallback((n: number) => {
    if (n <= 0 || balanceRef.current < n) return false
    balanceRef.current -= n
    setBalance((b) => b - n)
    return true
  }, [])

  const credit = useCallback((n: number) => setBalance((b) => b + n), [])

  const grant = useCallback((d: Drop) => {
    if (d.kind === "coins") {
      setBalance((b) => b + d.amount)
      return null
    }
    const item: InvItem = { uid: uid(), brainrotId: d.id, obtainedAt: Date.now(), status: "owned" }
    setInventory((inv) => [item, ...inv])
    return item
  }, [])

  const removeItems = useCallback((uids: string[]) => {
    setInventory((inv) => inv.filter((i) => !uids.includes(i.uid)))
  }, [])

  const sellItem = useCallback(
    (id: string) => {
      const it = inventory.find((i) => i.uid === id && i.status === "owned")
      if (!it) return
      setInventory((inv) => inv.filter((i) => i.uid !== id))
      setBalance((b) => b + (BRAINROT_BY_ID[it.brainrotId]?.price ?? 0))
    },
    [inventory],
  )

  const caseReadyAt = useCallback(
    (c: CaseDef) => {
      const last = cooldowns[c.id]
      if (!last || !c.cooldownHours) return 0
      return last + c.cooldownHours * 3600_000
    },
    [cooldowns],
  )

  const claimCase = useCallback((c: CaseDef) => {
    setCooldowns((cd) => ({ ...cd, [c.id]: Date.now() }))
  }, [])

  const requestDeposit = useCallback((brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => {
    setRequests((r) => [
      { id: uid(), type: "deposit", brainrotId, robloxNick, creditAs, status: "pending", createdAt: Date.now() },
      ...r,
    ])
  }, [])

  const requestWithdraw = useCallback(
    (itemUid: string, robloxNick: string) => {
      const it = inventory.find((i) => i.uid === itemUid && i.status === "owned")
      if (!it) return
      setInventory((inv) => inv.map((i) => (i.uid === itemUid ? { ...i, status: "withdrawing" } : i)))
      setRequests((r) => [
        { id: uid(), type: "withdraw", brainrotId: it.brainrotId, robloxNick, status: "pending", createdAt: Date.now() },
        ...r,
      ])
    },
    [inventory],
  )

  const value = useMemo<Store>(
    () => ({
      user,
      inTelegram,
      balance,
      inventory,
      requests,
      invitedFriends: DEMO_INVITED_FRIENDS,
      cooldowns,
      hasTag,
      canAfford: (n) => balance >= n,
      spend,
      credit,
      grant,
      removeItems,
      sellItem,
      claimCase,
      caseReadyAt,
      requestDeposit,
      requestWithdraw,
    }),
    [user, inTelegram, balance, inventory, requests, cooldowns, hasTag, spend, credit, grant, removeItems, sellItem, claimCase, caseReadyAt, requestDeposit, requestWithdraw],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error("useStore must be used inside StoreProvider")
  return s
}
