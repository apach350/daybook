export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > 10_000_000) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthKey(date: Date): string {
  return isoDate(date).slice(0, 7);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month: month - 1 };
}

export function formatMonth(key: string): string {
  const { year, month } = parseMonth(key);
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatShortMonth(key: string): string {
  const { year, month } = parseMonth(key);
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long" });
}

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonth(key);
  return new Date(year, month + 1, 0).getDate();
}

export function daysRemaining(today: Date): number {
  return daysInMonth(monthKey(today)) - today.getDate() + 1;
}

export function daysUntilPayday(today: Date, paydayDay: number): number {
  const day = Math.min(28, Math.max(1, paydayDay));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let target = new Date(today.getFullYear(), today.getMonth(), day);
  if (target < start) target = new Date(today.getFullYear(), today.getMonth() + 1, day);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseMonth(key);
  return monthKey(new Date(year, month + delta, 1));
}

export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function uid(): string {
  return crypto.randomUUID();
}

export function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
