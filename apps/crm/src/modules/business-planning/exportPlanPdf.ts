import type { jsPDF as JsPDF } from "jspdf";
import type { BusinessPlan, ConsolidatedReport } from "./types";
import { planTotals } from "./types";

const NAVY = "#0f2a4a";
const GOLD = "#8f6f26";
const TEXT_SOFT = "#5b6272";

// public/img is copied as-is to the build output root — same note as
// PortalLayout.tsx/AuthLayout.tsx.
const LOGO_URL = `${import.meta.env.BASE_URL}img/aangi-logo-full-tight.png`;

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // report still generates without the logo rather than failing outright
  }
}

// jsPDF + jspdf-autotable are dynamically imported (like BulkLeadUpload.tsx
// already does for xlsx) so their ~600KB doesn't ship in the main bundle —
// only paid for when someone actually clicks "Download PDF".
async function loadPdfLibs() {
  const [{ default: jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}

function drawBrandHeader(doc: JsPDF, logo: string | null, title: string, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageWidth, 28, "F");
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 12, 6, 34, 16, undefined, "FAST");
    } catch {
      // malformed/unreadable image — header band still renders without it
    }
  }
  doc.setTextColor("#f6f3ea");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, pageWidth - 12, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, pageWidth - 12, 20, { align: "right" });
  doc.setFillColor(GOLD);
  doc.rect(0, 28, pageWidth, 1.5, "F");
  doc.setTextColor("#000000");
}

function drawFooter(doc: JsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(TEXT_SOFT);
    doc.text(
      `Aangi Associates — confidential internal report. Generated ${new Date().toLocaleString("en-IN")}.`,
      12,
      pageHeight - 8,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: "right" });
  }
}

export async function exportPlanPdf(plan: BusinessPlan): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const logo = await logoDataUrl();
  const doc = new jsPDF();

  drawBrandHeader(doc, logo, "Business Plan", plan.period_label);

  doc.setFontSize(11);
  doc.setTextColor("#1b2333");
  doc.text(`Associate: ${plan.associate_name}`, 12, 38);
  doc.setFontSize(9);
  doc.setTextColor(TEXT_SOFT);
  doc.text(`Period: ${plan.start_date} to ${plan.end_date} (${plan.period_type})`, 12, 44);

  const totals = planTotals(plan);
  autoTable(doc, {
    startY: 50,
    head: [["Category", "Target (Rs.)", "Achieved (Rs.)", "%", "Commission Earned (Rs.)", "Commission Expected (Rs.)"]],
    body: plan.targets.map((t) => [
      t.category_name,
      t.expected_premium?.toLocaleString("en-IN") ?? "—",
      t.achieved_premium.toLocaleString("en-IN"),
      t.expected_premium ? `${Math.round((t.achieved_premium / t.expected_premium) * 100)}%` : "—",
      t.commission_earned.toLocaleString("en-IN"),
      t.commission_expected.toLocaleString("en-IN"),
    ]),
    foot: [
      [
        "Total",
        totals.expected.toLocaleString("en-IN"),
        totals.achieved.toLocaleString("en-IN"),
        totals.expected ? `${Math.round((totals.achieved / totals.expected) * 100)}%` : "—",
        totals.commissionEarned.toLocaleString("en-IN"),
        totals.commissionExpected.toLocaleString("en-IN"),
      ],
    ],
    headStyles: { fillColor: NAVY, textColor: "#f6f3ea" },
    footStyles: { fillColor: "#efe8d8", textColor: "#1b2333", fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  if (plan.notes) {
    // @ts-expect-error — autoTable augments doc with lastAutoTable at runtime
    const y = (doc.lastAutoTable?.finalY ?? 50) + 10;
    doc.setFontSize(9);
    doc.setTextColor(TEXT_SOFT);
    doc.text(doc.splitTextToSize(`Notes: ${plan.notes}`, 186), 12, y);
  }

  drawFooter(doc);
  doc.save(`Aangi-Business-Plan-${plan.associate_name.replace(/\s+/g, "-")}-${plan.start_date}.pdf`);
}

export async function exportConsolidatedPdf(report: ConsolidatedReport): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const logo = await logoDataUrl();
  const doc = new jsPDF();

  drawBrandHeader(doc, logo, "Consolidated Achievement", `${report.start_date} to ${report.end_date}`);

  autoTable(doc, {
    startY: 36,
    head: [["Associate", "Plans", "Target (Rs.)", "Achieved (Rs.)", "%", "Commission Earned (Rs.)"]],
    body: report.associates.map((a) => [
      a.associate_name,
      String(a.plan_count),
      a.expected_premium.toLocaleString("en-IN"),
      a.achieved_premium.toLocaleString("en-IN"),
      a.expected_premium ? `${Math.round((a.achieved_premium / a.expected_premium) * 100)}%` : "—",
      a.commission_earned.toLocaleString("en-IN"),
    ]),
    headStyles: { fillColor: NAVY, textColor: "#f6f3ea" },
    styles: { fontSize: 9 },
  });

  if (report.by_category.length) {
    // @ts-expect-error — autoTable augments doc with lastAutoTable at runtime
    const y = (doc.lastAutoTable?.finalY ?? 36) + 10;
    doc.setFontSize(11);
    doc.setTextColor("#1b2333");
    doc.text("By Category", 12, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Category", "Target (Rs.)", "Achieved (Rs.)", "%"]],
      body: report.by_category.map((c) => [
        c.category_name,
        c.expected_premium.toLocaleString("en-IN"),
        c.achieved_premium.toLocaleString("en-IN"),
        c.expected_premium ? `${Math.round((c.achieved_premium / c.expected_premium) * 100)}%` : "—",
      ]),
      headStyles: { fillColor: GOLD, textColor: "#1b2333" },
      styles: { fontSize: 9 },
    });
  }

  drawFooter(doc);
  doc.save(`Aangi-Consolidated-Achievement-${report.start_date}-to-${report.end_date}.pdf`);
}
