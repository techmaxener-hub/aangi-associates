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

  // Shared "future goal" formula for Dream Wedding / Car-Bike-Property /
  // Vacation — same shape as Calc 02, but with separate return rates for
  // existing vs. new investment (matches how these goal calculators are
  // conventionally modeled).
  function calcGoal(f, label) {
    var yearsToGoal = num(f, "yearsToGoal", 5);
    var currentCost = num(f, "currentCost", 0);
    var inflation = num(f, "inflation", 6);
    var existingInvestment = num(f, "existingInvestment", 0);
    var returnExisting = num(f, "returnExisting", 10);
    var returnNew = num(f, "returnNew", 12);

    var n = Math.max(yearsToGoal, 1);
    var futureCost = currentCost * Math.pow(1 + inflation / 100, n);
    var fvExisting = existingInvestment * Math.pow(1 + returnExisting / 100, n);
    var shortfall = Math.max(futureCost - fvExisting, 0);
    var rm = returnNew / 100 / 12;
    var nm = n * 12;
    var sip = shortfall <= 0 ? 0 : (shortfall * rm) / ((Math.pow(1 + rm, nm) - 1) * (1 + rm));

    return {
      headline: "Required monthly SIP",
      value: sip,
      lines: [
        "Future cost in " + n + " year(s): " + formatINR(futureCost) + " (" + formatCrLakh(futureCost) + ")",
        "Shortfall after existing investment: " + formatINR(shortfall) + " (" + formatCrLakh(shortfall) + ")",
      ],
      whatsapp: label + ": future cost " + formatCrLakh(futureCost) + ", required monthly SIP " + formatINR(sip),
    };
  }

  // SIP future value helper — shared by several calculators below.
  function sipFutureValue(monthly, ratePct, months) {
    if (months <= 0) return 0;
    var rm = ratePct / 100 / 12;
    if (Math.abs(rm) < 1e-9) return monthly * months;
    return monthly * ((Math.pow(1 + rm, months) - 1) / rm) * (1 + rm);
  }

  // EMI helper — shared by EMI and Home Loan vs SIP.
  function emiOf(principal, ratePct, months) {
    var rm = ratePct / 100 / 12;
    if (months <= 0) return 0;
    if (Math.abs(rm) < 1e-9) return principal / months;
    return (principal * rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
  }

  // SIP Calculator
  function calcSipCalc(f) {
    var monthlyAmount = num(f, "monthlyAmount", 0);
    var years = num(f, "years", 15);
    var returnRate = num(f, "returnRate", 12);
    var months = years * 12;

    var maturity = sipFutureValue(monthlyAmount, returnRate, months);
    var invested = monthlyAmount * months;
    var gain = maturity - invested;

    return {
      headline: "Maturity value",
      value: maturity,
      lines: [
        "Total invested: " + formatINR(invested) + " (" + formatCrLakh(invested) + ")",
        "Wealth gained: " + formatINR(gain) + " (" + formatCrLakh(gain) + ")",
      ],
      whatsapp: "SIP calculator: " + formatINR(monthlyAmount) + "/month for " + years + " years grows to " + formatCrLakh(maturity),
    };
  }

  // Lumpsum Calculator
  function calcLumpsum(f) {
    var investmentAmount = num(f, "investmentAmount", 0);
    var years = num(f, "years", 10);
    var returnRate = num(f, "returnRate", 12);

    var maturity = investmentAmount * Math.pow(1 + returnRate / 100, years);
    var gain = maturity - investmentAmount;

    return {
      headline: "Maturity value",
      value: maturity,
      lines: [
        "Amount invested: " + formatINR(investmentAmount) + " (" + formatCrLakh(investmentAmount) + ")",
        "Wealth gained: " + formatINR(gain) + " (" + formatCrLakh(gain) + ")",
      ],
      whatsapp: "lumpsum calculator: " + formatCrLakh(investmentAmount) + " for " + years + " years grows to " + formatCrLakh(maturity),
    };
  }

  // SIP Top-Up (step-up SIP) — contribution rises by a fixed % every year.
  function calcSipTopup(f) {
    var monthlyAmount = num(f, "monthlyAmount", 0);
    var yearlyTopupPct = num(f, "yearlyTopupPct", 10);
    var returnRate = num(f, "returnRate", 12);
    var years = num(f, "years", 15);

    var rm = returnRate / 100 / 12;
    var balance = 0;
    var invested = 0;
    var currentMonthly = monthlyAmount;
    for (var y = 0; y < years; y++) {
      for (var m = 0; m < 12; m++) {
        balance = balance * (1 + rm) + currentMonthly;
        invested += currentMonthly;
      }
      currentMonthly = currentMonthly * (1 + yearlyTopupPct / 100);
    }
    var gain = balance - invested;

    return {
      headline: "Maturity value",
      value: balance,
      lines: [
        "Total invested (with step-ups): " + formatINR(invested) + " (" + formatCrLakh(invested) + ")",
        "Wealth gained: " + formatINR(gain) + " (" + formatCrLakh(gain) + ")",
      ],
      whatsapp: "SIP top-up calculator: starting " + formatINR(monthlyAmount) + "/month + " + yearlyTopupPct + "% yearly step-up over " + years + " years grows to " + formatCrLakh(balance),
    };
  }

  // Limited Period SIP — contribute for a limited term, then let the
  // corpus keep compounding untouched until the total horizon ends.
  function calcLimitedSip(f) {
    var monthlyAmount = num(f, "monthlyAmount", 0);
    var contributionYears = num(f, "contributionYears", 10);
    var totalYears = num(f, "totalYears", 20);
    var returnRate = num(f, "returnRate", 12);

    var nContrib = contributionYears * 12;
    var nTotal = Math.max(totalYears * 12, nContrib);
    var corpusAtContribEnd = sipFutureValue(monthlyAmount, returnRate, nContrib);
    var remainingMonths = nTotal - nContrib;
    var rm = returnRate / 100 / 12;
    var finalCorpus = corpusAtContribEnd * Math.pow(1 + rm, remainingMonths);

    return {
      headline: "Final corpus at end of horizon",
      value: finalCorpus,
      lines: [
        "Corpus when contributions stop (year " + contributionYears + "): " + formatINR(corpusAtContribEnd) + " (" + formatCrLakh(corpusAtContribEnd) + ")",
        "Grows untouched for " + (totalYears - contributionYears) + " more year(s) to: " + formatCrLakh(finalCorpus),
      ],
      whatsapp: "limited period SIP calculator: " + formatINR(monthlyAmount) + "/month for " + contributionYears + " years, held to year " + totalYears + ", grows to " + formatCrLakh(finalCorpus),
    };
  }

  // Birthday SIP — hypothetical SIP since birth month/year, to today.
  function calcBirthday(f) {
    var sipAmount = num(f, "sipAmount", 0);
    var returnRate = num(f, "returnRate", 12);
    var birthDateEl = f.elements["birthDate"];
    var birthDate = birthDateEl && birthDateEl.value ? new Date(birthDateEl.value) : null;

    var months = 1;
    if (birthDate && !isNaN(birthDate.getTime())) {
      var now = new Date();
      months = Math.max((now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth()), 1);
    }

    var maturity = sipFutureValue(sipAmount, returnRate, months);
    var invested = sipAmount * months;
    var gain = maturity - invested;
    var years = Math.floor(months / 12);

    return {
      headline: "What it would be worth today",
      value: maturity,
      lines: [
        "A SIP of " + formatINR(sipAmount) + "/month since your birth month (" + years + " years, " + (months % 12) + " months ago)",
        "Total invested: " + formatINR(invested) + " · Wealth gained: " + formatINR(gain),
      ],
      whatsapp: "birthday SIP calculator: " + formatINR(sipAmount) + "/month since birth would be worth " + formatCrLakh(maturity) + " today",
    };
  }

  // EMI Calculator
  function calcEmi(f) {
    var loanAmount = num(f, "loanAmount", 0);
    var tenureYears = num(f, "tenureYears", 20);
    var interestRate = num(f, "interestRate", 8.5);
    var months = tenureYears * 12;

    var emi = emiOf(loanAmount, interestRate, months);
    var totalPayment = emi * months;
    var totalInterest = totalPayment - loanAmount;

    return {
      headline: "Monthly EMI",
      value: emi,
      lines: [
        "Total payment over " + tenureYears + " years: " + formatINR(totalPayment) + " (" + formatCrLakh(totalPayment) + ")",
        "Total interest paid: " + formatINR(totalInterest) + " (" + formatCrLakh(totalInterest) + ")",
      ],
      whatsapp: "EMI calculator: " + formatCrLakh(loanAmount) + " loan over " + tenureYears + " years, EMI " + formatINR(emi),
    };
  }

  // Home Loan vs SIP — the loan's EMI alongside a parallel SIP over the
  // same tenure, so you can see debt cost and wealth-building side by side.
  function calcHomeLoanSip(f) {
    var loanAmount = num(f, "loanAmount", 0);
    var tenureYears = num(f, "tenureYears", 20);
    var interestRate = num(f, "interestRate", 8.5);
    var sipAmount = num(f, "sipAmount", 0);
    var sipReturnRate = num(f, "sipReturnRate", 12);
    var months = tenureYears * 12;

    var emi = emiOf(loanAmount, interestRate, months);
    var totalInterest = emi * months - loanAmount;
    var sipMaturity = sipFutureValue(sipAmount, sipReturnRate, months);

    return {
      headline: "Monthly EMI",
      value: emi,
      lines: [
        "Total interest on the loan: " + formatINR(totalInterest) + " (" + formatCrLakh(totalInterest) + ")",
        "A parallel " + formatINR(sipAmount) + "/month SIP over the same " + tenureYears + " years grows to: " + formatCrLakh(sipMaturity),
      ],
      whatsapp: "home loan vs SIP calculator: EMI " + formatINR(emi) + ", parallel SIP grows to " + formatCrLakh(sipMaturity) + " over " + tenureYears + " years",
    };
  }

  // SWP Calculator — lumpsum grows through an optional deferred period,
  // then a fixed monthly amount is withdrawn for the tenure.
  function calcSwp(f) {
    var lumpsum = num(f, "lumpsum", 0);
    var deferredYears = num(f, "deferredYears", 0);
    var withdrawal = num(f, "withdrawal", 0);
    var tenureYears = num(f, "tenureYears", 15);
    var returnRate = num(f, "returnRate", 8);

    var rm = returnRate / 100 / 12;
    var deferredMonths = deferredYears * 12;
    var fvAfterDeferred = lumpsum * Math.pow(1 + rm, deferredMonths);

    var balance = fvAfterDeferred;
    var totalWithdrawn = 0;
    var tenureMonths = tenureYears * 12;
    for (var m = 0; m < tenureMonths && balance > 0; m++) {
      balance = balance * (1 + rm);
      var draw = Math.min(withdrawal, balance);
      balance -= draw;
      totalWithdrawn += draw;
    }
    balance = Math.max(balance, 0);

    return {
      headline: "Fund value at end of tenure",
      value: balance,
      lines: [
        "Fund value after the " + deferredYears + "-year deferred period: " + formatINR(fvAfterDeferred) + " (" + formatCrLakh(fvAfterDeferred) + ")",
        "Total withdrawn through SWP: " + formatINR(totalWithdrawn) + " (" + formatCrLakh(totalWithdrawn) + ")",
      ],
      whatsapp: "SWP calculator: " + formatCrLakh(lumpsum) + " lumpsum, " + formatINR(withdrawal) + "/month for " + tenureYears + " years, fund value at the end " + formatCrLakh(balance),
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

  // Protection Gap Score — 10 questions, 0-2 points each. Each radio
  // group's checked value is read the same way as any other field: a
  // RadioNodeList's .value is the checked option's value, per the DOM spec.
  function calcGapScore(f) {
    var keys = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];
    var total = 0;
    keys.forEach(function (k) {
      total += num(f, k, 0);
    });
    var max = keys.length * 2;

    var band, guidance;
    if (total <= max * 0.4) {
      band = "Significant Protection Gap";
      guidance =
        "There's real exposure here — a term plan, health cover, or both would meaningfully change your family's risk today.";
    } else if (total <= max * 0.7) {
      band = "Partial Coverage — Room to Strengthen";
      guidance = "You've made a start. A focused review would show exactly where the gaps are before they matter.";
    } else {
      band = "Well Protected";
      guidance = "You're in a strong position. A periodic review keeps it that way as your income and family needs change.";
    }

    return {
      headline: band,
      value: total,
      displayValue: total + " / " + max,
      lines: [guidance],
      whatsapp: "Protection Gap Score quiz: scored " + total + "/" + max + " (" + band + ")",
    };
  }

  var ENGINES = {
    hlv: calcHLV,
    education: calcEducation,
    wedding: function (f) { return calcGoal(f, "dream wedding planner"); },
    car: function (f) { return calcGoal(f, "dream car/bike/property planner"); },
    vacation: function (f) { return calcGoal(f, "dream vacation planner"); },
    retirement: calcRetirement,
    "sip-calc": calcSipCalc,
    lumpsum: calcLumpsum,
    "sip-delay": calcSipDelay,
    "sip-topup": calcSipTopup,
    "limited-sip": calcLimitedSip,
    birthday: calcBirthday,
    emi: calcEmi,
    "home-loan-sip": calcHomeLoanSip,
    swp: calcSwp,
    "gap-score": calcGapScore,
  };

  function renderResult(key, result) {
    var panel = document.querySelector("#calc-result");
    if (!panel) return;

    panel.querySelector("[data-result-headline]").textContent = result.headline;
    panel.querySelector("[data-result-value]").textContent =
      result.displayValue || formatINR(result.value) + " (" + formatCrLakh(result.value) + ")";

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

    var wasHidden = panel.hidden;
    panel.hidden = false;
    if (wasHidden) {
      panel.classList.remove("is-entering");
      // Force reflow so re-adding the class restarts the animation even
      // when re-triggered before the previous run finished.
      void panel.offsetWidth;
      panel.classList.add("is-entering");
    }
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

  // Guarded so this file can be `require()`d under Node (no `document`) for
  // the unit tests below, without changing anything about browser behavior.
  if (typeof document !== "undefined") {
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

      var printBtn = document.querySelector("#result-print");
      if (printBtn) {
        printBtn.addEventListener("click", function () {
          document.body.classList.add("print-target-only");
          window.print();
        });
        window.addEventListener("afterprint", function () {
          document.body.classList.remove("print-target-only");
        });
      }

      applyRemoteDefaults().then(function () {
        // Run the default (first) calculator once defaults are applied.
        var activeTab = tabGroup.querySelector('.tab[aria-selected="true"]');
        if (activeTab) runCalc(activeTab.getAttribute("data-tab-key"));
      });
    });
  }

  // Test-only export — never runs in the browser (module is undefined there).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ENGINES: ENGINES, formatINR: formatINR, formatCrLakh: formatCrLakh };
  }
})();
