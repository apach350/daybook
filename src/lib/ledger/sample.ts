import { isoDate, monthKey, uid } from "./money";
import type { Bill, Debt, Entry, Meta } from "./types";

function onDay(today: Date, day: number): string | null {
  if (day > today.getDate()) return null;
  return isoDate(new Date(today.getFullYear(), today.getMonth(), day));
}

function entry(
  today: Date,
  day: number,
  section: Entry["section"],
  amountCents: number,
  label: string,
  category: string,
): Entry | null {
  const date = onDay(today, day);
  if (!date) return null;
  return {
    id: uid(),
    section,
    date,
    amountCents,
    label,
    category,
    note: "",
    photoId: null,
    debtId: null,
    suggested: null,
    sample: true,
    createdAt: Date.now(),
  };
}

export function buildSample(today: Date): {
  entries: Entry[];
  debts: Debt[];
  bills: Bill[];
  meta: Meta;
} {
  const drafts = [
    entry(today, 1, "spending", 145000, "Rent", "Rent"),
    entry(today, 3, "income", 257000, "North Credit Union", "Paycheck"),
    entry(today, 4, "spending", 8640, "Harbor Market", "Groceries"),
    entry(today, 6, "spending", 4820, "River Gas", "Gas"),
    entry(today, 8, "debt", 31000, "North Auto", "Car"),
    entry(today, 9, "spending", 11233, "Harbor Market", "Groceries"),
    entry(today, 10, "spending", 18600, "Linden Mutual", "Insurance"),
    entry(today, 12, "spending", 2840, "Corner Diner", "Dining"),
    entry(today, 14, "spending", 7890, "Field & Co.", "Shopping"),
    entry(today, 15, "income", 257000, "North Credit Union", "Paycheck"),
    entry(today, 17, "spending", 13280, "City Electric", "Utilities"),
    entry(today, 18, "spending", 5200, "River Gas", "Gas"),
    entry(today, 20, "spending", 4125, "Corner Diner", "Dining"),
    entry(today, 21, "spending", 3650, "Hardware", "Household"),
    entry(today, 22, "debt", 18000, "Linen Card", "Credit card"),
    entry(today, 23, "spending", 9310, "Harbor Market", "Groceries"),
  ].filter((row): row is Entry => row !== null);

  const debts: Debt[] = [
    {
      id: uid(),
      name: "Linen Card",
      balanceCents: 428000,
      minPaymentCents: 18000,
      dueDay: 22,
      sample: true,
      createdAt: Date.now(),
    },
    {
      id: uid(),
      name: "North Auto",
      balanceCents: 864000,
      minPaymentCents: 31000,
      dueDay: 8,
      sample: true,
      createdAt: Date.now(),
    },
  ];

  const bills: Bill[] = [
    { id: uid(), name: "Rent", amountCents: 145000, dueDay: 1, section: "spending", category: "Rent", sample: true },
    { id: uid(), name: "City Electric", amountCents: 9600, dueDay: 28, section: "spending", category: "Utilities", sample: true },
    { id: uid(), name: "Home Internet", amountCents: 7000, dueDay: 26, section: "spending", category: "Utilities", sample: true },
    { id: uid(), name: "Linen Card", amountCents: 18000, dueDay: 22, section: "debt", category: "Credit card", sample: true },
    { id: uid(), name: "North Auto", amountCents: 31000, dueDay: 8, section: "debt", category: "Car", sample: true },
  ];

  return {
    entries: drafts,
    debts,
    bills,
    meta: {
      id: "settings",
      paydayDay: 15,
      sample: true,
      touched: false,
      quietDate: null,
      theme: "day",
      background: "paper",
      backgroundColor: "#efece6",
      headerKicker: "HOME DASHBOARD",
      headerTitle: "See where your money stands",
      headerNote: "Add several photos at once. Each one files under income, spending, or debt.",
      headerFill: "panel",
      headerColor: "#f7f5f1",
      headerInk: "ink",
      headerImage: false,
      showHeader: true,
      hideMoney: false,
    },
  };
}

export function sampleMonth(today: Date): string {
  return monthKey(today);
}
