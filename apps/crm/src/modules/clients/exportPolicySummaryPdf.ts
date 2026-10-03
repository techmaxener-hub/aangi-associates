import type { jsPDF as JsPDF } from "jspdf";
import type { ClientPolicy } from "./types";
import { formatDate } from "../../lib/format";

// jsPDF's built-in Helvetica has no glyph for ₹ (U+20B9) — it silently
// renders as a stray "¹", confirmed visually before shipping this file.
// exportPlanPdf.ts already sidesteps this the same way (its table headers
// read "(Rs.)", never ₹) — same fix here, not formatINR().
function formatRs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !isFinite(amount)) return "—";
  return "Rs. " + Math.round(amount).toLocaleString("en-IN");
}

// A client-facing "Policy Summary" one-pager — the branded takeaway a
// client gets after a policy is issued/renewed, built from a reference
// layout the user supplied (a competing agency's branded PDF) but in
// Aangi Associates' own locked design tokens (packages/ui/tokens.css),
// not that agency's. Same jsPDF pattern as business-planning/
// exportPlanPdf.ts (dynamic import, logo-as-data-URL, brand header/footer
// helpers) — this file doesn't reuse those helpers directly since this
// document's tone and layout are different (client-facing reassurance,
// not an internal achievement table), but intentionally mirrors their
// shape for consistency across the app's PDF exports.

const NAVY = "#0f2a4a";
const CRIMSON = "#9c1c30";
const GOLD = "#8f6f26";
const TEXT = "#1b2333";
const TEXT_SOFT = "#5b6272";
const SURFACE_2 = "#efe8d8";
const LINE = "#e1d9c3";

const OFFICE_PHONE = "+91 90331 32791";
const OFFICE_ADDRESS = "615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad";

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
    return null; // summary still generates without the logo rather than failing outright
  }
}

async function loadJsPdf() {
  const { default: jsPDF } = await import("jspdf");
  return jsPDF;
}

function row(doc: JsPDF, x: number, y: number, label: string, value: string) {
  doc.setFontSize(9);
  doc.setTextColor(TEXT_SOFT);
  doc.text(label, x, y);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT);
  doc.text(value, x, y + 5.5, { maxWidth: 82 });
  doc.setFont("helvetica", "normal");
}

