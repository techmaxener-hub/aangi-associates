import type { WorkSheet } from "xlsx";
import type { BusinessPlan, ConsolidatedReport } from "./types";
import { planTotals } from "./types";

// xlsx (SheetJS) is already a project dependency, dynamically imported
// exactly like BulkLeadUpload.tsx does for the reverse direction (reading
// an uploaded file) — kept out of the main bundle until actually needed.
async function loadXlsx() {
  return await import("xlsx");
}

const HEADER_FILL = { fill: { fgColor: { rgb: "0F2A4A" } }, font: { color: { rgb: "F6F3EA" }, bold: true } };
const TITLE_FONT = { font: { bold: true, sz: 14, color: { rgb: "0F2A4A" } } };

// SheetJS's community build's style-write support is best-effort across
// viewers — the sheet is fully structured and correct either way, styling
// is a bonus, not something the export depends on to be usable.
function styleCell(ws: WorkSheet, addr: string, style: object) {
  const cell = (ws as Record<string, { s?: object } | undefined>)[addr];
  if (cell) cell.s = style;
}

export async function exportPlanExcel(plan: BusinessPlan): Promise<void> {
  const XLSX = await loadXlsx();
  const totals = planTotals(plan);

  const rows: (string | number)[][] = [
    ["Aangi Associates — Business Plan"],
    [`Associate: ${plan.associate_name}`],
    [`Period: ${plan.period_label} (${plan.start_date} to ${plan.end_date})`],
    [`Generated: ${new Date().toLocaleString("en-IN")}`],
    [],
    ["Category", "Target (₹)", "Achieved (₹)", "%", "Commission Earned (₹)", "Commission Expected (₹)"],
    ...plan.targets.map((t) => [
      t.category_name,
      t.expected_premium ?? "",
      t.achieved_premium,
      t.expected_premium ? Math.round((t.achieved_premium / t.expected_premium) * 100) : "",
      t.commission_earned,
      t.commission_expected,
    ]),
    [
      "Total",
      totals.expected,
      totals.achieved,
      totals.expected ? Math.round((totals.achieved / totals.expected) * 100) : "",
      totals.commissionEarned,
      totals.commissionExpected,
    ],
  ];
  if (plan.notes) rows.push([], [`Notes: ${plan.notes}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 20 }];
  styleCell(ws, "A1", TITLE_FONT);
  ["A6", "B6", "C6", "D6", "E6", "F6"].forEach((addr) => styleCell(ws, addr, HEADER_FILL));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Business Plan");
  XLSX.writeFile(wb, `Aangi-Business-Plan-${plan.associate_name.replace(/\s+/g, "-")}-${plan.start_date}.xlsx`, {
    cellStyles: true,
  });
}

export async function exportConsolidatedExcel(report: ConsolidatedReport): Promise<void> {
  const XLSX = await loadXlsx();

  const rows: (string | number)[][] = [
    ["Aangi Associates — Consolidated Achievement"],
    [`Period: ${report.start_date} to ${report.end_date}`],
    [`Generated: ${new Date().toLocaleString("en-IN")}`],
    [],
    ["Associate", "Plans", "Target (₹)", "Achieved (₹)", "%", "Commission Earned (₹)"],
    ...report.associates.map((a) => [
      a.associate_name,
      a.plan_count,
      a.expected_premium,
      a.achieved_premium,
      a.expected_premium ? Math.round((a.achieved_premium / a.expected_premium) * 100) : "",
      a.commission_earned,
    ]),
  ];

  if (report.by_category.length) {
    rows.push([], ["By Category"], ["Category", "Target (₹)", "Achieved (₹)", "%"]);
    report.by_category.forEach((c) =>
      rows.push([
        c.category_name,
        c.expected_premium,
        c.achieved_premium,
        c.expected_premium ? Math.round((c.achieved_premium / c.expected_premium) * 100) : "",
      ]),
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 18 }];
  styleCell(ws, "A1", TITLE_FONT);
  ["A5", "B5", "C5", "D5", "E5", "F5"].forEach((addr) => styleCell(ws, addr, HEADER_FILL));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consolidated");
  XLSX.writeFile(wb, `Aangi-Consolidated-Achievement-${report.start_date}-to-${report.end_date}.xlsx`, {
    cellStyles: true,
  });
}
