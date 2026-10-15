import { useEffect } from "react";
import { create } from "zustand";
import {
  buildSample,
  freshLedger,
  newId,
  parsePersisted,
  resolveActiveDate,
  sanitizeWhatIf,
  toPersisted,
  todayISO,
  type Account,
  type Category,
  type Horizon,
  type Kind,
  type LedgerData,
  type Persisted,
  type RangeKey,
  type WhatIf,
} from "@/lib/ledger/model";

const STORAGE_KEY = "fathom-ledger-v1";

export interface NewAccountInput {
  name: string;
  kind: Kind;
  category: Category;
  apr: number | null;
  balance: number;
}

interface LedgerState extends LedgerData {
  activeDate: string | null;
  whatIf: WhatIf;
  range: RangeKey;
  hydrated: boolean;
  anchor: string | null;
  hydrate: () => void;
  setActiveDate: (date: string) => void;
  stepReading: (direction: -1 | 1) => void;
  setBalance: (accountId: string, amount: number) => void;
  addAccount: (input: NewAccountInput) => void;
  updateAccount: (id: string, patch: Partial<Pick<Account, "name" | "category" | "apr">>) => void;
  removeAccount: (id: string) => void;
  addReading: (date: string) => void;
  removeReading: (date: string) => void;
  setGoal: (goal: number | null) => void;
  setWhatIf: (patch: Partial<WhatIf>) => void;
  setHorizon: (horizon: Horizon) => void;
  setRange: (range: RangeKey) => void;
  startFresh: () => void;
  loadSample: () => void;
  replaceAll: (data: Persisted) => void;
}

function sampleState(now = new Date()) {
  const sample = buildSample(now);
  return {
    ...sample,
    activeDate: sample.snapshots[sample.snapshots.length - 1]?.date ?? null,
    whatIf: sanitizeWhatIf(null),
    range: "1Y" as RangeKey,
  };
}

function activeDateOf(snapshots: LedgerData["snapshots"], activeDate: string | null): string | null {
  return resolveActiveDate(snapshots, activeDate);
}

