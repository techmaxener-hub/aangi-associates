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

      // Deep-link support: /calculators.html#sip-calc (etc.) pre-selects
      // that tool on load — used by the header's Calculators dropdown,
      // which links straight to a specific tool rather than just the
      // page.
      var hashKey = window.location.hash ? window.location.hash.slice(1) : "";
      if (hashKey) {
        var target = Array.prototype.filter.call(tabs, function (t) {
          return t.getAttribute("data-tab-key") === hashKey;
        })[0];
        if (target) target.click();
      }
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

  function wireTrophyLightbox() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".trophy-item"));
    var lightbox = document.getElementById("trophy-lightbox");
    if (!items.length || !lightbox) return;

    var imgEl = document.getElementById("trophy-lightbox-img");
    var titleEl = document.getElementById("trophy-lightbox-title");
    var subEl = document.getElementById("trophy-lightbox-sub");
    var closeBtn = lightbox.querySelector(".trophy-lightbox-close");
    var prevBtn = lightbox.querySelector(".trophy-lightbox-prev");
    var nextBtn = lightbox.querySelector(".trophy-lightbox-next");
    var currentIndex = 0;

    function show(index) {
      currentIndex = (index + items.length) % items.length;
      var item = items[currentIndex];
      var itemImg = item.querySelector("img");
      // data-full = the full-size (1200px) WebP; the card itself loads a
      // small, pre-sharpened variant via <picture>/srcset, so falling back
      // to itemImg.src (the 1200px JPEG) keeps the lightbox full-res too.
      imgEl.src = itemImg.getAttribute("data-full") || itemImg.src;
      imgEl.alt = itemImg.alt;
      titleEl.textContent = item.getAttribute("data-title") || "";
      subEl.textContent = item.getAttribute("data-sub") || "";
    }

    function open(index) {
      show(index);
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
    }

    function close() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
    }

    items.forEach(function (item, index) {
      item.addEventListener("click", function () { open(index); });
    });
    var viewAll = document.querySelector("[data-trophy-view-all]");
    if (viewAll) viewAll.addEventListener("click", function () { open(0); });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { show(currentIndex - 1); });
    nextBtn.addEventListener("click", function () { show(currentIndex + 1); });
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", function (event) {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") show(currentIndex - 1);
      if (event.key === "ArrowRight") show(currentIndex + 1);
    });
  }

  function wireScrollProgress() {
    var bar = document.querySelector("[data-scroll-progress]");
    if (!bar) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) bar.style.transition = "none";

    function update() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      bar.style.width = pct + "%";
    }

    document.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // About Jainik — subtle parallax (idea #5): the standee drifts a few px
  // slower than the page as the section scrolls past, via a CSS custom
  // property (see .about-intro-photo.is-visible in main.css) rather than
  // a direct transform, so the reveal-in animation's own transform isn't
  // fought over by two different owners of the same property.
  function wireAboutParallax() {
    var photo = document.getElementById("about-intro-photo");
    if (!photo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var ticking = false;
    function update() {
      ticking = false;
      var rect = photo.getBoundingClientRect();
      var viewportMid = window.innerHeight / 2;
      var elementMid = rect.top + rect.height / 2;
      // Distance from viewport center, clamped, scaled down to a gentle
      // few-px drift rather than a 1:1 scroll-linked move.
      var offset = Math.max(-1, Math.min(1, (viewportMid - elementMid) / window.innerHeight)) * 22;
      photo.style.setProperty("--about-parallax-y", offset.toFixed(1) + "px");
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // Jainik's video frames: only one plays at a time.
  function wireVideoFrames() {
    var videos = Array.prototype.slice.call(document.querySelectorAll(".video-frame video"));
    videos.forEach(function (v) {
      v.addEventListener("play", function () {
        videos.forEach(function (other) { if (other !== v && !other.paused) other.pause(); });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireVideoFrames();
    wireTabs();
    wireFilterTabs();
    wireAccordions();
    wireModals();
    wireReveal();
    wireTrophyLightbox();
    wireScrollProgress();
    wireAboutParallax();
  });
})();
