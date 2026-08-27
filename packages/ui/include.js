// Aangi Associates — shared header/footer include loader (packages/ui)
// Fetches partials/header.html and partials/footer.html into [data-include] hosts.
// Needs a static server (not file://) for fetch() to resolve — e.g. `npx serve apps/website`.
(function () {
  function setActiveNav() {
    var page = document.body.getAttribute("data-page");
    if (!page) return;
    var link = document.querySelector('[data-nav="' + page + '"]');
    if (link) link.setAttribute("aria-current", "page");
  }

  function setYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = new Date().getFullYear();
  }

  function wireHeaderInteractions() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    if (!header) return;

    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle) {
      toggle.addEventListener("click", function () {
        var isOpen = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });
    }
  }

  function loadPartial(host) {
    var name = host.getAttribute("data-include");
    var base = host.getAttribute("data-include-base") || ".";

    fetch(base + "/" + name + ".html")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (html) {
        host.outerHTML = html;
        if (name === "header") {
          setActiveNav();
          wireHeaderInteractions();
        }
        if (name === "footer") setYear();
      })
      .catch(function (err) {
        console.error("[include] failed to load partial:", name, err);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-include]").forEach(loadPartial);
  });
})();