export const useLedger = create<LedgerState>((set) => ({
  ...sampleState(),
  hydrated: false,
  anchor: null,
  hydrate: () => {
    if (typeof window === "undefined") return;
    set((state) => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { hydrated: true };
        const parsed = parsePersisted(JSON.parse(raw));
        if (!parsed) return { hydrated: true };
        return { ...parsed, hydrated: true, anchor: state.anchor };
      } catch {
        return { hydrated: true };
      }
    });
  },
  setActiveDate: (date) =>
    set((state) => {
      if (!state.snapshots.some((snap) => snap.date === date)) return state;
      return { activeDate: date };
    }),
  stepReading: (direction) =>
    set((state) => {
      const current = activeDateOf(state.snapshots, state.activeDate);
      const index = state.snapshots.findIndex((snap) => snap.date === current);
      const next = state.snapshots[index + direction];
      if (!next) return state;
      return { activeDate: next.date };
    }),
  setBalance: (accountId, amount) =>
    set((state) => {
      const date = activeDateOf(state.snapshots, state.activeDate);
      if (!date) return state;
      return {
        usingSample: false,
        snapshots: state.snapshots.map((snap) =>
          snap.date === date
            ? { ...snap, balances: { ...snap.balances, [accountId]: amount } }
            : snap,
        ),
      };
    }),
  addAccount: (input) =>
    set((state) => {
      const date = activeDateOf(state.snapshots, state.activeDate);
      const id = newId(input.kind === "asset" ? "asset" : "debt");
      const account: Account = {
        id,
        name: input.name.trim().slice(0, 40) || (input.kind === "asset" ? "Untitled asset" : "Untitled debt"),
        kind: input.kind,
        category: input.category,
        apr: input.kind === "liability" ? input.apr : null,
      };
      return {
        usingSample: false,
        accounts: [...state.accounts, account],
        snapshots: state.snapshots.map((snap) =>
          snap.date === date
            ? { ...snap, balances: { ...snap.balances, [id]: input.balance } }
            : snap,
        ),
      };
    }),
  updateAccount: (id, patch) =>
    set((state) => ({
      usingSample: false,
      accounts: state.accounts.map((account) => {
        if (account.id !== id) return account;
        const name = patch.name === undefined ? account.name : patch.name.slice(0, 40);
        return {
          ...account,
          name,
          category: patch.category ?? account.category,
          apr: account.kind === "liability" ? (patch.apr === undefined ? account.apr : patch.apr) : null,
        };
      }),
    })),
  removeAccount: (id) =>
    set((state) => ({
      usingSample: false,
      accounts: state.accounts.filter((account) => account.id !== id),
      snapshots: state.snapshots.map((snap) => {
        const balances = { ...snap.balances };
        delete balances[id];
        return { ...snap, balances };
      }),
    })),
  addReading: (date) =>
    set((state) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return state;
      if (state.snapshots.some((snap) => snap.date === date)) return { activeDate: date };
      const sourceDate = activeDateOf(state.snapshots, state.activeDate);
      const source = state.snapshots.find((snap) => snap.date === sourceDate) ?? state.snapshots.at(-1);
      const snapshots = [
        ...state.snapshots,
        { date, balances: { ...(source?.balances ?? {}) } },
      ].sort((a, b) => a.date.localeCompare(b.date));
      return { usingSample: false, snapshots, activeDate: date };
    }),
  removeReading: (date) =>
    set((state) => {
      if (state.snapshots.length < 2) return state;
      const snapshots = state.snapshots.filter((snap) => snap.date !== date);
      const index = state.snapshots.findIndex((snap) => snap.date === date);
      const fallback = snapshots[Math.max(0, index - 1)] ?? snapshots[snapshots.length - 1];
      return { usingSample: false, snapshots, activeDate: fallback?.date ?? null };
    }),
  setGoal: (goal) => set({ goal, usingSample: false }),
  setWhatIf: (patch) =>
    set((state) => ({
      whatIf: sanitizeWhatIf({ ...state.whatIf, ...patch }),
    })),
  setHorizon: (horizon) =>
    set((state) => ({
      whatIf: { ...state.whatIf, horizon },
    })),
  setRange: (range) => set({ range }),
  startFresh: () =>
    set((state) => {
      const now = state.anchor ? new Date(`${state.anchor}T00:00:00.000Z`) : new Date();
      const fresh = freshLedger(now);
      return {
        ...fresh,
        activeDate: fresh.snapshots[0]?.date ?? todayISO(now),
        whatIf: sanitizeWhatIf(null),
        range: "ALL",
        hydrated: true,
        anchor: state.anchor,
      };
    }),
  loadSample: () =>
    set((state) => {
      const now = state.anchor ? new Date(`${state.anchor}T00:00:00.000Z`) : new Date();
      return { ...sampleState(now), hydrated: true, anchor: state.anchor };
    }),
  replaceAll: (data) => set((state) => ({ ...data, hydrated: true, anchor: state.anchor })),
}));

export function ensureAnchor(nowIso: string) {
  const day = todayISO(new Date(nowIso));
  const state = useLedger.getState();
  if (state.anchor === day) return;
  if (state.hydrated) {
    useLedger.setState({ anchor: day });
    return;
  }
  const now = new Date(nowIso);
  useLedger.setState({
    ...sampleState(now),
    hydrated: false,
    anchor: day,
  });
}

export function useLedgerPersistence() {
  useEffect(() => {
    useLedger.getState().hydrate();
    return useLedger.subscribe((state) => {
      if (!state.hydrated) return;
      try {
        const payload: Persisted = toPersisted({
          version: 1,
          accounts: state.accounts,
          snapshots: state.snapshots,
          goal: state.goal,
          usingSample: state.usingSample,
          activeDate: state.activeDate,
          whatIf: state.whatIf,
          range: state.range,
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Private ledger only — ignore a full browser store.
      }
    });
  }, []);
}
