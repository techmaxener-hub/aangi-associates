// Aangi Associates — generic interactive component behaviors (Pass 2)
// Tabs, accordions, modals, filterable grids, reveal-on-scroll.
(function () {
  function wireTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      var tabs = group.querySelectorAll(".tab");
      var panelHost = document.querySelector(group.getAttribute("data-tabs-panels") || "");

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (t) { t.setAttribute("aria-selected", "false"); });
          tab.setAttribute("aria-selected", "true");

          var key = tab.getAttribute("data-tab-key");
          if (!key) return;

          if (panelHost) {
            panelHost.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
              panel.classList.toggle("is-active", panel.getAttribute("data-tab-panel") === key);
            });
          }

          group.dispatchEvent(new CustomEvent("tabchange", { detail: { key: key } }));
        });
      });
    });
  }

  function wireFilterTabs() {
    document.querySelectorAll("[data-filter-tabs]").forEach(function (group) {
      var tabs = group.querySelectorAll(".tab");
      var itemHost = document.querySelector(group.getAttribute("data-filter-target") || "");
      if (!itemHost) return;

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (t) { t.setAttribute("aria-selected", "false"); });
          tab.setAttribute("aria-selected", "true");

          var filter = tab.getAttribute("data-filter") || "all";
          itemHost.querySelectorAll("[data-filter-item]").forEach(function (item) {
            var category = item.getAttribute("data-category");
            var show = filter === "all" || category === filter;
            item.hidden = !show;
          });
        });
      });
    });
  }

  function wireAccordions() {
    document.querySelectorAll(".accordion-trigger").forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", function () {
        var panel = trigger.nextElementSibling;
        if (!panel) return;
        var isOpen = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", String(!isOpen));
        panel.classList.toggle("is-open", !isOpen);
      });
    });
  }

  function wireModals() {
    document.querySelectorAll("[data-modal-trigger]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var modal = document.getElementById(trigger.getAttribute("data-modal-trigger"));
        if (modal && typeof modal.showModal === "function") modal.showModal();
      });
    });

    document.querySelectorAll(".modal").forEach(function (modal) {
      modal.querySelectorAll("[data-modal-close]").forEach(function (btn) {
        btn.addEventListener("click", function () { modal.close(); });
      });
      modal.addEventListener("click", function (event) {
        if (event.target === modal) modal.close();
      });
    });
  }

  function wireReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireTabs();
    wireFilterTabs();
    wireAccordions();
    wireModals();
    wireReveal();
  });
})();
