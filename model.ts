const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function todayISO(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utcMidnight(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

export function formatDay(iso: string, style: "long" | "short" = "long"): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[(m || 1) - 1] ?? "";
  if (style === "short") return `${month} ${d}`;
  return `${month} ${d}, ${y}`;
}

export type Kind = "asset" | "liability";

export type Category =
  | "cash"
  | "investments"
  | "retirement"
  | "property"
  | "vehicle"
  | "other-asset"
  | "credit"
  | "loan"
  | "mortgage"
  | "other-debt";

export interface CategoryMeta {
  id: Category;
  label: string;
  kind: Kind;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "cash", label: "Cash", kind: "asset" },
  { id: "investments", label: "Investments", kind: "asset" },
  { id: "retirement", label: "Retirement", kind: "asset" },
  { id: "property", label: "Property", kind: "asset" },
  { id: "vehicle", label: "Vehicle", kind: "asset" },
  { id: "other-asset", label: "Other asset", kind: "asset" },
  { id: "credit", label: "Credit card", kind: "liability" },
  { id: "loan", label: "Loan", kind: "liability" },
  { id: "mortgage", label: "Mortgage", kind: "liability" },
  { id: "other-debt", label: "Other debt", kind: "liability" },
];

export interface Account {
  id: string;
  name: string;
  kind: Kind;
  category: Category;
  apr: number | null;
}

export interface Snapshot {
  date: string;
  balances: Record<string, number>;
}

export interface LedgerData {
  accounts: Account[];
  snapshots: Snapshot[];
  goal: number | null;
  usingSample: boolean;
}

export type RangeKey = "6M" | "1Y" | "2Y" | "ALL";
export type Horizon = 6 | 12 | 24 | 36;

export interface WhatIf {
  marketPct: number;
  propertyPct: number;
  extraMonthly: number;
  horizon: Horizon;
}

export const DEFAULT_WHAT_IF: WhatIf = {
  marketPct: 0,
  propertyPct: 0,
  extraMonthly: 0,
  horizon: 12,
};

export const RANGES: RangeKey[] = ["6M", "1Y", "2Y", "ALL"];
export const HORIZONS: Horizon[] = [6, 12, 24, 36];

export interface Persisted {
  version: 1;
  accounts: Account[];
  snapshots: Snapshot[];
  goal: number | null;
  usingSample: boolean;
  activeDate: string | null;
  whatIf: WhatIf;
  range: RangeKey;
}

export interface Totals {
  net: number;
  assets: number;
  debts: number;
}

export interface CategorySlice {
  category: Category;
  label: string;
  kind: Kind;
  value: number;
  pct: number;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: "up" | "down" | "plain";
}

export interface ChartPoint {
  key: string;
  readingDate: string | null;
  tick: string;
  tipTitle: string;
  net: number | null;
  assets: number | null;
  debts: number | null;
  pace: number | null;
  scenario: number | null;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function moneyCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function moneySigned(n: number): string {
  const abs = money(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function percentSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function categoryMeta(id: Category): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function categoriesFor(kind: Kind): CategoryMeta[] {
  return CATEGORIES.filter((c) => c.kind === kind);
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_000) return null;
  return Math.round(n);
}

function roundMoney(n: number): number {
  return Math.max(0, Math.round(n));
}

function shockFactor(i: number): number {
  if (i < 9 || i > 15) return 1;
  return 1 - 0.18 * Math.sin(((i - 9) / 6) * Math.PI);
}

export function buildSample(now = new Date()): LedgerData {
  const accounts: Account[] = [
    { id: "chk", name: "Everyday checking", kind: "asset", category: "cash", apr: null },
    { id: "hysa", name: "Reserve savings", kind: "asset", category: "cash", apr: null },
    { id: "brk", name: "Brokerage", kind: "asset", category: "investments", apr: null },
    { id: "ret", name: "Retirement", kind: "asset", category: "retirement", apr: null },
    { id: "home", name: "Primary home", kind: "asset", category: "property", apr: null },
    { id: "car", name: "Car", kind: "asset", category: "vehicle", apr: null },
    { id: "mtg", name: "Home mortgage", kind: "liability", category: "mortgage", apr: 6.25 },
    { id: "stu", name: "Student loan", kind: "liability", category: "loan", apr: 4.8 },
    { id: "cc", name: "Credit card", kind: "liability", category: "credit", apr: 21.9 },
  ];

  const snapshots: Snapshot[] = [];
  for (let i = 0; i < 24; i++) {
    const date =
      i === 23
        ? todayISO(now)
        : todayISO(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (23 - i), 1)));
    const shock = shockFactor(i);
    const trend = Math.pow(1.0065, i);
    snapshots.push({
      date,
      balances: {
        chk: roundMoney(6400 + Math.sin(i / 2) * 900 + i * 25),
        hysa: roundMoney(22000 + i * 480),
        brk: roundMoney(78000 * trend * shock),
        ret: roundMoney((112000 + i * 1400) * shock),
        home: roundMoney(465000 + i * 1100),
        car: roundMoney(24000 * Math.pow(0.987, i)),
        mtg: roundMoney(286000 * Math.pow(0.9965, i)),
        stu: roundMoney(16800 - i * 310),
        cc: roundMoney(900 + (0.5 + 0.5 * Math.sin(i * 0.85)) * 1800),
      },
    });
  }

