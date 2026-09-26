// "What do you need?" — 2-tap self-qualifier. Step 1 picks a goal, step 2
// picks urgency, then both answers get folded into a single pre-filled
// wa.me message and opened in a new tab. No form state persists beyond
// this — reload just resets it, which is fine for a one-shot router.
(function () {
  function init() {
    var step1 = document.getElementById("need-finder-step-1");
    var step2 = document.getElementById("need-finder-step-2");
    var backBtn = document.getElementById("need-finder-back");
    if (!step1 || !step2) return;

    var goal = "";

    step1.querySelectorAll(".need-finder-opt[data-goal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goal = btn.getAttribute("data-goal");
        step1.hidden = true;
        step2.hidden = false;
      });
    });

    step2.querySelectorAll(".need-finder-opt[data-when]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var when = btn.getAttribute("data-when");
        var message =
          "Hi Jainik, I'd like to " + goal + ". I'm looking to start " + when + " — could you help me understand my options?";
        var url = "https://wa.me/919033132791?text=" + encodeURIComponent(message);
        window.open(url, "_blank", "noopener");
      });
    });

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        step2.hidden = true;
        step1.hidden = false;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
