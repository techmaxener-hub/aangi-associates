export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return "—";
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// YYYY-MM-DD for the LOCAL calendar date, for exact-match comparisons
// against `date` columns (e.g. "due today", "renewing within N days").
// toISOString() converts to UTC first, which is wrong here — for any
// timezone ahead of UTC (e.g. IST, UTC+5:30), the UTC calendar date can
// still be "yesterday" during the first few hours of the local day,
// silently excluding today's rows from an .eq("due_date", today) query.
export function localDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