  const dedup = new Map<string, Snapshot>();
  for (const snap of snapshots) dedup.set(snap.date, snap);

  return {
    accounts,
    snapshots: [...dedup.values()].sort((a, b) => a.date.localeCompare(b.date)),
    goal: 550000,
    usingSample: true,
  };
}

export function freshLedger(now = new Date()): LedgerData {
  return {
    accounts: [],
    snapshots: [{ date: todayISO(now), balances: {} }],
    goal: null,
    usingSample: false,
  };
}

export function signedBalance(account: Account, amount: number): number {
  return account.kind === "asset" ? amount : -amount;
}

export function totals(snapshot: Snapshot, accounts: Account[]): Totals {
  let assets = 0;
  let debts = 0;
  for (const account of accounts) {
    const amount = snapshot.balances[account.id] ?? 0;
    if (account.kind === "asset") assets += amount;
    else debts += amount;
  }
  return { net: assets - debts, assets, debts };
}

export function slices(snapshot: Snapshot, accounts: Account[], kind: Kind): CategorySlice[] {
  const grouped = new Map<Category, number>();
  for (const account of accounts) {
    if (account.kind !== kind) continue;
    const amount = snapshot.balances[account.id] ?? 0;
    grouped.set(account.category, (grouped.get(account.category) ?? 0) + amount);
  }
  const rows = categoriesFor(kind)
    .map((meta) => ({
      category: meta.id,
      label: meta.label,
      kind,
      value: grouped.get(meta.id) ?? 0,
      pct: 0,
    }))
    .filter((row) => row.value > 0);
  const sum = rows.reduce((acc, row) => acc + row.value, 0);
  return rows.map((row) => ({ ...row, pct: sum > 0 ? (row.value / sum) * 100 : 0 }));
}

export function orderedAccounts(accounts: Account[], kind: Kind): Account[] {
  const rank = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => account.kind === kind)
    .sort(
      (a, b) =>
        (rank.get(a.account.category) ?? 0) - (rank.get(b.account.category) ?? 0) ||
        a.index - b.index,
    )
    .map(({ account }) => account);
}

export function previousSnapshot(snapshots: Snapshot[], date: string): Snapshot | null {
  const index = snapshots.findIndex((s) => s.date === date);
  if (index <= 0) return null;
  return snapshots[index - 1] ?? null;
}

export function resolveActiveDate(snapshots: Snapshot[], activeDate: string | null): string | null {
  if (activeDate && snapshots.some((s) => s.date === activeDate)) return activeDate;
  return snapshots[snapshots.length - 1]?.date ?? null;
}

function snapshotAround(snapshots: Snapshot[], iso: string, daysBack: number): Snapshot | null {
  const target = utcMidnight(iso) - daysBack * 86_400_000;
  const current = utcMidnight(iso);
  let best: Snapshot | null = null;
  let bestDist = Infinity;
  for (const snap of snapshots) {
    const time = utcMidnight(snap.date);
    if (time >= current) continue;
    const dist = Math.abs(time - target);
    if (dist < bestDist) {
      best = snap;
      bestDist = dist;
    }
  }
  if (!best || bestDist > 50 * 86_400_000) return null;
  return best;
}

export function yearSnapshot(snapshots: Snapshot[], iso: string): Snapshot | null {
  return snapshotAround(snapshots, iso, 365);
}

