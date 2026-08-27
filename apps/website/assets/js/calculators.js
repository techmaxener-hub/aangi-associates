// Aangi Associates — calculator logic, formulas per docs/BLUEPRINT.md §03
(function () {
  function num(form, name, fallback) {
    var el = form.elements[name];
    var v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) ? v : fallback;
  }

  function formatINR(amount) {
    if (!isFinite(amount)) return "—";
    var sign = amount < 0 ? "-" : "";
    return sign + "₹" + Math.round(Math.abs(amount)).toLocaleString("en-IN");
  }

  function formatCrLakh(amount) {
    var abs = Math.abs(amount);
    var sign = amount < 0 ? "-" : "";
    if (abs >= 1e7) return sign + (abs / 1e7).toFixed(2) + " Cr";
    if (abs >= 1e5) return sign + (abs / 1e5).toFixed(2) + " L";
    return formatINR(amount);
  }

  // Calc 01 — Human Life Value / Term Insurance Need
  function calcHLV(f) {
    var currentAge = num(f, "currentAge", 35);
    var retirementAge = num(f, "retirementAge", 60);
    var annualIncome = num(f, "annualIncome", 0);
    var selfConsumption = num(f, "selfConsumption", 20);
    var incomeGrowth = num(f, "incomeGrowth", 5);
    var discountRate = num(f, "discountRate", 8);
    var liabilities = num(f, "liabilities", 0);
    var existingCover = num(f, "existingCover", 0);

    var n = Math.max(retirementAge - currentAge, 1);
    var netIncome = annualIncome * (1 - selfConsumption / 100);
    var r = (1 + discountRate / 100) / (1 + incomeGrowth / 100) - 1;
    var hlv = Math.abs(r) < 1e-9 ? netIncome * n : netIncome * (1 - Math.pow(1 + r, -n)) / r;
    var recommended = hlv + liabilities - existingCover;

    return {
      headline: "Recommended additional cover",
      value: recommended,
      lines: [
        "Human Life Value: " + formatINR(hlv) + " (" + formatCrLakh(hlv) + ")",
        "+ Outstanding liabilities: " + formatINR(liabilities),
        "− Existing life cover: " + formatINR(existingCover),
      ],
      whatsapp: "term insurance need calculator: recommended additional cover " + formatCrLakh(recommended) + " (HLV " + formatCrLakh(hlv) + ")",
    };
  }

  // Calc 02 — Child Education Planner
  function calcEducation(f) {
    var childAge = num(f, "childAge", 5);
    var ageAtGoal = num(f, "ageAtGoal", 18);
    var currentCost = num(f, "currentCost", 0);
    var inflation = num(f, "eduInflation", 9);
    var existingSavings = num(f, "existingSavings", 0);
    var returnRate = num(f, "returnRate", 12);

    var n = Math.max(ageAtGoal - childAge, 1);
    var futureCost = currentCost * Math.pow(1 + inflation / 100, n);
    var fvExisting = existingSavings * Math.pow(1 + returnRate / 100, n);
    var shortfall = Math.max(futureCost - fvExisting, 0);
    var rm = returnRate / 100 / 12;
    var nm = n * 12;
    var sip = shortfall <= 0 ? 0 : (shortfall * rm) / ((Math.pow(1 + rm, nm) - 1) * (1 + rm));

    return {
      headline: "Required monthly SIP",
      value: sip,
      lines: [
        "Future cost of course in " + n + " years: " + formatINR(futureCost) + " (" + formatCrLakh(futureCost) + ")",
        "Shortfall after existing savings: " + formatINR(shortfall) + " (" + formatCrLakh(shortfall) + ")",
      ],
      whatsapp: "child education planner: future cost " + formatCrLakh(futureCost) + ", required monthly SIP " + formatINR(sip),
    };
  }

  // Calc 03 — SIP Delay Cost
  function calcSipDelay(f) {
    var monthlySip = num(f, "monthlySip", 0);
    var returnRate = num(f, "sipReturnRate", 12);
    var horizonYears = num(f, "horizonYears", 20);
    var delayMonths = num(f, "delayMonths", 0);

    var rm = returnRate / 100 / 12;
    var nFull = horizonYears * 12;
    var nDelay = Math.max(nFull - delayMonths, 0);

    function fv(n) {
      if (n <= 0) return 0;
      return monthlySip * ((Math.pow(1 + rm, n) - 1) / rm) * (1 + rm);
    }

    var fvNoDelay = fv(nFull);
    var fvDelayed = fv(nDelay);
    var cost = fvNoDelay - fvDelayed;

    return {
      headline: "Cost of delaying",
      value: cost,
      lines: [
        "Value if you start today: " + formatINR(fvNoDelay) + " (" + formatCrLakh(fvNoDelay) + ")",
        "Value if delayed " + delayMonths + " month(s): " + formatINR(fvDelayed) + " (" + formatCrLakh(fvDelayed) + ")",
      ],
      whatsapp: "SIP delay cost calculator: delaying " + delayMonths + " month(s) costs " + formatCrLakh(cost),
    };
  }

  // Calc 04 — Retirement Corpus Estimator
  function calcRetirement(f) {
    var currentAge = num(f, "retCurrentAge", 35);
    var retirementAge = num(f, "retRetirementAge", 60);
    var lifeExpectancy = num(f, "lifeExpectancy", 85);
    var monthlyExpenses = num(f, "monthlyExpenses", 0);
    var inflation = num(f, "retInflation", 6);
    var preReturn = num(f, "preReturn", 12);
    var postReturn = num(f, "postReturn", 7);
    var existingSavings = num(f, "retExistingSavings", 0);

    var n = Math.max(retirementAge - currentAge, 1);
    var m = Math.max(lifeExpectancy - retirementAge, 1);
    var expenseAtRetirement = monthlyExpenses * 12 * Math.pow(1 + inflation / 100, n);
    var rPost = (1 + postReturn / 100) / (1 + inflation / 100) - 1;
    var requiredCorpus =
      Math.abs(rPost) < 1e-9
        ? expenseAtRetirement * m
        : expenseAtRetirement * ((1 - Math.pow(1 + rPost, -m)) / rPost) * (1 + rPost);
    var fvExisting = existingSavings * Math.pow(1 + preReturn / 100, n);
    var netCorpus = Math.max(requiredCorpus - fvExisting, 0);
    var rm = preReturn / 100 / 12;
    var nm = n * 12;
    var sip = netCorpus <= 0 ? 0 : (netCorpus * rm) / ((Math.pow(1 + rm, nm) - 1) * (1 + rm));

    return {
      headline: "Required monthly SIP",
      value: sip,
      lines: [
        "Annual expense at retirement: " + formatINR(expenseAtRetirement) + " (" + formatCrLakh(expenseAtRetirement) + ")",
        "Required retirement corpus: " + formatINR(requiredCorpus) + " (" + formatCrLakh(requiredCorpus) + ")",
        "Net corpus needed after existing savings: " + formatINR(netCorpus) + " (" + formatCrLakh(netCorpus) + ")",
      ],
      whatsapp: "retirement corpus estimator: corpus needed " + formatCrLakh(requiredCorpus) + ", required monthly SIP " + formatINR(sip),
    };
  }

  var ENGINES = { hlv: calcHLV, education: calcEducation, "sip-delay": calcSipDelay, retirement: calcRetirement };

  function renderResult(key, result) {
    var panel = document.querySelector("#calc-result");
    if (!panel) return;

    panel.querySelector("[data-result-headline]").textContent = result.headline;
    panel.querySelector("[data-result-value]").textContent = formatINR(result.value) + " (" + formatCrLakh(result.value) + ")";

    var detailHost = panel.querySelector("[data-result-details]");
    detailHost.innerHTML = "";
    result.lines.forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      detailHost.appendChild(p);
    });

    var link = panel.querySelector("[data-result-whatsapp]");
    if (link && window.AangiWhatsApp) {
      var message =
        "Hi Aangi Associates, I used the " + result.whatsapp + ". Illustrative estimate, not financial advice — could we discuss this?";
      link.href = window.AangiWhatsApp.buildWhatsAppLink(window.AangiWhatsApp.ADVISOR_PHONE, message);
    }

    panel.hidden = false;
  }

  function runCalc(key) {
    var form = document.querySelector('[data-calc-form="' + key + '"]');
    var engine = ENGINES[key];
    if (!form || !engine) return;
    renderResult(key, engine(form));
  }

  // Admin-editable defaults (Admin Settings → Calculator Defaults) live in
  // Supabase and are fetched here read-only via the public anon key — the
  // only place this static site touches a backend call, per
  // docs/BLUEPRINT.md §05E. Falls back to the hardcoded HTML defaults
  // above if the fetch fails (offline, key rotated, etc.).
  var SUPABASE_URL = "https://vdiymedmnrqmosazaaro.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkaXltZWRtbnJxbW9zYXphYXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzMxNDMsImV4cCI6MjEwMzQwOTE0M30.gkIUIKKjuxe03jM9tLgzclTb9H3-P3ulhRaWECTqAzc";

  function applyRemoteDefaults() {
    return fetch(SUPABASE_URL + "/rest/v1/calculator_config?select=*", {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) {
        var cfg = rows && rows[0];
        if (!cfg) return;

        var fieldMap = {
          "hlv-selfConsumption": cfg.self_consumption_pct,
          "hlv-incomeGrowth": cfg.income_growth_pct,
          "hlv-discountRate": cfg.discount_rate_pct,
          "hlv-retirementAge": cfg.default_retirement_age,
          "edu-eduInflation": cfg.edu_inflation_pct,
          "edu-returnRate": cfg.edu_return_pct,
          "sip-returnRate": cfg.sip_return_pct,
          "ret-retirementAge": cfg.default_retirement_age,
          "ret-lifeExpectancy": cfg.default_life_expectancy,
          "ret-inflation": cfg.retirement_inflation_pct,
          "ret-preReturn": cfg.pre_retirement_return_pct,
          "ret-postReturn": cfg.post_retirement_return_pct,
        };

        Object.keys(fieldMap).forEach(function (id) {
          var el = document.getElementById(id);
          var value = fieldMap[id];
          if (el && value !== undefined && value !== null) el.value = value;
        });
      })
      .catch(function (err) {
        console.warn("[calculators] using built-in defaults — could not fetch calculator_config:", err);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tabGroup = document.querySelector("[data-tabs='calculators']");
    if (!tabGroup) return;

    Object.keys(ENGINES).forEach(function (key) {
      var form = document.querySelector('[data-calc-form="' + key + '"]');
      if (!form) return;
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        runCalc(key);
      });
    });

    tabGroup.addEventListener("tabchange", function (event) {
      runCalc(event.detail.key);
    });

    applyRemoteDefaults().then(function () {
      // Run the default (first) calculator once defaults are applied.
      var activeTab = tabGroup.querySelector('.tab[aria-selected="true"]');
      if (activeTab) runCalc(activeTab.getAttribute("data-tab-key"));
    });
  });
})();
