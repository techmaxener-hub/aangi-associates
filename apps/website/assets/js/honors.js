// Aangi Associates — Honors & Accolades: filter tabs, paginated grid,
// lightbox with prev/next + keyboard nav. Reads from RECOGNITION_ITEMS
// (honors-data.js, loaded first). Self-contained — doesn't touch the
// existing trophy-rail/trophy-lightbox, a separate component higher up
// this same page.
(function () {
  var PAGE_SIZE = 12;

  var CATEGORY_LABELS = {
    awards: "Awards & Honors",
    international: "International Tour",
    domestic: "Domestic Delegation",
  };

  function init() {
    var grid = document.getElementById("honors-grid");
    if (!grid || typeof RECOGNITION_ITEMS === "undefined") return;

    var tabs = document.querySelectorAll(".honors-tab");
    var loadMoreBtn = document.getElementById("honors-load-more");
    var countEl = document.getElementById("honors-count");
    var lightbox = document.getElementById("honors-lightbox");
    var lightboxImg = document.getElementById("honors-lightbox-img");
    var lightboxTitle = document.getElementById("honors-lightbox-title");
    var lightboxMeta = document.getElementById("honors-lightbox-meta");
    var lightboxCaption = document.getElementById("honors-lightbox-caption");

    var activeFilter = "all";
    var visibleCount = PAGE_SIZE;
    var filteredItems = RECOGNITION_ITEMS.slice();
    var lightboxIndex = -1;

    function applyFilter() {
      filteredItems =
        activeFilter === "all"
          ? RECOGNITION_ITEMS.slice()
          : RECOGNITION_ITEMS.filter(function (item) { return item.category === activeFilter; });
      visibleCount = PAGE_SIZE;
      render();
    }

    function metaLine(item) {
      var parts = [CATEGORY_LABELS[item.category] || item.category];
      if (item.year) parts.push(item.year);
      if (item.location) parts.push(item.location);
      return parts.join(" · ");
    }

    function render() {
      grid.innerHTML = "";
      var shown = filteredItems.slice(0, visibleCount);
      shown.forEach(function (item, i) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "honors-card reveal is-visible";
        card.setAttribute("data-honors-index", String(i));
        card.innerHTML =
          '<span class="honors-card-media">' +
          '<img src="' + item.thumbnailSrc + '" alt="' + item.title.replace(/"/g, "&quot;") + '" loading="lazy" decoding="async">' +
          '<span class="honors-card-overlay">' +
          '<strong>' + item.title + '</strong>' +
          '<span class="honors-card-meta">' + metaLine(item) + '</span>' +
          '</span>' +
          '</span>';
        card.addEventListener("click", function () { openLightbox(i); });
        grid.appendChild(card);
      });

      var remaining = filteredItems.length - shown.length;
      loadMoreBtn.hidden = remaining <= 0;
      countEl.textContent = filteredItems.length
        ? "Showing " + shown.length + " of " + filteredItems.length
        : "No items in this category yet.";
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        activeFilter = tab.getAttribute("data-honors-filter");
        applyFilter();
      });
    });

    loadMoreBtn.addEventListener("click", function () {
      visibleCount += PAGE_SIZE;
      render();
    });

    function openLightbox(i) {
      lightboxIndex = i;
      updateLightbox();
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
      lightboxIndex = -1;
    }

    function updateLightbox() {
      var item = filteredItems[lightboxIndex];
      if (!item) return;
      lightboxImg.src = item.imageSrc;
      lightboxImg.alt = item.title;
      lightboxTitle.textContent = item.title;
      lightboxMeta.textContent = metaLine(item);
      lightboxCaption.textContent = item.caption || "";
    }

    function step(delta) {
      if (lightboxIndex < 0 || !filteredItems.length) return;
      lightboxIndex = (lightboxIndex + delta + filteredItems.length) % filteredItems.length;
      updateLightbox();
    }

    lightbox.querySelector(".honors-lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".honors-lightbox-prev").addEventListener("click", function () { step(-1); });
    lightbox.querySelector(".honors-lightbox-next").addEventListener("click", function () { step(1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
