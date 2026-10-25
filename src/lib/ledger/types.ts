export const SECTIONS = ["income", "spending", "debt"] as const;
export type Section = (typeof SECTIONS)[number];

export const CATEGORIES: Record<Section, readonly string[]> = {
  income: ["Paycheck", "Side work", "Refund", "Gift", "Other"],
  spending: [
    "Rent",
    "Groceries",
    "Utilities",
    "Gas",
    "Medical",
    "Insurance",
    "Household",
    "Dining",
    "Shopping",
    "Fun",
    "Other",
  ],
  debt: ["Credit card", "Loan", "Car", "Student", "Medical", "Other"],
};

export const NEEDS = new Set([
  "Rent",
  "Groceries",
  "Utilities",
  "Gas",
  "Medical",
  "Insurance",
  "Household",
]);

export type Entry = {
  id: string;
  section: Section | "inbox";
  date: string;
  amountCents: number;
  label: string;
  category: string;
  note: string;
  photoId: string | null;
  debtId: string | null;
  suggested: Section | null;
  sample: boolean;
  createdAt: number;
};

export type Debt = {
  id: string;
  name: string;
  balanceCents: number;
  minPaymentCents: number;
  dueDay: number;
  sample: boolean;
  createdAt: number;
};

export type Bill = {
  id: string;
  name: string;
  amountCents: number;
  dueDay: number;
  section: "spending" | "debt";
  category: string;
  sample: boolean;
};

export type Meta = {
  id: "settings";
  paydayDay: number;
  sample: boolean;
  touched: boolean;
  quietDate: string | null;
  theme: "day" | "night";
  background: string;
  backgroundColor: string;
  headerKicker: string;
  headerTitle: string;
  headerNote: string;
  headerFill: "panel" | "clear" | "color";
  headerColor: string;
  headerInk: "ink" | "light";
  headerImage: boolean;
  showHeader: boolean;
  hideMoney: boolean;
};

export type Snapshot = {
  entries: Entry[];
  debts: Debt[];
  bills: Bill[];
  meta: Meta;
};

export const DEFAULT_META: Meta = {
  id: "settings",
  paydayDay: 15,
  sample: false,
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
};

export type ViewId = "home" | "slips" | "debts" | "plan";

export type FilingItem = {
  id: string;
  label: string;
  status: "queued" | "reading" | "filed" | "needs" | "error";
  detail: string;
};

export type ClassifyResult =
  | {
      ok: true;
      section: Section | "inbox";
      amountCents: number | null;
      balanceCents: number | null;
      label: string;
      category: string;
      date: string | null;
      confidence: number;
    }
  | { ok: false; error: string };
