export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return "—";
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
