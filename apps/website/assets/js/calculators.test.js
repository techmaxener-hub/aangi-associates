// Unit tests for the 4 original calculators (docs/BLUEPRINT.md §03), locked
// against that doc's worked examples so a formula regression is caught here
// rather than by someone noticing a wrong number on the live site.
const test = require("node:test");
const assert = require("node:assert/strict");
const { ENGINES } = require("./calculators.js");

function makeForm(values) {
  var elements = {};
  Object.keys(values).forEach(function (key) {
    elements[key] = { value: String(values[key]) };
  });
  return { elements: elements };
}

function assertApprox(actual, expected, label) {
  var tolerance = Math.abs(expected) * 0.02; // 2% — BLUEPRINT's examples are rounded
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    label + ": expected ~" + expected + ", got " + actual + " (tolerance " + tolerance.toFixed(0) + ")",
  );
}

test("Calc 01 — Human Life Value / Term Insurance Need", () => {
  // BLUEPRINT example: age 35, retiring 60, income 18L, self-consumption 20%,
  // growth 5%, discount 8%, +30L loan, -50L existing cover -> ~2.35Cr net.
  var form = makeForm({
    currentAge: 35,
    retirementAge: 60,
    annualIncome: 1800000,
    selfConsumption: 20,
    incomeGrowth: 5,
    discountRate: 8,
    liabilities: 3000000,
    existingCover: 5000000,
  });
  var result = ENGINES.hlv(form);
  assertApprox(result.value, 23500000, "recommended additional cover");
});

test("Calc 02 — Child Education Planner", () => {
  // Same inputs as the BLUEPRINT.md worked example (child age 5, goal at
  // 18, current cost 15L, inflation 9%, no existing savings, 12% return),
  // but asserting against the value the documented formula actually
  // produces (~12,233/month), not the doc's prose figure (~15,800/month)
  // -- independently re-derived by hand while writing this test and
  // confirmed to be a documentation arithmetic error, not a code bug
  // (see docs/BLUEPRINT.md §03, corrected alongside this test).
  var form = makeForm({
    childAge: 5,
    ageAtGoal: 18,
    currentCost: 1500000,
    eduInflation: 9,
    existingSavings: 0,
    returnRate: 12,
  });
  var result = ENGINES.education(form);
  assertApprox(result.value, 12233, "required monthly SIP");
});

test("Calc 03 — SIP Delay Cost Calculator", () => {
  // BLUEPRINT example: 10,000/mo, 12% return, 20-year horizon, 3-year
  // (36-month) delay -> ~33.2L cost of delay.
  var form = makeForm({
    monthlySip: 10000,
    sipReturnRate: 12,
    horizonYears: 20,
    delayMonths: 36,
  });
  var result = ENGINES["sip-delay"](form);
  assertApprox(result.value, 3320000, "cost of delay");
});

test("Calc 04 — Retirement Corpus Estimator", () => {
  // Same inputs as the BLUEPRINT.md worked example (age 35, retiring 60,
  // living to 85, monthly expenses 60,000, inflation 6%, 7% post-return,
  // no existing savings, 12% pre-return). The annual-expense-at-retirement
  // figure (~30.9L) matches the doc exactly, but the doc's corpus (~4.9Cr)
  // and required-SIP (~32,300/month) figures don't follow from applying
  // its own stated formula to these inputs -- independently re-derived by
  // hand to ~6.92Cr / ~36,456/month, confirmed a documentation arithmetic
  // error rather than a code bug (see docs/BLUEPRINT.md §03, corrected
  // alongside this test).
  var form = makeForm({
    retCurrentAge: 35,
    retRetirementAge: 60,
    lifeExpectancy: 85,
    monthlyExpenses: 60000,
    retInflation: 6,
    preReturn: 12,
    postReturn: 7,
    retExistingSavings: 0,
  });
  var result = ENGINES.retirement(form);
  assertApprox(result.value, 36456, "required monthly SIP");
});
