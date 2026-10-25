import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Images,
  PiggyBank,
  Plus,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import {
  calendarCells,
  categoryBars,
  currentStreak,
  loggedDays,
  monthEntries,
  monthStats,
  owedTotal,
  planSplit,
  watchBills,
  weekBars,
} from "@/lib/ledger/logic";
import {
  centsToInput,
  daysUntilPayday,
  formatDay,
  formatMonth,
  formatShortMonth,
  greeting,
  isoDate,
  monthKey,
  parseDollars,
  shiftMonth,
} from "@/lib/ledger/money";
import { CATEGORIES, type Entry, type Section } from "@/lib/ledger/types";
import { fileToJpeg } from "@/lib/ledger/images";
import { loadPhotoUrl, useLedger, type EntryDraft } from "./use-ledger";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export type OpenPhoto = { src: string; entryId: string };

export function PhotoThumb({
  id,
  alt,
  onOpen,
}: {
  id: string | null;
  alt: string;
  onOpen?: (src: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let url = "";
    let cancel = false;
    void loadPhotoUrl(id).then((next) => {
      if (!next || cancel) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      url = next;
      setSrc(next);
    });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!id) return null;
  if (!src) return <div className="size-14 shrink-0 rounded-xl bg-paper" aria-hidden="true" />;
  return (
    <button type="button" className="press shrink-0 rounded-xl" onClick={() => onOpen?.(src)}>
      <img
        src={src}
        alt={alt}
        className="size-14 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-ink/10"
      />
    </button>
  );
}

function Bars({ values, tone }: { values: number[]; tone: "sage" | "butter" }) {
  const max = Math.max(...values, 1);
  const filled = tone === "sage" ? "bg-sage-deep" : "bg-butter-deep";
  return (
    <div className="mt-4 flex h-12 items-end gap-1.5" aria-hidden="true">
      {values.map((value, index) => (
        <div key={index} className="flex h-full flex-1 items-end">
          <div
            className={clsx("w-full rounded-full", value > 0 ? filled : "bg-ink/10")}
            style={{ height: `${value > 0 ? Math.max(18, Math.round((value / max) * 100)) : 12}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function Dashboard({ onOpenPhoto }: { onOpenPhoto: (photo: OpenPhoto) => void }) {
  const ledger = useLedger();
  const today = ledger.today ?? new Date();
  const snap = ledger.snap;
  const stats = snap ? monthStats(snap.entries, ledger.month, today) : null;
  const inbox = snap?.entries.filter((entry) => entry.section === "inbox") ?? [];
  const rows = snap ? monthEntries(snap.entries, ledger.month) : [];
  const bills = snap ? watchBills(snap.bills, snap.entries, ledger.month, today) : [];
  const attention = bills.filter((bill) => bill.state === "due" || bill.state === "overdue");
  const upcoming = bills.filter((bill) => bill.state === "due" || bill.state === "later").slice(0, 4);
  const logged = snap ? loggedDays(snap.entries, ledger.month) : new Set<number>();
  const streak = snap ? currentStreak(snap.entries, today) : 0;
  const cells = ledger.month ? calendarCells(ledger.month) : [];
  const quiet = snap?.meta.quietDate === isoDate(today);
  const loggedToday = snap
    ? snap.entries.some(
        (entry) => entry.section !== "inbox" && entry.date === isoDate(today) && entry.amountCents > 0,
      )
    : false;
  const incomeBars = snap ? weekBars(snap.entries, ledger.month, "income") : [];
  const spendBars = snap ? categoryBars(snap.entries, ledger.month) : [];
  const payday = snap ? daysUntilPayday(today, snap.meta.paydayDay) : 0;
  const monthName = ledger.month ? formatShortMonth(ledger.month) : "This month";
  const badge =
    stats?.onTrack === "on"
      ? "On track"
      : stats?.onTrack === "over"
        ? "Over"
        : stats?.onTrack === "pace"
          ? "Ahead of pace"
          : null;
  const usedPct =
    stats && stats.safePerDay > 0 ? Math.min(100, Math.round((stats.usedToday / stats.safePerDay) * 100)) : 0;
  const outflowPct =
    stats && stats.income > 0
      ? Math.min(100, Math.round(((stats.spending + stats.debtPaid) / stats.income) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted">
          {ledger.ready
            ? `${greeting(today)} · ${today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${
                payday === 0 ? "Payday is today" : `${payday} ${payday === 1 ? "day" : "days"} to payday`
              }`
            : "Opening your month"}
        </p>
        <p className="font-display text-sm italic text-muted">Where the month already went</p>
      </div>

      {snap?.meta.sample ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-butter px-4 py-2 text-sm">
          <p className="text-sm">Example month, so the page isn’t empty. Your own photos replace it.</p>
          <button type="button" className="press rounded-full bg-ink px-3 py-2 text-sm font-medium text-canvas" onClick={() => void ledger.clearSample()}>
            Clear example
          </button>
        </div>
      ) : null}

      {inbox.length > 0 ? (
        <section className="rounded-2xl bg-card p-4 shadow-lift">
          <h3 className="font-medium">Needs a look</h3>
          <p className="mt-1 text-sm text-muted">These photos weren’t sure enough to file on their own.</p>
          <div className="mt-3 space-y-3">
            {inbox.map((entry) => (
              <InboxCard key={entry.id} entry={entry} onOpenPhoto={onOpenPhoto} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-blush p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-card/80">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
            {badge ? <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-canvas">{badge}</span> : null}
          </div>
          <p className="mt-4 text-sm font-medium">{stats?.isCurrent === false ? "Left per day" : "Safe to spend today"}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {stats ? ledger.cash(stats.left < 0 ? stats.left : Math.max(0, stats.safePerDay)) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink/70">
            {stats
              ? stats.left < 0
                ? "More went out than came in"
                : `${ledger.cash(Math.max(0, stats.safePerDay))} a day until ${monthName} ends`
              : "Waiting for this month"}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card/80">
            <div className="h-full rounded-full bg-ink/75" style={{ width: `${usedPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink/70">
            {stats ? `${ledger.cash(stats.usedToday)} of ${ledger.cash(Math.max(0, stats.safePerDay))} used today` : ""}
          </p>
        </article>

        <article className="rounded-2xl bg-sage p-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-card/80">
            <PiggyBank className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-medium">Income this month</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {stats ? ledger.cash(stats.income) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink/70">Pay and anything else that came in</p>
          <Bars values={incomeBars.length ? incomeBars : [0, 0, 0, 0, 0]} tone="sage" />
        </article>

        <article className="rounded-2xl bg-butter p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-card/80">
              <ShoppingBag className="size-4" aria-hidden="true" />
            </span>
            {stats?.spentPct != null ? (
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-canvas">{stats.spentPct}% of income</span>
            ) : null}
          </div>
          <p className="mt-4 text-sm font-medium">Spent this month</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {stats ? ledger.cash(stats.spending) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink/70">
            {spendBars[0] ? `${spendBars[0].label} is the largest share` : "Bills and everyday spending"}
          </p>
          <Bars values={spendBars.length ? spendBars.map((bar) => bar.cents) : [0, 0, 0]} tone="butter" />
        </article>

        <article className="rounded-2xl bg-periw p-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-card/80">
            <Wallet className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-medium">{stats && stats.left < 0 ? "Short this month" : "Left this month"}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {stats ? ledger.cash(Math.abs(stats.left)) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink/70">
            {stats
              ? `After ${ledger.cash(stats.debtPaid)} in debt payments`
              : "Income, minus spending and debt"}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-card/80">
            <div className="h-full rounded-full bg-periw-deep" style={{ width: `${outflowPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink/70">
            {stats && stats.income > 0 ? `${outflowPct}% of income is already spoken for` : "Add income to see the pace"}
          </p>
        </article>
      </div>

      {stats && snap ? (
        <p className="text-sm text-muted">
          Debt payments this month {ledger.cash(stats.debtPaid)} · still owed {ledger.cash(owedTotal(snap.debts))}
          {prevSpend(snap.entries, ledger.month, today, stats.spending, Boolean(snap.meta.hideMoney))}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-2xl bg-card p-4 shadow-lift">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Heads up</h3>
            <Bell className="size-4 text-muted" aria-hidden="true" />
          </div>
          {attention.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {attention.map((bill) => (
                <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium">{bill.name}</span>
                    <span className="text-muted">
                      {bill.state === "overdue" ? "Past due" : "Due"} day {bill.dueDay}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{ledger.cash(bill.amountCents)}</span>
                    <button type="button" className="press rounded-full bg-paper px-3 py-2 text-xs" onClick={() => void ledger.logBill(bill)}>
                      Log
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : !loggedToday && !quiet && stats?.isCurrent ? (
            <div className="mt-4">
              <p className="font-medium">Nothing logged today</p>
              <p className="mt-1 text-sm text-muted">A photo of a receipt is enough. It files itself.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="press rounded-full bg-ink px-3 py-2 text-sm font-medium text-canvas" onClick={() => ledger.setAddOpen(true)}>
                  Log now
                </button>
                <button type="button" className="press rounded-full bg-paper px-3 py-2 text-sm" onClick={() => void ledger.markQuietToday()}>
                  I spent nothing
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Nothing due in the next week.</p>
          )}
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-lift">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Logging streak</h3>
            <CalendarDays className="size-4 text-muted" aria-hidden="true" />
          </div>
          <p className="mt-3 font-display text-4xl tabular-nums">{streak}</p>
          <p className="text-sm text-muted">{streak === 1 ? "day in a row" : "days in a row"}</p>
          <p className="mt-3 text-xs font-medium text-muted">{ledger.month ? formatShortMonth(ledger.month) : ""}</p>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {WEEKDAYS.map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
            {cells.map((cell) => (
              <span
                key={cell.key}
                className={clsx(
                  "flex aspect-square items-center justify-center rounded-full",
                  cell.day && logged.has(cell.day) && "bg-sage-deep font-medium text-ink",
                )}
              >
                {cell.day ?? ""}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-lift">
          <h3 className="font-medium">Coming up</h3>
          <ul className="mt-3 space-y-3">
            {upcoming.length === 0 ? <li className="text-sm text-muted">Add bills on the Plan page.</li> : null}
            {upcoming.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">{bill.name}</span>
                  <span className="text-muted">
                    Day {bill.dueDay} · {bill.section === "debt" ? "Debt" : bill.category}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{ledger.cash(bill.amountCents)}</span>
                  <button type="button" className="press rounded-full bg-paper px-3 py-2 text-xs" onClick={() => void ledger.logBill(bill)}>
                    Log
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {(["income", "spending", "debt"] as const).map((section) => (
          <section key={section} className="rounded-2xl bg-card p-4 shadow-lift">
            <h3 className="font-medium capitalize">{section}</h3>
            <ul className="mt-3 space-y-3">
              {rows.filter((entry) => entry.section === section).length === 0 ? (
                <li className="text-sm text-muted">Nothing filed here yet.</li>
              ) : null}
              {rows
                .filter((entry) => entry.section === section)
                .slice(0, 5)
                .map((entry) => (
                  <li key={entry.id}>
                    <div className="flex w-full items-center gap-3 text-left">
                      <PhotoThumb
                        id={entry.photoId}
                        alt=""
                        onOpen={entry.photoId ? (src) => onOpenPhoto({ src, entryId: entry.id }) : undefined}
                      />
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => ledger.setEdit(entry)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{entry.label}</span>
                          <span className="text-xs text-muted">
                            {entry.category} · {formatDay(entry.date)}
                          </span>
                        </span>
                        <span className="tabular-nums">{signed(section, ledger.cash(entry.amountCents))}</span>
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function prevSpend(entries: Entry[], month: string, today: Date, spending: number, hide: boolean): string {
  if (!month) return "";
  const previousKey = shiftMonth(month, -1);
  if (monthEntries(entries, previousKey).length === 0) return "";
  const previous = monthStats(entries, previousKey, today).spending;
  const gap = spending - previous;
  if (gap === 0) return " · spending matches last month";
  if (hide) return gap > 0 ? " · spending is over last month" : " · spending is under last month";
  const cash = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(gap) / 100);
  return gap > 0 ? ` · spending is ${cash} over last month` : ` · spending is ${cash} under last month`;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function downloadMonth(entries: Entry[], month: string) {
  if (!month) return;
  const rows = monthEntries(entries, month);
  const lines = ["date,section,label,category,amount,note"];
  for (const entry of [...rows].reverse()) {
    lines.push(
      [
        entry.date,
        entry.section,
        csvCell(entry.label),
        csvCell(entry.category),
        (entry.amountCents / 100).toFixed(2),
        csvCell(entry.note),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daybook-${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function signed(section: Section, text: string): string {
  if (section === "income") return `+${text}`;
  return `−${text}`;
}

function InboxCard({ entry, onOpenPhoto }: { entry: Entry; onOpenPhoto: (photo: OpenPhoto) => void }) {
  const ledger = useLedger();
  const [amount, setAmount] = useState("");
  const [section, setSection] = useState<Section>(entry.suggested ?? "spending");
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-paper p-3 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const cents = parseDollars(amount);
        if (cents == null || cents <= 0) {
          ledger.setNotice("Add the amount before filing this photo.");
          return;
        }
        void ledger.confirmInbox(entry.id, section, cents);
      }}
    >
      <PhotoThumb
        id={entry.photoId}
        alt={entry.label}
        onOpen={entry.photoId ? (src) => onOpenPhoto({ src, entryId: entry.id }) : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.label}</p>
        <p className="text-xs text-muted">{entry.suggested ? `Suggested ${entry.suggested}` : "Pick a section"}</p>
      </div>
      <input
        className="field sm:max-w-28"
        inputMode="decimal"
        placeholder="0.00"
        aria-label={`Amount for ${entry.label}`}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {(["income", "spending", "debt"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={clsx(
              "press rounded-full px-3 py-2 text-xs font-medium capitalize",
              section === item ? "bg-ink text-canvas" : "bg-card text-ink",
            )}
            onClick={() => setSection(item)}
          >
            {item}
          </button>
        ))}
        <button type="submit" className="press rounded-full bg-sage-deep px-3 py-2 text-xs font-medium">
          File
        </button>
      </div>
    </form>
  );
}

export function Slips({ onOpenPhoto }: { onOpenPhoto: (photo: OpenPhoto) => void }) {
  const ledger = useLedger();
  const [filter, setFilter] = useState<Section | "all">("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const source = ledger.snap?.entries ?? [];
  const pool = needle
    ? source.filter((entry) => entry.section !== "inbox")
    : monthEntries(source, ledger.month);
  const rows = pool.filter((entry) => {
    if (filter !== "all" && entry.section !== filter) return false;
    if (!needle) return true;
    return `${entry.label} ${entry.category} ${entry.note}`.toLowerCase().includes(needle);
  });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Slips</h2>
          <p className="mt-1 text-sm text-muted">
            {needle ? "Matching slips from every month." : `Everything filed in ${ledger.month ? formatMonth(ledger.month) : "this month"}.`}
          </p>
        </div>
        <button
          type="button"
          className="press rounded-full bg-card px-4 py-2 text-sm shadow-lift"
          onClick={() => downloadMonth(source, ledger.month)}
        >
          Download month
        </button>
      </div>
      <input
        className="field mt-4"
        value={query}
        placeholder="Search labels, notes, categories"
        aria-label="Search slips"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "income", "spending", "debt"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={clsx(
              "press rounded-full px-3 py-2 text-sm capitalize",
              filter === item ? "bg-ink text-canvas" : "bg-card shadow-lift",
            )}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {rows.length === 0 ? <li className="rounded-2xl bg-card p-4 text-sm text-muted shadow-lift">No slips in this view.</li> : null}
        {rows.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-lift">
            <PhotoThumb
              id={entry.photoId}
              alt=""
              onOpen={entry.photoId ? (src) => onOpenPhoto({ src, entryId: entry.id }) : undefined}
            />
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => ledger.setEdit(entry)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{entry.label}</span>
                <span className="text-xs capitalize text-muted">
                  {entry.section} · {entry.category} · {formatDay(entry.date)}
                </span>
              </span>
              <span className="tabular-nums">
                {signed(entry.section as Section, ledger.cash(entry.amountCents))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Debts() {
  const ledger = useLedger();
  const debts = ledger.snap?.debts ?? [];
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Debts</h2>
          <p className="mt-1 text-sm text-muted">
            Still owed {ledger.cash(owedTotal(debts))}. A statement photo can update a balance when you add it from Home.
          </p>
        </div>
        <button type="button" className="press rounded-full bg-ink px-3 py-2 text-sm font-medium text-canvas" onClick={() => setOpen(true)}>
          Add debt
        </button>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {debts.length === 0 ? <li className="rounded-2xl bg-card p-4 text-sm text-muted shadow-lift">No debts yet.</li> : null}
        {debts.map((debt) => {
          const months = debt.minPaymentCents > 0 ? Math.ceil(debt.balanceCents / debt.minPaymentCents) : null;
          return (
            <li key={debt.id} className="rounded-2xl bg-periw p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{debt.name}</h3>
                <button type="button" className="text-sm text-ink/70" onClick={() => void ledger.deleteDebt(debt.id)}>
                  Remove
                </button>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{ledger.cash(debt.balanceCents)}</p>
              <p className="mt-1 text-sm text-ink/70">
                Minimum {ledger.cash(debt.minPaymentCents)} · due day {debt.dueDay}
              </p>
              <p className="mt-3 text-sm">
                {months == null
                  ? "Add a minimum to estimate the payoff."
                  : `About ${months} payments at the minimum, not counting interest.`}
              </p>
            </li>
          );
        })}
      </ul>
      {open ? (
        <Sheet title="Add a debt" onClose={() => setOpen(false)}>
          <DebtForm
            onSubmit={(debt) => {
              void ledger.addDebt(debt);
              setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

export function Plan() {
  const ledger = useLedger();
  const snap = ledger.snap;
  const split = snap ? planSplit(snap.entries, ledger.month) : null;
  const bills = snap?.bills ?? [];
  const [open, setOpen] = useState(false);
  const income = split?.income ?? 0;
  const rows = [
    { label: "Needs", hint: "Aim near 50%", cents: split?.needs ?? 0, target: 0.5, tint: "bg-sage" },
    { label: "Wants", hint: "Aim near 30%", cents: split?.wants ?? 0, target: 0.3, tint: "bg-butter" },
    { label: "Debt payments", hint: "Aim near 20%", cents: split?.debt ?? 0, target: 0.2, tint: "bg-periw" },
  ];
  return (
    <div>
      <h2 className="font-display text-3xl">Plan</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        A plain 50/30/20 check against this month’s income. Needs are rent, groceries, utilities, gas, medical, insurance, and household.
      </p>
      <label className="mt-4 flex max-w-xs flex-col gap-1 text-sm">
        Payday, day of month
        <input
          className="field"
          inputMode="numeric"
          value={snap?.meta.paydayDay ?? 15}
          onChange={(event) => void ledger.setPayday(Number(event.target.value))}
        />
      </label>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const pct = income > 0 ? Math.round((row.cents / income) * 100) : 0;
          return (
            <article key={row.label} className={clsx("rounded-2xl p-4", row.tint)}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium">{row.label}</h3>
                <p className="tabular-nums">{income > 0 ? `${pct}%` : "—"}</p>
              </div>
              <p className="mt-1 text-sm text-ink/70">
                {ledger.cash(row.cents)} · {row.hint}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-card/80">
                <div className="h-full rounded-full bg-ink/70" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-medium">Recurring bills</h3>
        <button type="button" className="press inline-flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-sm font-medium text-canvas" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add bill
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {bills.length === 0 ? <li className="text-sm text-muted">No bills yet.</li> : null}
        {bills.map((bill) => (
          <li key={bill.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-lift">
            <span>
              <span className="block font-medium">{bill.name}</span>
              <span className="text-xs capitalize text-muted">
                Day {bill.dueDay} · {bill.section} · {bill.category}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{ledger.cash(bill.amountCents)}</span>
              <button type="button" className="press rounded-full bg-paper px-3 py-2 text-xs" onClick={() => void ledger.logBill(bill)}>
                Log
              </button>
              <button type="button" className="text-sm text-muted" onClick={() => void ledger.deleteBill(bill.id)}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      {open ? (
        <Sheet title="Add a bill" onClose={() => setOpen(false)}>
          <BillForm
            onSubmit={(bill) => {
              void ledger.addBill(bill);
              setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

export function AddSheet() {
  const ledger = useLedger();
  if (!ledger.addOpen || !ledger.today) return null;
  const today = ledger.today;
  const fallback = ledger.month === monthKey(today) ? isoDate(today) : `${ledger.month}-15`;
  return (
    <Sheet title="Add by hand" onClose={() => ledger.setAddOpen(false)}>
      <EntryForm
        debts={ledger.snap?.debts ?? []}
        initial={{
          section: "spending",
          date: fallback,
          amount: "",
          label: "",
          category: "Groceries",
          note: "",
          debtId: "",
          reduceBalance: true,
        }}
        submitLabel="Save slip"
        onSubmit={async (draft) => {
          await ledger.addEntry(draft);
        }}
      />
    </Sheet>
  );
}

export function EditSheet() {
  const ledger = useLedger();
  const entry = ledger.edit;
  if (!entry || entry.section === "inbox") return null;
  return (
    <Sheet title="Edit slip" onClose={() => ledger.setEdit(null)}>
      <EntryForm
        debts={ledger.snap?.debts ?? []}
        initial={{
          section: entry.section,
          date: entry.date,
          amount: centsToInput(entry.amountCents),
          label: entry.label,
          category: entry.category,
          note: entry.note,
          debtId: entry.debtId ?? "",
          reduceBalance: false,
        }}
        submitLabel="Save changes"
        allowPhoto={false}
        showBalance={false}
        onSubmit={async (draft) => {
          await ledger.updateEntry({
            ...entry,
            section: draft.section,
            date: draft.date,
            amountCents: draft.amountCents,
            label: draft.label.trim() || "Untitled",
            category: draft.category,
            note: draft.note.trim(),
            debtId: draft.debtId,
            sample: entry.sample,
          });
        }}
      />
      <button type="button" className="mt-3 text-sm text-muted" onClick={() => void ledger.deleteEntry(entry.id)}>
        Delete this slip
      </button>
      {entry.photoId ? (
        <button type="button" className="mt-2 text-sm text-muted" onClick={() => void ledger.removeEntryPhoto(entry.id)}>
          Delete photo
        </button>
      ) : null}
    </Sheet>
  );
}

export function FilingSheet() {
  const ledger = useLedger();
  if (!ledger.filingOpen) return null;
  return (
    <Sheet title="Filing photos" onClose={() => ledger.setFilingOpen(false)}>
      <ul className="space-y-2">
        {ledger.filing.map((item) => (
          <li key={item.id} className="rounded-2xl bg-paper px-3 py-3">
            <p className="truncate font-medium">{item.label}</p>
            <p className="text-sm capitalize text-muted">
              {item.status === "reading" ? "Reading…" : item.detail}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Photos are read once to sort them, then kept only on this device.</p>
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-2 veil sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-canvas p-5 shadow-lift"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-paper" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EntryForm({
  initial,
  debts,
  submitLabel,
  allowPhoto = true,
  showBalance = true,
  onSubmit,
}: {
  initial: {
    section: Section;
    date: string;
    amount: string;
    label: string;
    category: string;
    note: string;
    debtId: string;
    reduceBalance: boolean;
  };
  debts: { id: string; name: string }[];
  submitLabel: string;
  allowPhoto?: boolean;
  showBalance?: boolean;
  onSubmit: (draft: EntryDraft) => Promise<void>;
}) {
  const ledger = useLedger();
  const [section, setSection] = useState<Section>(initial.section);
  const [amount, setAmount] = useState(initial.amount);
  const [label, setLabel] = useState(initial.label);
  const [category, setCategory] = useState(initial.category);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [debtId, setDebtId] = useState(initial.debtId);
  const [reduceBalance, setReduceBalance] = useState(initial.reduceBalance);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CATEGORIES[section].includes(category)) setCategory(CATEGORIES[section][0]);
  }, [section, category]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseDollars(amount);
    if (amountCents == null) {
      ledger.setNotice("Enter an amount like 42.50");
      return;
    }
    setBusy(true);
    try {
      const photoBlob = photo ? (await fileToJpeg(photo)).blob : null;
      await onSubmit({
        section,
        date,
        amountCents,
        label,
        category,
        note,
        photoBlob,
        debtId: debtId || null,
        reduceBalance,
      });
    } catch {
      ledger.setNotice("Could not save that slip.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <div className="grid grid-cols-3 gap-2">
        {(["income", "spending", "debt"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={clsx(
              "press rounded-2xl px-2 py-3 text-sm font-medium capitalize",
              section === item ? "bg-ink text-canvas" : "bg-paper",
            )}
            onClick={() => setSection(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Amount
        <input className="field mt-1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </label>
      <label className="block text-sm">
        Label
        <input className="field mt-1" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Harbor Market" />
      </label>
      <label className="block text-sm">
        Category
        <select className="field mt-1" value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES[section].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Date
        <input className="field mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      {showBalance && section === "debt" && debts.length > 0 ? (
        <>
          <label className="block text-sm">
            Applies to
            <select className="field mt-1" value={debtId} onChange={(event) => setDebtId(event.target.value)}>
              <option value="">No linked debt</option>
              {debts.map((debt) => (
                <option key={debt.id} value={debt.id}>
                  {debt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reduceBalance} onChange={(event) => setReduceBalance(event.target.checked)} />
            Subtract this payment from the balance
          </label>
        </>
      ) : null}
      {allowPhoto ? (
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-2xl bg-paper px-3 py-3 text-sm">
            <Images className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{photo ? photo.name : "Attach a photo"}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          {photo ? (
            <button type="button" className="press shrink-0 rounded-full bg-paper px-3 py-3 text-sm" onClick={() => setPhoto(null)}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="block text-sm">
        Note
        <input className="field mt-1" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button type="submit" className="press w-full rounded-full bg-ink py-3 font-medium text-canvas" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function DebtForm({
  onSubmit,
}: {
  onSubmit: (debt: { name: string; balanceCents: number; minPaymentCents: number; dueDay: number }) => void;
}) {
  const ledger = useLedger();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [minimum, setMinimum] = useState("");
  const [dueDay, setDueDay] = useState("1");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const balanceCents = parseDollars(balance);
        const minPaymentCents = parseDollars(minimum) ?? 0;
        if (!name.trim() || balanceCents == null) {
          ledger.setNotice("Name and balance are required.");
          return;
        }
        onSubmit({
          name: name.trim(),
          balanceCents,
          minPaymentCents,
          dueDay: Math.min(28, Math.max(1, Number(dueDay) || 1)),
        });
      }}
    >
      <label className="block text-sm">
        Name
        <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="block text-sm">
        Balance
        <input className="field mt-1" inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
      </label>
      <label className="block text-sm">
        Minimum payment
        <input className="field mt-1" inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
      </label>
      <label className="block text-sm">
        Due day
        <input className="field mt-1" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
      </label>
      <button type="submit" className="press w-full rounded-full bg-ink py-3 font-medium text-canvas">
        Save debt
      </button>
    </form>
  );
}

function BillForm({
  onSubmit,
}: {
  onSubmit: (bill: {
    name: string;
    amountCents: number;
    dueDay: number;
    section: "spending" | "debt";
    category: string;
  }) => void;
}) {
  const ledger = useLedger();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [section, setSection] = useState<"spending" | "debt">("spending");
  const [category, setCategory] = useState("Utilities");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const amountCents = parseDollars(amount);
        if (!name.trim() || amountCents == null) {
          ledger.setNotice("Name and amount are required.");
          return;
        }
        onSubmit({
          name: name.trim(),
          amountCents,
          dueDay: Math.min(28, Math.max(1, Number(dueDay) || 1)),
          section,
          category,
        });
      }}
    >
      <label className="block text-sm">
        Name
        <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="block text-sm">
        Amount
        <input className="field mt-1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label className="block text-sm">
        Due day
        <input className="field mt-1" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["spending", "debt"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={clsx("press rounded-2xl py-3 text-sm capitalize", section === item ? "bg-ink text-canvas" : "bg-paper")}
            onClick={() => {
              setSection(item);
              setCategory(CATEGORIES[item][0]);
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Category
        <select className="field mt-1" value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES[section].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="press w-full rounded-full bg-ink py-3 font-medium text-canvas">
        Save bill
      </button>
    </form>
  );
}