export async function exportPolicySummaryPdf(clientName: string, policy: ClientPolicy, advisorName: string): Promise<void> {
  const jsPDF = await loadJsPdf();
  const logo = await logoDataUrl();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // ---- Header band ---------------------------------------------------
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageWidth, 26, "F");
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, 5, 32, 16, undefined, "FAST");
    } catch {
      // malformed/unreadable image — header still renders without it
    }
  }
  doc.setTextColor("#f6f3ea");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(OFFICE_PHONE, pageWidth - marginX, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Protecting What Matters. Securing What You Build.", pageWidth - marginX, 15.5, { align: "right" });
  doc.setFillColor(GOLD);
  doc.rect(0, 26, pageWidth, 1.3, "F");

  // ---- Title -----------------------------------------------------------
  doc.setTextColor(TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("POLICY SUMMARY", marginX, 40);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.8);
  doc.line(marginX, 44, marginX + 26, 44);

  // ---- Personal note ----------------------------------------------------
  let y = 54;
  doc.setFillColor(SURFACE_2);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 32, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT);
  doc.text(`Dear ${clientName},`, marginX + 6, y + 9);
  doc.setTextColor(GOLD);
  doc.text("Thank you for trusting us with something this important.", marginX + 6, y + 15.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_SOFT);
  const note = doc.splitTextToSize(
    "Your policy is more than paperwork — it's our commitment to stand by you and your family when it matters most. " +
      "This summary is so you always know exactly what you're covered for. Whether it's a claim, a renewal, or simply a question, we're just a call away.",
    pageWidth - marginX * 2 - 12,
  );
  doc.text(note, marginX + 6, y + 21);

  // ---- Advisor strip ------------------------------------------------------
  y += 38;
  doc.setFillColor(NAVY);
  doc.setTextColor("#f6f3ea");
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Advisor: ${advisorName}`, marginX + 6, y + 6.8);
  doc.setFont("helvetica", "normal");
  doc.text("Aangi Associates — TATA AIA Life Insurance, Chief Business Associate", pageWidth - marginX - 6, y + 6.8, {
    align: "right",
  });

  // ---- Policy detail card ------------------------------------------------
  y += 16;
  const cardHeight = 58;
  doc.setDrawColor(LINE);
  doc.setFillColor("#ffffff");
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, cardHeight, 2, 2, "FD");
  doc.setFillColor(NAVY);
  doc.rect(marginX, y, pageWidth - marginX * 2, 9, "F");
  doc.setTextColor("#f6f3ea");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Policy Detail", marginX + 6, y + 6.2);

  const colL = marginX + 6;
  const colR = marginX + (pageWidth - marginX * 2) / 2 + 4;
  let rowY = y + 19;
  row(doc, colL, rowY, "Policyholder", clientName);
  row(doc, colR, rowY, "Policy Start Date", policy.start_date ? formatDate(policy.start_date) : "—");
  rowY += 14;
  row(doc, colL, rowY, "Policy Number", policy.policy_number ?? "—");
  row(doc, colR, rowY, "Renewal / End Date", policy.renewal_date ? formatDate(policy.renewal_date) : "—");
  rowY += 14;
  row(doc, colL, rowY, "Policy Type", policy.product_type);
  row(doc, colR, rowY, "Insurance Company", policy.insurer);

  // ---- Sum Assured / Premium strip --------------------------------------
  y += cardHeight + 8;
  const halfW = (pageWidth - marginX * 2 - 6) / 2;
  doc.setFillColor(SURFACE_2);
  doc.roundedRect(marginX, y, halfW, 18, 2, 2, "F");
  doc.roundedRect(marginX + halfW + 6, y, halfW, 18, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_SOFT);
  doc.text("Sum Assured", marginX + 6, y + 7);
  doc.text("Premium", marginX + halfW + 12, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(CRIMSON);
  doc.text(formatRs(policy.sum_assured), marginX + 6, y + 14);
  doc.text(formatRs(policy.premium), marginX + halfW + 12, y + 14);

  // ---- Disclaimer --------------------------------------------------------
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(TEXT_SOFT);
  doc.text(
    doc.splitTextToSize(
      "This is a quick-reference summary, not a substitute for your official policy document, premium receipt, or policy wording — please refer to those for the complete terms, conditions, and exclusions.",
      pageWidth - marginX * 2,
    ),
    marginX,
    y,
  );

  // ---- Cross-sell teaser + quote -----------------------------------------
  y += 14;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(GOLD);
  doc.text("Explore More Protection for Your Family", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_SOFT);
  doc.text(
    doc.splitTextToSize(
      "A policy review takes 15 minutes and could reveal gaps in health, savings, or retirement cover you haven't thought about yet. " +
        "Reply on WhatsApp below whenever you'd like to talk it through — no obligation.",
      pageWidth - marginX * 2,
    ),
    marginX,
    y + 6,
  );

  y += 26;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(NAVY);
  doc.text('"I\'m here to help you today and always. Let\'s build a secure tomorrow, together."', marginX, y);
  doc.setFont("helvetica", "normal");

  // ---- Footer -------------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 22;
  doc.setFillColor(NAVY);
  doc.rect(0, footerY, pageWidth, 22, "F");
  doc.setTextColor("#f6f3ea");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Reach Us Anytime", marginX, footerY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const contactLine = `${advisorName}  ·  ${OFFICE_PHONE} (tap to WhatsApp)`;
  doc.text(contactLine, marginX, footerY + 13.5);
  // The whole contact line is clickable — opens a pre-filled WhatsApp chat
  // to the office number, so a client reading a printed/emailed PDF has a
  // one-tap way to actually act on the "Explore More Protection" teaser
  // above, not just read about it.
  const waDigits = OFFICE_PHONE.replace(/\D/g, "");
  const waMessage = encodeURIComponent(
    `Hi, I'm ${clientName} — I'd like to talk about reviewing my family's protection plan.`,
  );
  doc.link(marginX, footerY + 9.5, doc.getTextWidth(contactLine), 5, { url: `https://wa.me/${waDigits}?text=${waMessage}` });
  doc.setFontSize(7);
  doc.text(OFFICE_ADDRESS, marginX, footerY + 18);
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleDateString("en-IN")}`, pageWidth - marginX, footerY + 18, { align: "right" });

  doc.save(`Aangi-Policy-Summary-${clientName.replace(/\s+/g, "-")}-${policy.product_type.replace(/\s+/g, "-")}.pdf`);
}
