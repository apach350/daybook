import { NEEDS, type Bill, type Entry, type Section } from "./types";
import {
  daysInMonth,
  daysRemaining,
  isoDate,
  monthKey,
  monthOf,
  parseMonth,
} from "./money";

export function sumCents(entries: Entry[]): number {
  return entries.reduce((total, entry) => total + entry.amountCents, 0);
}

export function monthEntries(entries: Entry[], month: string): Entry[] {
  return entries
    .filter((entry) => entry.section !== "inbox" && monthOf(entry.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export type MonthStats = {
  income: number;
  spending: number;
  debtPaid: number;
  left: number;
  safePerDay: number;
  daysLeft: number;
  spentPct: number | null;
  usedToday: number;
  onTrack: "on" | "over" | "pace" | "none";
  isCurrent: boolean;
};

export function monthStats(entries: Entry[], month: string, today: Date): MonthStats {
  const rows = monthEntries(entries, month);
  const income = sumCents(rows.filter((entry) => entry.section === "income"));
  const spending = sumCents(rows.filter((entry) => entry.section === "spending"));
  const debtPaid = sumCents(rows.filter((entry) => entry.section === "debt"));
  const left = income - spending - debtPaid;
  const isCurrent = month === monthKey(today);
  const daysLeft = isCurrent ? daysRemaining(today) : daysInMonth(month);
  const safePerDay = daysLeft > 0 ? Math.trunc(left / daysLeft) : left;
  const spentPct = income > 0 ? Math.round((spending / income) * 100) : null;
  const todayIso = isoDate(today);
  const usedToday = sumCents(
    rows.filter((entry) => entry.section === "spending" && entry.date === todayIso),
  );
  let onTrack: MonthStats["onTrack"] = "none";
  if (isCurrent && (income > 0 || spending > 0 || debtPaid > 0)) {
    if (left < 0) onTrack = "over";
    else if (usedToday > Math.max(0, safePerDay)) onTrack = "pace";
    else onTrack = "on";
  }
  return {
    income,
    spending,
    debtPaid,
    left,
    safePerDay,
    daysLeft,
    spentPct,
    usedToday,
    onTrack,
    isCurrent,
  };
}

export function weekBars(entries: Entry[], month: string, section: Section): number[] {
  const bars = [0, 0, 0, 0, 0];
  for (const entry of entries) {
    if (entry.section !== section || monthOf(entry.date) !== month) continue;
    const day = Number(entry.date.slice(8, 10));
    const index = Math.min(4, Math.floor((day - 1) / 7));
    bars[index] += entry.amountCents;
  }
  return bars;
}

export function categoryBars(
  entries: Entry[],
  month: string,
): { label: string; cents: number }[] {
  const totals = new Map<string, number>();
  for (const entry of monthEntries(entries, month)) {
    if (entry.section !== "spending") continue;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amountCents);
  }
  return [...totals.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 4);
}

export function loggedDays(entries: Entry[], month: string): Set<number> {
  const days = new Set<number>();
  for (const entry of entries) {
    if (entry.section === "inbox" || monthOf(entry.date) !== month || entry.amountCents <= 0) {
      continue;
    }
    days.add(Number(entry.date.slice(8, 10)));
  }
  return days;
}

export function currentStreak(entries: Entry[], today: Date): number {
  const logged = new Set(
    entries
      .filter((entry) => entry.section !== "inbox" && entry.amountCents > 0)
      .map((entry) => entry.date),
  );
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!logged.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!logged.has(isoDate(cursor))) return 0;
  }
  let count = 0;
  while (logged.has(isoDate(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
    if (count > 400) break;
  }
  return count;
}

export type PlanSplit = {
  needs: number;
  wants: number;
  debt: number;
  income: number;
};

export function planSplit(entries: Entry[], month: string): PlanSplit {
  const rows = monthEntries(entries, month);
  let needs = 0;
  let wants = 0;
  for (const entry of rows) {
    if (entry.section !== "spending") continue;
    if (NEEDS.has(entry.category)) needs += entry.amountCents;
    else wants += entry.amountCents;
  }
  return {
    needs,
    wants,
    debt: sumCents(rows.filter((entry) => entry.section === "debt")),
    income: sumCents(rows.filter((entry) => entry.section === "income")),
  };
}

export type BillWatch = Bill & { state: "paid" | "overdue" | "due" | "later" };

export function watchBills(bills: Bill[], entries: Entry[], month: string, today: Date): BillWatch[] {
  const rows = monthEntries(entries, month);
  const isCurrent = month === monthKey(today);
  const todayDay = today.getDate();
  return bills
    .map((bill) => {
      const paid = rows.some((entry) => {
        if (entry.section !== bill.section) return false;
        const entryName = entry.label.toLowerCase();
        const billName = bill.name.toLowerCase();
        return entryName.includes(billName) || billName.includes(entryName);
      });
      let state: BillWatch["state"] = "later";
      if (paid) state = "paid";
      else if (isCurrent && bill.dueDay < todayDay) state = "overdue";
      else if (isCurrent && bill.dueDay <= todayDay + 7) state = "due";
      return { ...bill, state };
    })
    .sort((a, b) => a.dueDay - b.dueDay);
}

export function calendarCells(month: string): { day: number | null; key: string }[] {
  const { year, month: monthIndex } = parseMonth(month);
  const first = new Date(year, monthIndex, 1).getDay();
  const count = daysInMonth(month);
  const cells: { day: number | null; key: string }[] = [];
  for (let i = 0; i < first; i += 1) cells.push({ day: null, key: `pad-${i}` });
  for (let day = 1; day <= count; day += 1) cells.push({ day, key: `d-${day}` });
  return cells;
}

export function owedTotal(debts: { balanceCents: number }[]): number {
  return debts.reduce((total, debt) => total + debt.balanceCents, 0);
}
