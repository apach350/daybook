import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { classifySlip } from "@/lib/ledger/classify";
import {
  readPhoto,
  readSnapshot,
  removeBill,
  removeDebt,
  removeEntry,
  removePhoto,
  saveBill,
  saveDebt,
  saveEntry,
  saveMeta,
  savePhoto,
} from "@/lib/ledger/db";
import { fileToJpeg } from "@/lib/ledger/images";
import { daysInMonth, formatMoney, formatMonth, isoDate, monthKey, norm, uid } from "@/lib/ledger/money";
import { buildSample } from "@/lib/ledger/sample";
import {
  CATEGORIES,
  type Bill,
  type ClassifyResult,
  type Debt,
  type Entry,
  type FilingItem,
  type Meta,
  type Section,
  type Snapshot,
  type ViewId,
} from "@/lib/ledger/types";

const MAX_BATCH = 8;
let bootOnce: Promise<void> | null = null;

function duplicateSample(snap: Snapshot): boolean {
  const keys = snap.entries
    .filter((entry) => entry.sample)
    .map((entry) => `${entry.section}|${entry.date}|${entry.label}|${entry.amountCents}`);
  return new Set(keys).size !== keys.length;
}

async function prepareBook(now: Date): Promise<void> {
  const current = await readSnapshot();
  const empty = !current.meta.touched && current.entries.length === 0 && current.debts.length === 0;
  const dirty = current.meta.sample && duplicateSample(current);
  if (!empty && !dirty) return;
  if (dirty) {
    await Promise.all([
      ...current.entries.filter((entry) => entry.sample).map((entry) => removeEntry(entry.id)),
      ...current.debts.filter((debt) => debt.sample).map((debt) => removeDebt(debt.id)),
      ...current.bills.filter((bill) => bill.sample).map((bill) => removeBill(bill.id)),
    ]);
  }
  const sample = buildSample(now);
  await Promise.all([
    ...sample.entries.map((entry) => saveEntry(entry)),
    ...sample.debts.map((debt) => saveDebt(debt)),
    ...sample.bills.map((bill) => saveBill(bill)),
    saveMeta({
      ...sample.meta,
      theme: current.meta.theme,
      background: current.meta.background,
      backgroundColor: current.meta.backgroundColor,
      headerKicker: current.meta.headerKicker,
      headerTitle: current.meta.headerTitle,
      headerNote: current.meta.headerNote,
      headerFill: current.meta.headerFill,
      headerColor: current.meta.headerColor,
      headerInk: current.meta.headerInk,
      headerImage: current.meta.headerImage,
      showHeader: current.meta.showHeader,
      hideMoney: current.meta.hideMoney,
    }),
  ]);
}

export type EntryDraft = {
  section: Section;
  date: string;
  amountCents: number;
  label: string;
  category: string;
  note: string;
  photoBlob: Blob | null;
  debtId: string | null;
  reduceBalance: boolean;
};

