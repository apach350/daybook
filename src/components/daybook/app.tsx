import { useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Home,
  Images,
  Landmark,
  Menu,
  Moon,
  Palette,
  PieChart,
  Plus,
  Receipt,
  Sun,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { formatMonth, shiftMonth } from "@/lib/ledger/money";
import type { Meta, ViewId } from "@/lib/ledger/types";
import { LedgerProvider, loadPhotoUrl, useLedger } from "./use-ledger";
import { AddSheet, Dashboard, Debts, EditSheet, FilingSheet, Plan, Slips, type OpenPhoto } from "./views";

const BACKGROUNDS = [
  { id: "paper", label: "Paper", color: "#efece6" },
  { id: "blush", label: "Blush", color: "#f3d4e4" },
  { id: "sage", label: "Sage", color: "#d7e8c8" },
  { id: "butter", label: "Butter", color: "#f6e7ae" },
  { id: "dusk", label: "Dusk", color: "#d5d0e6" },
  { id: "ink", label: "Ink", color: "#1c1d21" },
] as const;

type HeaderDraft = Pick<Meta, "headerKicker" | "headerTitle" | "headerNote" | "headerFill" | "headerColor" | "headerInk">;

const NAV: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "slips", label: "Slips", icon: Receipt },
  { id: "debts", label: "Debts", icon: Landmark },
  { id: "plan", label: "Plan", icon: PieChart },
];

export function DaybookApp() {
  return (
    <LedgerProvider>
      <Shell />
    </LedgerProvider>
  );
}

