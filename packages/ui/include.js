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

    wireThemeToggle();
  }

  // Lives here (not a standalone script) because the button is inside
  // header.html, which loads asynchronously after DOMContentLoaded — a
  // separate script's own DOMContentLoaded listener would run before the
  // button exists in the DOM and silently find nothing.
  function themeStorageKey() {
    return "aangi-theme";
  }

  function effectiveTheme() {
    var stored;
    try {
      stored = localStorage.getItem(themeStorageKey());
    } catch (e) {}
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function wireThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    function render() {
      var isDark = effectiveTheme() === "dark";
      btn.textContent = isDark ? "☀" : "🌙";
      btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    render();
    btn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(themeStorageKey(), next);
      } catch (e) {}
      render();
    });
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

  // Registered from the website pages only — apps/crm never loads this
  // file, so the CRM SPA is never a client of this service worker.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.warn("[sw] registration failed:", err);
      });
    });
  }
})();