export function pacePerMonth(snapshots: Snapshot[], accounts: Account[], uptoDate: string): number | null {
  const index = snapshots.findIndex((s) => s.date === uptoDate);
  if (index < 1) return null;
  const window = snapshots.slice(Math.max(0, index - 5), index + 1);
  if (window.length < 2) return null;
  const first = window[0];
  const last = window[window.length - 1];
  const days = Math.max(1, Math.round((utcMidnight(last.date) - utcMidnight(first.date)) / 86_400_000));
  const delta = totals(last, accounts).net - totals(first, accounts).net;
  return (delta / days) * 30.437;
}

export function shockedNet(snapshot: Snapshot, accounts: Account[], whatIf: WhatIf): number {
  let net = 0;
  for (const account of accounts) {
    let amount = snapshot.balances[account.id] ?? 0;
    if (account.kind === "asset" && (account.category === "investments" || account.category === "retirement")) {
      amount *= 1 + whatIf.marketPct / 100;
    } else if (account.kind === "asset" && account.category === "property") {
      amount *= 1 + whatIf.propertyPct / 100;
    }
    net += signedBalance(account, amount);
  }
  return net;
}

export function hasCategory(accounts: Account[], category: Category): boolean {
  return accounts.some((a) => a.category === category && (a.kind === "liability" || true));
}

export function hasInvestable(accounts: Account[]): boolean {
  return accounts.some(
    (a) => a.kind === "asset" && (a.category === "investments" || a.category === "retirement"),
  );
}

export function hasProperty(accounts: Account[]): boolean {
  return accounts.some((a) => a.kind === "asset" && a.category === "property");
}

function monthsAgoISO(now: Date, months: number): string {
  return todayISO(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate())));
}