function Shell() {
  const ledger = useLedger();
  const photos = useRef<HTMLInputElement>(null);
  const backdrop = useRef<HTMLInputElement>(null);
  const headerFile = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<OpenPhoto | null>(null);
  const [staged, setStaged] = useState<{ id: string; file: File; url: string }[]>([]);
  const [lookOpen, setLookOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [headerUrl, setHeaderUrl] = useState<string | null>(null);
  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null);
  const lookReady = useRef(false);
  const theme = ledger.snap?.meta.theme ?? "day";
  const background = ledger.snap?.meta.background ?? "paper";
  const backgroundColor = ledger.snap?.meta.backgroundColor ?? "#efece6";
  const headerImage = ledger.snap?.meta.headerImage ?? false;
  const hideMoney = ledger.snap?.meta.hideMoney ?? false;

  useEffect(() => {
    if (background !== "photo") return;
    let url = "";
    let cancel = false;
    void loadPhotoUrl("backdrop").then((next) => {
      if (!next || cancel) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      url = next;
      setPhotoUrl(next);
    });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
      setPhotoUrl(null);
    };
  }, [background]);

  useEffect(() => {
    if (!headerImage) return;
    let url = "";
    let cancel = false;
    void loadPhotoUrl("header").then((next) => {
      if (!next || cancel) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      url = next;
      setHeaderUrl(next);
    });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
      setHeaderUrl(null);
    };
  }, [headerImage]);

  useEffect(() => {
    if (!lookOpen) {
      lookReady.current = false;
      return;
    }
    if (lookReady.current || !ledger.snap) return;
    lookReady.current = true;
    const meta = ledger.snap.meta;
    setHeaderDraft({
      headerKicker: meta.headerKicker,
      headerTitle: meta.headerTitle,
      headerNote: meta.headerNote,
      headerFill: meta.headerFill,
      headerColor: meta.headerColor,
      headerInk: meta.headerInk,
    });
  }, [lookOpen, ledger.snap]);

  function openPhotos() {
    photos.current?.click();
  }

  function clearStaged() {
    setStaged((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
  }

  function dropStaged(id: string) {
    setStaged((current) => {
      const hit = current.find((item) => item.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function saveHeader(next: HeaderDraft) {
    setHeaderDraft(next);
    void ledger.setHeader(next);
  }

  const pageStyle = background !== "paper" && background !== "photo" ? { backgroundColor } : undefined;
  const meta = ledger.snap?.meta;
  const kicker = meta?.headerKicker || "HOME DASHBOARD";
  const title = meta?.headerTitle || "See where your money stands";
  const note = meta?.headerNote || "Add several photos at once. Each one files under income, spending, or debt.";
  const fill = meta?.headerFill ?? "panel";
  const ink = meta?.headerInk ?? "ink";
  const inkClass = ink === "light" ? "text-foam" : "text-ink";
  const quietClass = ink === "light" ? "text-foam/80" : "text-muted";
  const headerPicture = Boolean(headerUrl);

  return (
    <div data-theme={theme} data-glass="on" className="min-h-dvh bg-paper text-ink" style={pageStyle}>
      {photoUrl ? (
        <div className="pointer-events-none fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${photoUrl}")` }} />
      ) : null}
      {photoUrl ? <div className="backdrop-scrim pointer-events-none fixed inset-0" /> : null}
      {meta?.showHeader !== false ? (
      <header className="relative mx-auto flex max-w-6xl flex-col gap-1 px-4 pt-5 lg:px-8">
        <div
          className={clsx(
            "relative overflow-hidden rounded-card px-4 py-3",
            headerPicture && "min-h-44",
            headerPicture || fill === "clear" ? "header-shadow" : "",
            !headerPicture && fill === "panel" ? "bg-canvas/90 backdrop-blur" : "",
            !headerPicture && fill === "clear" ? "bg-transparent" : "",
          )}
          style={!headerPicture && fill === "color" ? { backgroundColor: meta?.headerColor || "#f7f5f1" } : undefined}
        >
          {headerUrl ? (
            <>
              <img src={headerUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-black/40" />
            </>
          ) : null}
          <div className="relative">
            <p className={clsx("text-xs font-semibold tracking-widest", headerPicture ? "text-foam/80" : quietClass)}>{kicker}</p>
            <h1 className={clsx("font-display text-3xl sm:text-4xl", headerPicture ? "text-foam" : inkClass)}>{title}</h1>
            <p className={clsx("mt-1 max-w-sm text-sm", headerPicture ? "text-foam/80" : quietClass)}>{note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="press rounded-full bg-canvas/80 px-3 py-2 text-sm font-medium text-ink backdrop-blur"
                onClick={() => headerFile.current?.click()}
              >
                {headerPicture ? "Change headline photo" : "Add photo to headline"}
              </button>
              {headerPicture ? (
                <button
                  type="button"
                  className="press rounded-full bg-canvas/80 px-3 py-2 text-sm text-ink backdrop-blur"
                  onClick={() => void ledger.clearHeaderPhoto()}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      ) : null}

      <div className="relative mx-auto mt-3 flex max-w-6xl items-stretch gap-3 px-3 pb-24 lg:gap-4 lg:px-8 lg:pb-8">
        <aside className="hidden w-56 shrink-0 flex-col rounded-card bg-sidebar p-3 text-foam lg:flex">
          <Sidebar />
        </aside>

        <main className="glass-main min-w-0 flex-1 rounded-card p-4 shadow-lift sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-card lg:hidden" aria-label="Open menu" onClick={() => ledger.setNavOpen(true)}>
                <Menu className="size-5" />
              </button>
              <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-card" aria-label="Previous month" onClick={() => ledger.setMonth(shiftMonth(ledger.month || currentMonthFallback(), -1))}>
                <ChevronLeft className="size-5" />
              </button>
              <p className="min-w-0 max-w-28 truncate px-1 text-sm font-medium sm:max-w-none">{ledger.month ? formatMonth(ledger.month) : "Month"}</p>
              <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-card" aria-label="Next month" onClick={() => ledger.setMonth(shiftMonth(ledger.month || currentMonthFallback(), 1))}>
                <ChevronRight className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="press flex size-11 items-center justify-center rounded-full bg-card"
                aria-label={hideMoney ? "Show amounts" : "Hide amounts"}
                onClick={() => void ledger.setHideMoney(!hideMoney)}
              >
                {hideMoney ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </button>
              <button
                type="button"
                className="press flex size-11 items-center justify-center rounded-full bg-card"
                aria-label={theme === "night" ? "Switch to day" : "Switch to night"}
                onClick={() => void ledger.setTheme(theme === "night" ? "day" : "night")}
              >
                {theme === "night" ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>
              <button
                type="button"
                className="press flex size-11 items-center justify-center rounded-full bg-card"
                aria-label="Customize look"
                onClick={() => setLookOpen(true)}
              >
                <Palette className="size-5" />
              </button>
              <div className="hidden gap-2 sm:flex">
              <button type="button" className="press inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-canvas" onClick={openPhotos}>
                <Images className="size-4" aria-hidden="true" />
                Add photos
              </button>
              <button type="button" className="press inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium shadow-lift" onClick={() => ledger.setAddOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Add by hand
              </button>
              </div>
            </div>
          </div>

          {ledger.notice ? (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-butter px-4 py-3 text-sm">
              <p>{ledger.notice}</p>
              <button type="button" className="font-medium" onClick={() => ledger.setNotice(null)}>
                Dismiss
              </button>
            </div>
          ) : null}

          {ledger.view === "home" ? <Dashboard onOpenPhoto={setLightbox} /> : null}
          {ledger.view === "slips" ? <Slips onOpenPhoto={setLightbox} /> : null}
          {ledger.view === "debts" ? <Debts /> : null}
          {ledger.view === "plan" ? <Plan /> : null}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button type="button" className="press inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-medium text-canvas" onClick={openPhotos}>
            <Images className="size-4" aria-hidden="true" />
            Add photos
          </button>
          <button type="button" className="press inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-card py-3 text-sm font-medium shadow-lift" onClick={() => ledger.setAddOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            By hand
          </button>
        </div>
      </div>

      {ledger.navOpen ? (
        <div className="fixed inset-0 z-40 veil lg:hidden" onClick={() => ledger.setNavOpen(false)}>
          <div className="flex h-full w-72 max-w-[80%] flex-col bg-sidebar p-4 text-foam" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="press mb-4 flex size-11 items-center justify-center rounded-full bg-sidebar-soft" aria-label="Close menu" onClick={() => ledger.setNavOpen(false)}>
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => ledger.setNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <input
        ref={photos}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          const list = event.target.files;
          if (list && list.length > 0) {
            const next = [...list]
              .filter((file) => file.type.startsWith("image/"))
              .slice(0, 8)
              .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
            setStaged((current) => {
              for (const item of current) URL.revokeObjectURL(item.url);
              return next;
            });
          }
          event.target.value = "";
        }}
      />

      <AddSheet />
      <EditSheet />
      <FilingSheet />

      <input
        ref={backdrop}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void ledger.setBackgroundPhoto(file);
          event.target.value = "";
        }}
      />

      <input
        ref={headerFile}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void ledger.setHeaderPhoto(file);
          event.target.value = "";
        }}
      />

      {lookOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-2 veil sm:items-center" onClick={() => setLookOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Background"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-canvas p-5 shadow-lift"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Look</h2>
              <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-paper" onClick={() => setLookOpen(false)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm font-medium">Day or night</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={clsx("press rounded-2xl py-3 text-sm font-medium", theme === "day" ? "bg-ink text-canvas" : "bg-paper")}
                onClick={() => void ledger.setTheme("day")}
              >
                Day
              </button>
              <button
                type="button"
                className={clsx("press rounded-2xl py-3 text-sm font-medium", theme === "night" ? "bg-ink text-canvas" : "bg-paper")}
                onClick={() => void ledger.setTheme("night")}
              >
                Night
              </button>
            </div>
            <p className="mt-5 text-sm font-medium">Background</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {BACKGROUNDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx(
                    "press rounded-2xl border px-2 py-3 text-sm",
                    background === item.id ? "border-ink" : "border-transparent",
                  )}
                  style={{ backgroundColor: item.color, color: item.id === "ink" ? "#f7f5f1" : "#1c1d21" }}
                  onClick={() => void ledger.setBackground(item.id, item.color)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              Custom color
              <input
                type="color"
                className="h-11 w-16 cursor-pointer rounded-xl border-0 bg-transparent"
                value={/^#[0-9a-fA-F]{6}$/.test(backgroundColor) ? backgroundColor : "#efece6"}
                aria-label="Custom background color"
                onChange={(event) => void ledger.setBackground("custom", event.target.value)}
              />
            </label>
            <button
              type="button"
              className="press mt-4 w-full rounded-full bg-ink py-3 text-sm font-medium text-canvas"
              onClick={() => backdrop.current?.click()}
            >
              Use a photo
            </button>
            {background === "photo" ? (
              <button
                type="button"
                className="press mt-2 w-full rounded-full bg-paper py-3 text-sm"
                onClick={() => void ledger.clearBackgroundPhoto()}
              >
                Remove photo
              </button>
            ) : null}
            {headerDraft ? (
              <div className="mt-6 border-t border-line pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Heading</p>
                  <button
                    type="button"
                    className={clsx("press rounded-full px-3 py-2 text-sm", meta?.showHeader !== false ? "bg-ink text-canvas" : "bg-paper")}
                    aria-pressed={meta?.showHeader !== false}
                    onClick={() => void ledger.setShowHeader(meta?.showHeader === false)}
                  >
                    {meta?.showHeader === false ? "Off" : "On"}
                  </button>
                </div>
                {meta?.showHeader === false ? (
                  <p className="mt-2 text-sm text-muted">The title at the top is hidden. Turn it on to show it again.</p>
                ) : (
                  <>
                <label className="mt-3 block text-sm">
                  Small label
                  <input
                    className="field mt-1"
                    value={headerDraft.headerKicker}
                    maxLength={40}
                    onChange={(event) => setHeaderDraft({ ...headerDraft, headerKicker: event.target.value })}
                    onBlur={() => saveHeader(headerDraft)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Title
                  <input
                    className="field mt-1"
                    value={headerDraft.headerTitle}
                    maxLength={80}
                    onChange={(event) => setHeaderDraft({ ...headerDraft, headerTitle: event.target.value })}
                    onBlur={() => saveHeader(headerDraft)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Note
                  <input
                    className="field mt-1"
                    value={headerDraft.headerNote}
                    maxLength={160}
                    onChange={(event) => setHeaderDraft({ ...headerDraft, headerNote: event.target.value })}
                    onBlur={() => saveHeader(headerDraft)}
                  />
                </label>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["panel", "clear", "color"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={clsx("press rounded-2xl py-3 text-sm capitalize", headerDraft.headerFill === item ? "bg-ink text-canvas" : "bg-paper")}
                      onClick={() => saveHeader({ ...headerDraft, headerFill: item })}
                    >
                      {item === "panel" ? "Panel" : item === "clear" ? "Clear" : "Color"}
                    </button>
                  ))}
                </div>
                {headerDraft.headerFill === "color" ? (
                  <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                    Header color
                    <input
                      type="color"
                      className="h-11 w-16 cursor-pointer rounded-xl border-0 bg-transparent"
                      value={/^#[0-9a-fA-F]{6}$/.test(headerDraft.headerColor) ? headerDraft.headerColor : "#f7f5f1"}
                      aria-label="Header color"
                      onChange={(event) => saveHeader({ ...headerDraft, headerColor: event.target.value })}
                    />
                  </label>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={clsx("press rounded-2xl py-3 text-sm", headerDraft.headerInk === "ink" ? "bg-ink text-canvas" : "bg-paper")}
                    onClick={() => saveHeader({ ...headerDraft, headerInk: "ink" })}
                  >
                    Dark text
                  </button>
                  <button
                    type="button"
                    className={clsx("press rounded-2xl py-3 text-sm", headerDraft.headerInk === "light" ? "bg-ink text-canvas" : "bg-paper")}
                    onClick={() => saveHeader({ ...headerDraft, headerInk: "light" })}
                  >
                    Light text
                  </button>
                </div>
                <button
                  type="button"
                  className="press mt-4 w-full rounded-full bg-ink py-3 text-sm font-medium text-canvas"
                  onClick={() => headerFile.current?.click()}
                >
                  Use a picture in the header
                </button>
                {headerImage ? (
                  <button type="button" className="press mt-2 w-full rounded-full bg-paper py-3 text-sm" onClick={() => void ledger.clearHeaderPhoto()}>
                    Remove header picture
                  </button>
                ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {staged.length > 0 ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-2 veil sm:items-center" onClick={clearStaged}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Review photos"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-canvas p-5 shadow-lift"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">These photos</h2>
              <button type="button" className="press flex size-11 items-center justify-center rounded-full bg-paper" onClick={clearStaged} aria-label="Cancel">
                <X className="size-5" />
              </button>
            </div>
            <ul className="space-y-2">
              {staged.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-paper p-2">
                  <img src={item.url} alt="" className="size-14 rounded-xl object-cover" />
                  <p className="min-w-0 flex-1 truncate text-sm">{item.file.name}</p>
                  <button type="button" className="press rounded-full px-3 py-2 text-sm" onClick={() => dropStaged(item.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" className="press flex-1 rounded-full bg-paper py-3 text-sm font-medium" onClick={clearStaged}>
                Cancel
              </button>
              <button
                type="button"
                className="press flex-1 rounded-full bg-ink py-3 text-sm font-medium text-canvas"
                onClick={() => {
                  const files = staged.map((item) => item.file);
                  clearStaged();
                  void ledger.filePhotos(files);
                }}
              >
                File photos
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 veil-strong" onClick={() => setLightbox(null)}>
          <div className="flex w-full max-w-lg flex-col gap-3" onClick={(event) => event.stopPropagation()}>
            <img src={lightbox.src} alt="Slip photo" className="max-h-[75dvh] w-full rounded-2xl object-contain" />
            <div className="flex gap-2">
              <button type="button" className="press flex-1 rounded-full bg-canvas py-3 text-sm font-medium" onClick={() => setLightbox(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="press flex-1 rounded-full bg-ink py-3 text-sm font-medium text-canvas"
                onClick={() => {
                  const entryId = lightbox.entryId;
                  setLightbox(null);
                  void ledger.removeEntryPhoto(entryId);
                }}
              >
                Delete photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function currentMonthFallback(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const ledger = useLedger();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pb-4">
        <p className="font-display text-2xl">Daybook</p>
        <p className="text-xs text-foam/60">Saved on this device</p>
      </div>
      <nav className="space-y-1" aria-label="Sections">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = ledger.view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(
                "press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm",
                active ? "bg-sidebar-soft font-medium" : "text-foam/80",
              )}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                ledger.setView(item.id);
                onNavigate?.();
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-6 px-3 text-xs font-semibold tracking-widest text-foam/50">MONTHS</div>
      <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {ledger.months.map((month) => (
          <button
            key={month}
            type="button"
            className={clsx(
              "press flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm",
              month === ledger.month ? "bg-sidebar-soft" : "text-foam/75",
            )}
            onClick={() => {
              ledger.setMonth(month);
              onNavigate?.();
            }}
          >
            <CalendarRange className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatMonth(month)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
