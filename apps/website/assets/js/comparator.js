// Aangi Associates — Term vs Endowment vs ULIP comparator highlight.
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var picker = document.getElementById("comparator-picker");
    var table = document.getElementById("comparator-table");
    if (!picker || !table) return;

    picker.querySelectorAll("[data-highlight]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-highlight");
        var alreadyActive = btn.getAttribute("aria-pressed") === "true";

        picker.querySelectorAll("[data-highlight]").forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        table.querySelectorAll("[data-col]").forEach(function (cell) {
          cell.classList.remove("is-highlighted");
        });

        if (!alreadyActive) {
          btn.setAttribute("aria-pressed", "true");
          table.querySelectorAll('[data-col="' + key + '"]').forEach(function (cell) {
            cell.classList.add("is-highlighted");
          });
        }
      });
    });
  });
})();
