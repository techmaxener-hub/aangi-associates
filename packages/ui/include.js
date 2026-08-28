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
    wireLangSwitcher();
  }

  // Drafted translations for the hero and key CTAs only (per the scoped
  // roadmap item) -- worth a native Hindi/Gujarati speaker's review before
  // launch, since tone matters more than literal accuracy here.
  var TRANSLATIONS = {
    hi: {
      hero_h1: "जो मायने रखता है उसकी सुरक्षा। जो आप बनाते हैं उसे सुरक्षित करना।",
      hero_subhead: "जैनिक शाह · 17+ वर्षों का सलाहकार अनुभव",
      hero_body:
        "1,400+ ग्राहक परिवारों के लिए वित्तीय सुरक्षा, स्थिरता और दीर्घकालिक विकास के प्रति प्रतिबद्ध — अहमदाबाद भर में एक परेशानी-मुक्त दावा सहायता रिकॉर्ड और MDRT-मान्यता प्राप्त सलाहकार अभ्यास द्वारा समर्थित।",
      cta_talk: "सलाहकार से बात करें →",
      cta_explore: "समाधान देखें",
      cta_talk_header: "सलाहकार से बात करें",
      cta_associate: "एसोसिएट बनें",
    },
    gu: {
      hero_h1: "જે મહત્વનું છે તેનું રક્ષણ. તમે જે બનાવો છો તેને સુરક્ષિત કરવું.",
      hero_subhead: "જૈનિક શાહ · 17+ વર્ષનો સલાહકાર અનુભવ",
      hero_body:
        "1,400+ ક્લાયન્ટ પરિવારો માટે નાણાકીય સુરક્ષા, સ્થિરતા અને લાંબા ગાળાની વૃદ્ધિ માટે પ્રતિબદ્ધ — અમદાવાદભરમાં મુશ્કેલી-મુક્ત ક્લેમ સહાય રેકોર્ડ અને MDRT-માન્યતા પ્રાપ્ત સલાહકાર પ્રેક્ટિસ દ્વારા સમર્થિત.",
      cta_talk: "સલાહકાર સાથે વાત કરો →",
      cta_explore: "ઉકેલો જુઓ",
      cta_talk_header: "સલાહકાર સાથે વાત કરો",
      cta_associate: "એસોસિયેટ બનો",
    },
  };

  function langStorageKey() {
    return "aangi-lang";
  }

  function applyLanguage(lang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      if (!el.dataset.i18nEn) el.dataset.i18nEn = el.textContent;
      var key = el.getAttribute("data-i18n");
      var dict = TRANSLATIONS[lang];
      el.textContent = dict && dict[key] ? dict[key] : el.dataset.i18nEn;
    });
  }

  function wireLangSwitcher() {
    var switcher = document.querySelector(".lang-switcher");
    if (!switcher) return;

    var stored;
    try {
      stored = localStorage.getItem(langStorageKey());
    } catch (e) {}
    var current = stored === "hi" || stored === "gu" ? stored : "en";

    function render() {
      switcher.querySelectorAll("[data-lang]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === current));
      });
      applyLanguage(current);
    }

    render();
    switcher.querySelectorAll("[data-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        current = btn.getAttribute("data-lang");
        try {
          localStorage.setItem(langStorageKey(), current);
        } catch (e) {}
        render();
      });
    });
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