export function filterRange(snapshots: Snapshot[], range: RangeKey, now = new Date()): Snapshot[] {
  if (range === "ALL" || snapshots.length === 0) return snapshots;
  const months = range === "6M" ? 6 : range === "1Y" ? 12 : 24;
  const cutoff = monthsAgoISO(now, months);
  const filtered = snapshots.filter((s) => s.date >= cutoff);
  return filtered.length > 0 ? filtered : snapshots.slice(-1);
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function horizonPhrase(months: number): string {
  if (months < 18) return `${months} months`;
  const years = Math.round(months / 12);
  return years === 1 ? "1 year" : `${years} years`;
}

function etaPhrase(months: number): string {
  if (months < 1) return "under a month";
  const rounded = Math.round(months);
  if (rounded <= 18) return rounded === 1 ? "about 1 month" : `about ${rounded} months`;
  const years = Math.round(rounded / 12);
  return years === 1 ? "about a year" : `about ${years} years`;
}

export function scenarioCopy(args: {
  accounts: Account[];
  anchor: Snapshot | null;
  snapshots: Snapshot[];
  whatIf: WhatIf;
}): string {
  const { accounts, anchor, snapshots, whatIf } = args;
  if (!anchor) return "Add a reading before projecting.";
  const base = totals(anchor, accounts).net;
  const shocked = shockedNet(anchor, accounts, whatIf);
  const pace = pacePerMonth(snapshots, accounts, anchor.date);
  const endPace = base + (pace ?? 0) * whatIf.horizon;
  const endScenario = shocked + (pace ?? 0) * whatIf.horizon + whatIf.extraMonthly * whatIf.horizon;
  const levers: string[] = [];
  if (whatIf.marketPct !== 0) {
    levers.push(`markets ${whatIf.marketPct > 0 ? "up" : "down"} ${Math.abs(whatIf.marketPct)}%`);
  }
  if (whatIf.propertyPct !== 0) {
    levers.push(`property ${whatIf.propertyPct > 0 ? "up" : "down"} ${Math.abs(whatIf.propertyPct)}%`);
  }
  if (whatIf.extraMonthly > 0) {
    levers.push(`saving an extra ${money(whatIf.extraMonthly)} a month`);
  }
  const when = horizonPhrase(whatIf.horizon);
  if (levers.length === 0) {
    if (pace == null) return "Add another reading to sketch a pace. The sliders still show a one-time shock.";
    return `If the recent pace holds, about ${money(endPace)} in ${when}. Move a slider to bend that.`;
  }
  let sentence = `With ${joinAnd(levers)}, this reading becomes ${money(shocked)} today`;
  if (pace == null && whatIf.extraMonthly === 0) return `${sentence}.`;
  sentence += `, and about ${money(endScenario)} in ${when}`;
  if (pace != null) {
    const gap = endScenario - endPace;
    if (Math.abs(gap) >= 100) {
      sentence += ` — ${money(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the recent pace`;
    }
  }
  return `${sentence}.`;
}

export function buildInsights(args: {
  accounts: Account[];
  snapshots: Snapshot[];
  active: Snapshot;
  goal: number | null;
}): Insight[] {
  const { accounts, snapshots, active, goal } = args;
  const nowTotals = totals(active, accounts);
  const prev = previousSnapshot(snapshots, active.date);
  const insights: Insight[] = [];

  if (!prev) {
    insights.push({
      id: "change",
      title: "Since last reading",
      body: "This is the only reading so far. Add an earlier date and the chart can show a change.",
      tone: "plain",
    });
  } else {
    const before = totals(prev, accounts).net;
    const delta = nowTotals.net - before;
    const pct = before !== 0 ? (delta / Math.abs(before)) * 100 : null;
    insights.push({
      id: "change",
      title: "Since last reading",
      body: `${moneySigned(delta)}${pct == null ? "" : ` (${percentSigned(pct)})`} since ${formatDay(prev.date)}.`,
      tone: delta > 0 ? "up" : delta < 0 ? "down" : "plain",
    });
  }

  const year = snapshotAround(snapshots, active.date, 365);
  if (year) {
    const then = totals(year, accounts).net;
    const delta = nowTotals.net - then;
    const pct = then !== 0 ? (delta / Math.abs(then)) * 100 : null;
    insights.push({
      id: "year",
      title: "Past year",
      body: `${moneySigned(delta)}${pct == null ? "" : ` (${percentSigned(pct)})`} versus ${formatDay(year.date)}.`,
      tone: delta > 0 ? "up" : delta < 0 ? "down" : "plain",
    });
  }

  if (goal != null) {
    const gap = goal - nowTotals.net;
    const pace = pacePerMonth(snapshots, accounts, active.date);
    if (gap <= 0) {
      insights.push({
        id: "goal",
        title: "Goal",
        body: `You're already ${money(Math.abs(gap))} past ${money(goal)}.`,
        tone: "up",
      });
    } else if (pace != null && pace > 1) {
      insights.push({
        id: "goal",
        title: "Goal",
        body: `${money(goal)} is ${money(gap)} away. At the recent pace, that's ${etaPhrase(gap / pace)}.`,
        tone: "plain",
      });
    } else if (pace != null) {
      insights.push({
        id: "goal",
        title: "Goal",
        body: `${money(goal)} is ${money(gap)} away, and the recent pace isn't climbing toward it.`,
        tone: "down",
      });
    } else {
      insights.push({
        id: "goal",
        title: "Goal",
        body: `${money(goal)} is ${money(gap)} away. A second reading is what turns that into a timeline.`,
        tone: "plain",
      });
    }
  }

  if (prev) {
    let best: { name: string; delta: number; kind: Kind } | null = null;
    for (const account of accounts) {
      const delta = (active.balances[account.id] ?? 0) - (prev.balances[account.id] ?? 0);
      if (!best || Math.abs(delta) > Math.abs(best.delta)) {
        best = { name: account.name, delta, kind: account.kind };
      }
    }
    if (best && Math.abs(best.delta) >= 1) {
      const direction = best.delta > 0 ? "up" : "down";
      const helpful =
        (best.kind === "asset" && best.delta > 0) || (best.kind === "liability" && best.delta < 0);
      insights.push({
        id: "mover",
        title: "Largest move",
        body: `${best.name} moved the most, ${direction} ${money(Math.abs(best.delta))} since ${formatDay(prev.date, "short")}.`,
        tone: helpful ? "up" : best.delta === 0 ? "plain" : "down",
      });
    }
  }

  if (nowTotals.assets > 0) {
    let top: { name: string; value: number } | null = null;
    let cash = 0;
    for (const account of accounts) {
      if (account.kind !== "asset") continue;
      const value = active.balances[account.id] ?? 0;
      if (account.category === "cash") cash += value;
      if (!top || value > top.value) top = { name: account.name, value };
    }
    const cashPct = (cash / nowTotals.assets) * 100;
    const topPct = top ? (top.value / nowTotals.assets) * 100 : 0;
    if (top && topPct >= 50) {
      insights.push({
        id: "mix",
        title: "Concentration",
        body: `${top.name} is ${Math.round(topPct)}% of assets. A price change there moves almost the whole chart.`,
        tone: "plain",
      });
    } else if (cashPct < 8) {
      insights.push({
        id: "mix",
        title: "Cash",
        body: `Cash is ${money(cash)}, ${Math.round(cashPct)}% of assets. Most of this net worth isn't spendable.`,
        tone: "plain",
      });
    }
  }

  let interest = 0;
  let topCost: { name: string; cost: number } | null = null;
  for (const account of accounts) {
    if (account.kind !== "liability" || !account.apr) continue;
    const cost = (active.balances[account.id] ?? 0) * (account.apr / 100);
    interest += cost;
    if (!topCost || cost > topCost.cost) topCost = { name: account.name, cost };
  }
  if (interest >= 100 && topCost) {
    insights.push({
      id: "interest",
      title: "Interest",
      body: `At the rates on file, debt costs about ${money(interest)} a year. ${topCost.name} is ${money(topCost.cost)} of that.`,
      tone: "down",
    });
  } else if (nowTotals.assets > 0 && nowTotals.debts > 0) {
    const cents = Math.round((nowTotals.debts / nowTotals.assets) * 100);
    insights.push({
      id: "leverage",
      title: "Leverage",
      body: `You owe ${money(nowTotals.debts)} against ${money(nowTotals.assets)} of assets — ${cents} cents of debt per dollar owned.`,
      tone: "plain",
    });
  }

  if (accounts.length === 0) {
    return [
      {
        id: "empty",
        title: "Start",
        body: "Add what you own and what you owe. The chart, mix, and these notes update as the numbers change.",
        tone: "plain",
      },
    ];
  }

  return insights.slice(0, 5);
}

function tickFor(iso: string, index: number, isos: string[]): string {
  const crowded = isos.filter((item) => item.slice(0, 7) === iso.slice(0, 7)).length > 1;
  const [y, mRaw, d] = iso.split("-").map(Number);
  const m = mRaw || 1;
  const month = MONTHS[m - 1] ?? "";
  const yy = String(y ?? "").slice(2);
  if (index === 0 || m === 1) return crowded ? `${month} ${d} '${yy}` : `${month} '${yy}`;
  return crowded ? `${month} ${d}` : month;
}

export function buildChart(args: {
  accounts: Account[];
  snapshots: Snapshot[];
  range: RangeKey;
  whatIf: WhatIf;
  activeDate: string | null;
  now?: Date;
}): { points: ChartPoint[]; scenarioOn: boolean; showPace: boolean } {
  const now = args.now ?? new Date();
  const visible = filterRange(args.snapshots, args.range, now);
  const latest = args.snapshots[args.snapshots.length - 1] ?? null;
  const activeDate = resolveActiveDate(args.snapshots, args.activeDate);
  const project = Boolean(latest && activeDate === latest.date);
  const isos = visible.map((s) => s.date);
  const points: ChartPoint[] = visible.map((snap, index) => {
    const figure = totals(snap, args.accounts);
    return {
      key: snap.date,
      readingDate: snap.date,
      tick: tickFor(snap.date, index, isos),
      tipTitle: formatDay(snap.date),
      net: figure.net,
      assets: figure.assets,
      debts: figure.debts,
      pace: null,
      scenario: null,
    };
  });

  const scenarioOn =
    project &&
    (args.whatIf.marketPct !== 0 || args.whatIf.propertyPct !== 0 || args.whatIf.extraMonthly !== 0);
  const pace = latest && project ? pacePerMonth(args.snapshots, args.accounts, latest.date) : null;
  const showPace = pace != null;

  if (latest && project && points.length > 0) {
    const anchor = points[points.length - 1];
    const base = totals(latest, args.accounts).net;
    const shocked = shockedNet(latest, args.accounts, args.whatIf);
    if (showPace) anchor.pace = base;
    if (scenarioOn) anchor.scenario = shocked;
    for (let month = 1; month <= args.whatIf.horizon; month += 1) {
      const showTick = month === args.whatIf.horizon || month % (args.whatIf.horizon > 12 ? 6 : 3) === 0;
      points.push({
        key: `future-${month}`,
        readingDate: null,
        tick: showTick ? `+${month}m` : "",
        tipTitle: `${month} month${month === 1 ? "" : "s"} out`,
        net: null,
        assets: null,
        debts: null,
        pace: showPace ? base + pace! * month : null,
        scenario: scenarioOn ? shocked + (pace ?? 0) * month + args.whatIf.extraMonthly * month : null,
      });
    }
  }

  return { points, scenarioOn, showPace };
}

export function yDomain(values: Array<number | null | undefined>): [number, number] {
  const nums = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (nums.length === 0) return [0, 1];
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    const pad = Math.max(1000, Math.abs(min) * 0.08);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.16;
  return [min - pad, max + pad];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.id === value);
}

function parseAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id || item.id.length > 80) return null;
  if (typeof item.name !== "string") return null;
  if (item.kind !== "asset" && item.kind !== "liability") return null;
  if (typeof item.category !== "string" || !isCategory(item.category)) return null;
  if (categoryMeta(item.category).kind !== item.kind) return null;
  let apr: number | null = null;
  if (typeof item.apr === "number" && Number.isFinite(item.apr)) {
    apr = clamp(Math.round(item.apr * 10) / 10, 0, 80);
  }
  return {
    id: item.id,
    name: item.name.trim().slice(0, 40) || (item.kind === "asset" ? "Untitled asset" : "Untitled debt"),
    kind: item.kind,
    category: item.category,
    apr,
  };
}

function parseSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.date !== "string" || !DATE_RE.test(item.date)) return null;
  const balances: Record<string, number> = {};
  if (item.balances && typeof item.balances === "object") {
    for (const [key, value] of Object.entries(item.balances as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      balances[key] = clamp(Math.round(value), 0, 1_000_000_000_000);
    }
  }
  return { date: item.date, balances };
}

function isRange(value: unknown): value is RangeKey {
  return value === "6M" || value === "1Y" || value === "2Y" || value === "ALL";
}

function isHorizon(value: number): value is Horizon {
  return value === 6 || value === 12 || value === 24 || value === 36;
}

