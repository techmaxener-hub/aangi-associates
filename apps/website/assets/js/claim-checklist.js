// Aangi Associates — Personalised Claim Document Checklist generator.
// Document lists are the commonly-required set for each claim category —
// illustrative, not an official insurer list (stated on the page too);
// the claim desk confirms exact requirements per policy.
(function () {
  var CHECKLISTS = {
    term: {
      title: "Term / Life Insurance — Death Claim Checklist",
      items: [
        "Original policy document",
        "Duly filled claim intimation form",
        "Original death certificate (issued by municipal authority)",
        "Nominee's ID proof (Aadhaar / PAN / Passport)",
        "Nominee's bank details + a cancelled cheque",
        "Hospital treatment records / discharge summary, if applicable",
        "FIR and post-mortem report, for an accidental or unnatural death",
        "Legal heir certificate, if a nominee was not registered on the policy",
      ],
    },
    health: {
      title: "Critical Illness, Mediclaim & Group Health — Claim Checklist",
      items: [
        "Duly filled claim form (Part A by the insured, Part B by the hospital for cashless)",
        "Original hospital bills and payment receipts",
        "Discharge summary",
        "Investigation reports (lab tests, imaging)",
        "Doctor's prescriptions and consultation notes",
        "Pharmacy bills",
        "Policy copy and ID proof",
        "Bank details + a cancelled cheque",
      ],
    },
    maturity: {
      title: "Education, Guaranteed Return, Pension & Mutual Fund — Maturity Checklist",
      items: [
        "Original policy document",
        "Maturity discharge form",
        "ID proof",
        "PAN card (for TDS purposes)",
        "Bank details + a cancelled cheque",
        "Age proof, if not already submitted with the original application",
      ],
    },
    general: {
      title: "General Insurance (Motor / Property) — Claim Checklist",
      items: [
        "Claim intimation to the insurer",
        "FIR, for theft or a major accident",
        "Repair estimate and final invoice",
        "Photographs of the damage",
        "Registration Certificate (RC) and driving license, for a motor claim",
        "Policy copy",
        "Bank details + a cancelled cheque",
      ],
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    var select = document.getElementById("checklist-policy-type");
    var generateBtn = document.getElementById("checklist-generate");
    var printBtn = document.getElementById("checklist-print");
    var panel = document.getElementById("checklist-result");
    if (!select || !generateBtn || !panel) return;

    function render() {
      var checklist = CHECKLISTS[select.value];
      if (!checklist) return;

      panel.querySelector("[data-checklist-title]").textContent = checklist.title;
      var list = panel.querySelector("[data-checklist-items]");
      list.innerHTML = "";
      checklist.items.forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });

      var whatsapp = panel.querySelector("#checklist-whatsapp");
      if (whatsapp && window.AangiWhatsApp) {
        var message =
          "Hi Aangi Associates, I'm preparing for a claim (" + checklist.title + ") and would like to confirm the exact documents needed.";
        whatsapp.href = window.AangiWhatsApp.buildWhatsAppLink(window.AangiWhatsApp.ADVISOR_PHONE, message);
      }

      panel.hidden = false;
    }

    generateBtn.addEventListener("click", render);

    if (printBtn) {
      printBtn.addEventListener("click", function () {
        document.body.classList.add("print-target-only");
        window.print();
      });
      window.addEventListener("afterprint", function () {
        document.body.classList.remove("print-target-only");
      });
    }
  });
})();
