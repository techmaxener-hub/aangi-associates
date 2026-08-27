// Aangi Associates — form-to-WhatsApp prefill logic (Pass 2)
// Every lead-capture form on the site formats its fields into a pre-filled
// wa.me link instead of posting to a backend (v1 lead capture, per CLAUDE.md).
(function () {
  var ADVISOR_PHONE = "919033132791";

  function buildWhatsAppLink(phone, message) {
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  }

  function fieldValue(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    return (el.value || "").trim();
  }

  function wireForm(form, opts) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = form.querySelector("[data-form-status]");
      var submitBtn = form.querySelector('button[type="submit"]');

      var missing = (opts.required || []).filter(function (name) {
        return !fieldValue(form, name);
      });

      if (missing.length) {
        if (status) {
          status.textContent = "Please fill in all required fields before continuing on WhatsApp.";
          status.classList.add("is-error");
          status.classList.remove("is-success");
        }
        return;
      }

      // Guard against a double-click opening two WhatsApp tabs — this is a
      // synchronous, client-only action (no server round-trip), so a short
      // re-enable delay is enough rather than a real async "saving" state.
      if (submitBtn) submitBtn.disabled = true;

      var message = opts.buildMessage(function (name) { return fieldValue(form, name); });
      var link = buildWhatsAppLink(opts.phone || ADVISOR_PHONE, message);

      if (status) {
        status.textContent = "Opening WhatsApp with your details filled in…";
        status.classList.add("is-success");
        status.classList.remove("is-error");
      }

      window.open(link, "_blank", "noopener");

      if (submitBtn) {
        window.setTimeout(function () {
          submitBtn.disabled = false;
        }, 1500);
      }
    });
  }

  window.AangiWhatsApp = { buildWhatsAppLink: buildWhatsAppLink, wireForm: wireForm, ADVISOR_PHONE: ADVISOR_PHONE };

  document.addEventListener("DOMContentLoaded", function () {
    var contactForm = document.querySelector("#contact-form");
    if (contactForm) {
      wireForm(contactForm, {
        required: ["name", "phone", "interest"],
        buildMessage: function (get) {
          return [
            "Hi Aangi Associates, I'd like to get in touch.",
            "Name: " + get("name"),
            "Phone: " + get("phone"),
            "Interested In: " + get("interest"),
            get("message") ? "Message: " + get("message") : null,
          ].filter(Boolean).join("\n");
        },
      });
    }

    var applyForm = document.querySelector("#apply-form");
    if (applyForm) {
      wireForm(applyForm, {
        required: ["name", "phone", "city", "occupation"],
        buildMessage: function (get) {
          return [
            "Hi Aangi Associates, I'd like to apply to the CBA Mentorship Wing.",
            "Name: " + get("name"),
            "Phone: " + get("phone"),
            "City: " + get("city"),
            "Current Occupation: " + get("occupation"),
          ].join("\n");
        },
      });
    }
  });
})();