export function sanitizeWhatIf(raw: Partial<WhatIf> | null | undefined): WhatIf {
  const market = typeof raw?.marketPct === "number" ? raw.marketPct : 0;
  const property = typeof raw?.propertyPct === "number" ? raw.propertyPct : 0;
  const extra = typeof raw?.extraMonthly === "number" ? raw.extraMonthly : 0;
  const horizon = typeof raw?.horizon === "number" && isHorizon(raw.horizon) ? raw.horizon : 12;
  return {
    marketPct: clamp(Math.round(market), -40, 40),
    propertyPct: clamp(Math.round(property), -30, 30),
    extraMonthly: clamp(Math.round(extra), 0, 100_000),
    horizon,
  };
}

export function parsePersisted(raw: unknown): Persisted | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (item.version !== 1 || !Array.isArray(item.accounts) || !Array.isArray(item.snapshots)) return null;
  const accounts: Account[] = [];
  for (const entry of item.accounts.slice(0, 40)) {
    const account = parseAccount(entry);
    if (account) accounts.push(account);
  }
  const ids = new Set(accounts.map((a) => a.id));
  if (ids.size !== accounts.length) return null;
  const snapshots: Snapshot[] = [];
  for (const entry of item.snapshots.slice(0, 360)) {
    const snap = parseSnapshot(entry);
    if (!snap) continue;
    const balances: Record<string, number> = {};
    for (const [id, value] of Object.entries(snap.balances)) {
      if (ids.has(id)) balances[id] = value;
    }
    snapshots.push({ date: snap.date, balances });
  }
  if (snapshots.length === 0) return null;
  const dedup = new Map<string, Snapshot>();
  for (const snap of snapshots) dedup.set(snap.date, snap);
  const ordered = [...dedup.values()].sort((a, b) => a.date.localeCompare(b.date));
  const goal =
    typeof item.goal === "number" && Number.isFinite(item.goal)
      ? clamp(Math.round(item.goal), 0, 1_000_000_000_000)
      : null;
  const activeDate = typeof item.activeDate === "string" ? item.activeDate : null;
  return {
    version: 1,
    accounts,
    snapshots: ordered,
    goal,
    usingSample: item.usingSample === true,
    activeDate: resolveActiveDate(ordered, activeDate),
    whatIf: sanitizeWhatIf(
      item.whatIf && typeof item.whatIf === "object" ? (item.whatIf as Partial<WhatIf>) : null,
    ),
    range: isRange(item.range) ? item.range : "1Y",
  };
}

export function toPersisted(state: Persisted): Persisted {
  return {
    version: 1,
    accounts: state.accounts,
    snapshots: state.snapshots,
    goal: state.goal,
    usingSample: state.usingSample,
    activeDate: state.activeDate,
    whatIf: state.whatIf,
    range: state.range,
  };
}