type Controller = {
  ready: boolean;
  today: Date | null;
  month: string;
  setMonth: (month: string) => void;
  view: ViewId;
  setView: (view: ViewId) => void;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  snap: Snapshot | null;
  months: string[];
  notice: string | null;
  setNotice: (notice: string | null) => void;
  filing: FilingItem[];
  filingOpen: boolean;
  setFilingOpen: (open: boolean) => void;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  edit: Entry | null;
  setEdit: (entry: Entry | null) => void;
  filePhotos: (list: FileList | File[]) => Promise<void>;
  addEntry: (draft: EntryDraft) => Promise<void>;
  updateEntry: (entry: Entry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  removeEntryPhoto: (entryId: string) => Promise<void>;
  confirmInbox: (id: string, section: Section, amountCents: number) => Promise<void>;
  addDebt: (debt: Omit<Debt, "id" | "sample" | "createdAt">) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  addBill: (bill: Omit<Bill, "id" | "sample">) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  setPayday: (day: number) => Promise<void>;
  setTheme: (theme: "day" | "night") => Promise<void>;
  setBackground: (background: string, backgroundColor: string) => Promise<void>;
  setBackgroundPhoto: (file: File) => Promise<void>;
  clearBackgroundPhoto: () => Promise<void>;
  setHeader: (header: Pick<Meta, "headerKicker" | "headerTitle" | "headerNote" | "headerFill" | "headerColor" | "headerInk">) => Promise<void>;
  setHeaderPhoto: (file: File) => Promise<void>;
  clearHeaderPhoto: () => Promise<void>;
  setShowHeader: (shown: boolean) => Promise<void>;
  setHideMoney: (hidden: boolean) => Promise<void>;
  logBill: (bill: Bill) => Promise<void>;
  cash: (cents: number) => string;
  markQuietToday: () => Promise<void>;
  clearSample: () => Promise<void>;
};

const LedgerContext = createContext<Controller | null>(null);

async function pool(count: number, worker: (index: number) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(2, count) }, async () => {
    while (cursor < count) {
      const index = cursor;
      cursor += 1;
      await worker(index);
    }
  });
  await Promise.all(runners);
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState("");
  const [view, setView] = useState<ViewId>("home");
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filing, setFiling] = useState<FilingItem[]>([]);
  const [filingOpen, setFilingOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);

  const refresh = useCallback(async () => {
    const next = await readSnapshot();
    setSnap(next);
    return next;
  }, []);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setMonth(monthKey(now));
    let cancel = false;
    const ready = (bootOnce ??= prepareBook(now));
    void ready
      .then(async () => {
        if (cancel) return;
        setSnap(await readSnapshot());
      })
      .catch(() => {
        if (!cancel) setNotice("Could not open the daybook on this device.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const dropSample = useCallback(async (current: Snapshot) => {
    if (!current.meta.sample) return current;
    await Promise.all([
      ...current.entries.filter((entry) => entry.sample).map((entry) => removeEntry(entry.id)),
      ...current.debts.filter((debt) => debt.sample).map((debt) => removeDebt(debt.id)),
      ...current.bills.filter((bill) => bill.sample).map((bill) => removeBill(bill.id)),
    ]);
    const meta = { ...current.meta, sample: false, touched: true };
    await saveMeta(meta);
    return refresh();
  }, [refresh]);

  const months = useMemo(() => {
    const keys = new Set<string>();
    if (month) keys.add(month);
    if (today) keys.add(monthKey(today));
    for (const entry of snap?.entries ?? []) {
      if (entry.section !== "inbox") keys.add(entry.date.slice(0, 7));
    }
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [month, snap, today]);

  const filePhotos = useCallback(
    async (list: FileList | File[]) => {
      if (!snap || !today) return;
      const files = [...list].filter((file) => file.type.startsWith("image/")).slice(0, MAX_BATCH);
      if (files.length === 0) {
        setNotice("Choose at least one photo.");
        return;
      }
      if (list.length > MAX_BATCH) {
        setNotice(`Filing the first ${MAX_BATCH} photos. Add the rest in another batch.`);
      }
      const base = await dropSample(snap);
      const prepared: { id: string; blob: Blob; base64: string; name: string }[] = [];
      for (const file of files) {
        try {
          const jpeg = await fileToJpeg(file);
          const id = uid();
          await savePhoto(id, jpeg.blob);
          prepared.push({ id, blob: jpeg.blob, base64: jpeg.base64, name: file.name });
        } catch {
          prepared.push({ id: uid(), blob: new Blob(), base64: "", name: file.name });
        }
      }
      setFiling(
        prepared.map((item) => ({
          id: item.id,
          label: item.name,
          status: item.base64 ? "queued" : "error",
          detail: item.base64 ? "Waiting" : "Could not read this photo",
        })),
      );
      setFilingOpen(true);
      const debts = base.debts.filter((debt) => !debt.sample);

      const patch = (id: string, next: Partial<FilingItem>) => {
        setFiling((items) => items.map((item) => (item.id === id ? { ...item, ...next } : item)));
      };

      await pool(prepared.length, async (index) => {
        const item = prepared[index];
        if (!item.base64) return;
        patch(item.id, { status: "reading", detail: "Reading the slip" });
        let result: ClassifyResult;
        try {
          result = await classifySlip({ data: { image: item.base64 } });
        } catch {
          result = { ok: false, error: "Could not reach photo sorting" };
        }
        if (!result.ok) {
          await saveInbox(item.id, item.name, null, result.error);
          patch(item.id, { status: "needs", detail: result.error });
          return;
        }
        const section = result.section === "inbox" ? null : result.section;
        const low =
          result.confidence < 0.55 ||
          result.section === "inbox" ||
          result.amountCents == null ||
          result.amountCents <= 0;
        if (result.section === "debt" && result.balanceCents != null) {
          await upsertDebt(debts, result.label, result.balanceCents, result.amountCents);
        }
        if (low || !section) {
          await saveInbox(item.id, result.label, section, result.category);
          patch(item.id, {
            status: "needs",
            label: result.label,
            detail: section ? `Looks like ${section}. Add the amount to file it.` : "Needs a section",
          });
          return;
        }
        const date = keepDate(result.date, today);
        const entry: Entry = {
          id: uid(),
          section,
          date,
          amountCents: result.amountCents ?? 0,
          label: result.label,
          category: CATEGORIES[section].includes(result.category) ? result.category : "Other",
          note: "",
          photoId: item.id,
          debtId: null,
          suggested: null,
          sample: false,
          createdAt: Date.now(),
        };
        await saveEntry(entry);
        patch(item.id, {
          status: "filed",
          label: result.label,
          detail: `Filed under ${section} \u00b7 ${formatMonth(date.slice(0, 7))}`,
        });
      });
      await refresh();
    },
    [dropSample, refresh, snap, today],
  );

  const addEntry = useCallback(
    async (draft: EntryDraft) => {
      if (!snap) return;
      await dropSample(snap);
      const photoId = draft.photoBlob ? uid() : null;
      if (photoId && draft.photoBlob) await savePhoto(photoId, draft.photoBlob);
      const entry: Entry = {
        id: uid(),
        section: draft.section,
        date: draft.date,
        amountCents: draft.amountCents,
        label: draft.label.trim() || "Untitled",
        category: draft.category,
        note: draft.note.trim(),
        photoId,
        debtId: draft.debtId,
        suggested: null,
        sample: false,
        createdAt: Date.now(),
      };
      await saveEntry(entry);
      if (draft.reduceBalance && draft.debtId && draft.section === "debt") {
        const current = await readSnapshot();
        const debt = current.debts.find((item) => item.id === draft.debtId);
        if (debt) {
          await saveDebt({
            ...debt,
            balanceCents: Math.max(0, debt.balanceCents - draft.amountCents),
            sample: false,
          });
        }
      }
      await refresh();
      setAddOpen(false);
      setMonth(draft.date.slice(0, 7));
    },
    [dropSample, refresh, snap],
  );

  const updateEntry = useCallback(
    async (entry: Entry) => {
      await saveEntry(entry);
      await refresh();
      setEdit(null);
    },
    [refresh],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const current = snap?.entries.find((entry) => entry.id === id);
      if (current?.photoId) await removePhoto(current.photoId);
      await removeEntry(id);
      await refresh();
      setEdit(null);
    },
    [refresh, snap],
  );

  const removeEntryPhoto = useCallback(
    async (entryId: string) => {
      const current = snap?.entries.find((entry) => entry.id === entryId);
      if (!current?.photoId) return;
      await removePhoto(current.photoId);
      if (current.section === "inbox") await removeEntry(entryId);
      else await saveEntry({ ...current, photoId: null });
      await refresh();
      if (edit?.id === entryId && current.section === "inbox") setEdit(null);
    },
    [edit, refresh, snap],
  );

  const confirmInbox = useCallback(
    async (id: string, section: Section, amountCents: number) => {
      const current = snap?.entries.find((entry) => entry.id === id);
      if (!current) return;
      await saveEntry({
        ...current,
        section,
        amountCents,
        category: CATEGORIES[section].includes(current.category) ? current.category : "Other",
        suggested: null,
        sample: false,
      });
      await refresh();
    },
    [refresh, snap],
  );

  const addDebt = useCallback(
    async (debt: Omit<Debt, "id" | "sample" | "createdAt">) => {
      if (!snap) return;
      await dropSample(snap);
      await saveDebt({ ...debt, id: uid(), sample: false, createdAt: Date.now() });
      const current = await refresh();
      await saveMeta({ ...current.meta, touched: true, sample: false });
      await refresh();
    },
    [dropSample, refresh, snap],
  );

  const deleteDebt = useCallback(
    async (id: string) => {
      await removeDebt(id);
      await refresh();
    },
    [refresh],
  );

  const addBill = useCallback(
    async (bill: Omit<Bill, "id" | "sample">) => {
      if (!snap) return;
      await dropSample(snap);
      await saveBill({ ...bill, id: uid(), sample: false });
      await refresh();
    },
    [dropSample, refresh, snap],
  );

  const deleteBill = useCallback(
    async (id: string) => {
      await removeBill(id);
      await refresh();
    },
    [refresh],
  );

  const setPayday = useCallback(
    async (day: number) => {
      if (!snap) return;
      const paydayDay = Math.min(28, Math.max(1, Math.round(day)));
      await saveMeta({ ...snap.meta, paydayDay });
      await refresh();
    },
    [refresh, snap],
  );

  const setTheme = useCallback(
    async (theme: "day" | "night") => {
      if (!snap) return;
      await saveMeta({ ...snap.meta, theme });
      await refresh();
    },
    [refresh, snap],
  );

  const setBackground = useCallback(
    async (background: string, backgroundColor: string) => {
      if (!snap) return;
      await saveMeta({ ...snap.meta, background, backgroundColor });
      await refresh();
    },
    [refresh, snap],
  );

  const setBackgroundPhoto = useCallback(
    async (file: File) => {
      if (!snap) return;
      const jpeg = await fileToJpeg(file);
      await savePhoto("backdrop", jpeg.blob);
      await saveMeta({ ...snap.meta, background: "photo" });
      await refresh();
    },
    [refresh, snap],
  );

  const clearBackgroundPhoto = useCallback(async () => {
    if (!snap) return;
    await removePhoto("backdrop");
    await saveMeta({ ...snap.meta, background: "paper", backgroundColor: "#efece6" });
    await refresh();
  }, [refresh, snap]);

  const setHeader = useCallback(
    async (header: Pick<Meta, "headerKicker" | "headerTitle" | "headerNote" | "headerFill" | "headerColor" | "headerInk">) => {
      if (!snap) return;
      const clip = (value: string, max: number, fallback: string) => {
        const next = value.trim().slice(0, max);
        return next || fallback;
      };
      await saveMeta({
        ...snap.meta,
        headerKicker: clip(header.headerKicker, 40, "HOME DASHBOARD"),
        headerTitle: clip(header.headerTitle, 80, "See where your money stands"),
        headerNote: clip(header.headerNote, 160, "Add several photos at once. Each one files under income, spending, or debt."),
        headerFill: header.headerFill,
        headerColor: /^#[0-9a-fA-F]{6}$/.test(header.headerColor) ? header.headerColor : snap.meta.headerColor,
        headerInk: header.headerInk,
      });
      await refresh();
    },
    [refresh, snap],
  );

  const setHeaderPhoto = useCallback(
    async (file: File) => {
      if (!snap) return;
      const jpeg = await fileToJpeg(file);
      await savePhoto("header", jpeg.blob);
      await saveMeta({ ...snap.meta, headerImage: true });
      await refresh();
    },
    [refresh, snap],
  );

  const clearHeaderPhoto = useCallback(async () => {
    if (!snap) return;
    await removePhoto("header");
    await saveMeta({ ...snap.meta, headerImage: false });
    await refresh();
  }, [refresh, snap]);

  const setShowHeader = useCallback(
    async (shown: boolean) => {
      if (!snap) return;
      await saveMeta({ ...snap.meta, showHeader: shown });
      await refresh();
    },
    [refresh, snap],
  );

  const setHideMoney = useCallback(
    async (hidden: boolean) => {
      if (!snap) return;
      await saveMeta({ ...snap.meta, hideMoney: hidden });
      await refresh();
    },
    [refresh, snap],
  );

  const logBill = useCallback(
    async (bill: Bill) => {
      if (!snap || !today || !month) return;
      const name = bill.name.trim().toLowerCase();
      const already = snap.entries.some((entry) => {
        if (entry.section !== bill.section || entry.date.slice(0, 7) !== month) return false;
        const label = entry.label.trim().toLowerCase();
        return label.includes(name) || name.includes(label);
      });
      if (already) {
        setNotice(`${bill.name} is already logged this month.`);
        return;
      }
      await dropSample(snap);
      const day = Math.min(Math.max(1, bill.dueDay), daysInMonth(month));
      let date = `${month}-${String(day).padStart(2, "0")}`;
      if (month === monthKey(today) && date > isoDate(today)) date = isoDate(today);
      await saveEntry({
        id: uid(),
        section: bill.section,
        date,
        amountCents: bill.amountCents,
        label: bill.name,
        category: bill.category,
        note: "",
        photoId: null,
        debtId: null,
        suggested: null,
        sample: false,
        createdAt: Date.now(),
      });
      if (bill.section === "debt") {
        const debt = snap.debts.find((item) => item.name.trim().toLowerCase() === name);
        if (debt) {
          await saveDebt({
            ...debt,
            balanceCents: Math.max(0, debt.balanceCents - bill.amountCents),
            sample: false,
          });
        }
      }
      await refresh();
      setNotice(`Logged ${bill.name}.`);
    },
    [dropSample, month, refresh, snap, today],
  );

  const markQuietToday = useCallback(async () => {
    if (!snap || !today) return;
    await saveMeta({ ...snap.meta, quietDate: isoDate(today) });
    await refresh();
  }, [refresh, snap, today]);

  const clearSample = useCallback(async () => {
    if (!snap) return;
    await dropSample(snap);
    setNotice(null);
  }, [dropSample, snap]);

  const value = useMemo<Controller>(
    () => ({
      ready: Boolean(snap && today && month),
      today,
      month,
      setMonth,
      view,
      setView,
      navOpen,
      setNavOpen,
      snap,
      months,
      notice,
      setNotice,
      filing,
      filingOpen,
      setFilingOpen,
      addOpen,
      setAddOpen,
      edit,
      setEdit,
      filePhotos,
      addEntry,
      updateEntry,
      deleteEntry,
      confirmInbox,
      addDebt,
      deleteDebt,
      addBill,
      deleteBill,
      setPayday,
      setTheme,
      setBackground,
      setBackgroundPhoto,
      clearBackgroundPhoto,
      setHeader,
      setHeaderPhoto,
      clearHeaderPhoto,
      setShowHeader,
      setHideMoney,
      logBill,
      cash: (cents: number) => (snap?.meta.hideMoney ? "\u2022\u2022\u2022\u2022" : formatMoney(cents)),
      markQuietToday,
      clearSample,
      removeEntryPhoto,
    }),
    [
      addBill,
      addDebt,
      addEntry,
      addOpen,
      clearSample,
      confirmInbox,
      deleteBill,
      deleteDebt,
      deleteEntry,
      removeEntryPhoto,
      edit,
      filePhotos,
      filing,
      filingOpen,
      markQuietToday,
      month,
      months,
      navOpen,
      notice,
      setPayday,
      setTheme,
      setBackground,
      setBackgroundPhoto,
      clearBackgroundPhoto,
      setHeader,
      setHeaderPhoto,
      clearHeaderPhoto,
      setShowHeader,
      setHideMoney,
      logBill,
      snap,
      today,
      updateEntry,
      view,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

function keepDate(value: string | null, today: Date): string {
  const fallback = isoDate(today);
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return fallback;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const delta = date.getTime() - start;
  if (delta > 14 * 86_400_000 || delta < -800 * 86_400_000) return fallback;
  return value;
}

async function saveInbox(
  photoId: string,
  label: string,
  suggested: Section | null,
  category: string,
) {
  const entry: Entry = {
    id: uid(),
    section: "inbox",
    date: isoDate(new Date()),
    amountCents: 0,
    label: label || "Untitled slip",
    category,
    note: "",
    photoId,
    debtId: null,
    suggested,
    sample: false,
    createdAt: Date.now(),
  };
  await saveEntry(entry);
}

async function upsertDebt(
  debts: Debt[],
  label: string,
  balanceCents: number,
  paymentCents: number | null,
) {
  const name = norm(label);
  const match = debts.find((debt) => {
    const debtName = norm(debt.name);
    return debtName === name || debtName.includes(name) || name.includes(debtName);
  });
  if (match) {
    await saveDebt({
      ...match,
      balanceCents,
      minPaymentCents: paymentCents && paymentCents > 0 ? paymentCents : match.minPaymentCents,
      sample: false,
    });
    return;
  }
  const created: Debt = {
    id: uid(),
    name: label || "Debt",
    balanceCents,
    minPaymentCents: paymentCents && paymentCents > 0 ? paymentCents : 0,
    dueDay: 1,
    sample: false,
    createdAt: Date.now(),
  };
  debts.push(created);
  await saveDebt(created);
}

export function useLedger(): Controller {
  const value = useContext(LedgerContext);
  if (!value) throw new Error("Daybook is not ready");
  return value;
}

export async function loadPhotoUrl(id: string): Promise<string | null> {
  const blob = await readPhoto(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
