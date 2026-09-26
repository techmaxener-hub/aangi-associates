import { useEffect, useState, type FormEvent } from "react";
import {
  Target,
  Plus,
  Mail,
  Download,
  FileSpreadsheet,
  Trash2,
  Pencil,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  BarChart3,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { formatINR } from "../../lib/format";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import type { TaskAssignee } from "../tasks/types";
import {
  PERIOD_TYPE_LABEL,
  computePeriodDates,
  planTotals,
  type BusinessPlan,
  type ConsolidatedReport,
  type PeriodType,
  type ProductCategory,
} from "./types";
import { PacingBadge, PlanOverallProgress, PlanTargetsBreakdown, ComparisonBarChart } from "./components";
import { exportPlanPdf, exportConsolidatedPdf } from "./exportPlanPdf";
import { exportPlanExcel, exportConsolidatedExcel } from "./exportPlanExcel";

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface TargetForm {
  category_id: string;
  category_name: string;
  expected_premium: string;
  expected_policy_count: string;
  commission_type: "percent" | "flat_per_policy";
  commission_value: string;
}

function blankTargetForm(cat: ProductCategory): TargetForm {
  return {
    category_id: cat.id,
    category_name: cat.name,
    expected_premium: "",
    expected_policy_count: "",
    commission_type: "percent",
    commission_value: "",
  };
}

export function BusinessPlanningPage({ navItems }: { navItems: NavItem[] }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [associates, setAssociates] = useState<TaskAssignee[]>([]);
  const [filterAssociateId, setFilterAssociateId] = useState("");
  const [tab, setTab] = useState<"plans" | "consolidated">("plans");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [associateId, setAssociateId] = useState("");
  const [dateDay, setDateDay] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [yearValue, setYearValue] = useState(new Date().getFullYear());
  const [quarterValue, setQuarterValue] = useState<1 | 2 | 3 | 4>(1);
  const [notes, setNotes] = useState("");
  const [targetForms, setTargetForms] = useState<TargetForm[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  // Bulk-create: apply the same period + targets to several associates at
  // once (e.g. every associate's standard monthly quota) instead of
  // re-entering identical numbers one plan at a time. New plans only —
  // editing always targets exactly the one plan being edited.
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkAssociateIds, setBulkAssociateIds] = useState<string[]>([]);

  const [consolidatedMonth, setConsolidatedMonth] = useState(currentMonthValue());
  const [consolidated, setConsolidated] = useState<ConsolidatedReport | null>(null);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [cats, users, planList] = await Promise.all([
        api.get<ProductCategory[]>("/product_categories.php"),
        api.get<TaskAssignee[]>("/users.php"),
        api.get<BusinessPlan[]>(`/business_plans.php${filterAssociateId ? `?associate_id=${filterAssociateId}` : ""}`),
      ]);
      setCategories(cats ?? []);
      setAssociates((users ?? []).filter((u) => u.role === "associate"));
      setPlans(planList ?? []);
    } catch (err) {
      showToast(`Failed to load business plans: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAssociateId]);

  async function loadConsolidated() {
    setConsolidatedLoading(true);
    const { start_date, end_date } = computePeriodDates("month", { month: consolidatedMonth })!;
    try {
      const report = await api.get<ConsolidatedReport>(
        `/business_plans.php?consolidated=1&start_date=${start_date}&end_date=${end_date}`,
      );
      setConsolidated(report);
    } catch (err) {
      showToast(
        `Failed to load consolidated report: ${err instanceof ApiError ? err.message : "unknown error"}`,
        "error",
      );
    }
    setConsolidatedLoading(false);
  }

  useEffect(() => {
    if (tab === "consolidated") void loadConsolidated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, consolidatedMonth]);

  function resetForm() {
    setEditingId(null);
    setAssociateId("");
    setPeriodType("month");
    setDateDay("");
    setRangeStart("");
    setRangeEnd("");
    setMonthValue(currentMonthValue());
    setYearValue(new Date().getFullYear());
    setQuarterValue(1);
    setNotes("");
    setTargetForms(categories.map(blankTargetForm));
    setBulkMode(false);
    setBulkAssociateIds([]);
  }

  function openNewForm() {
    resetForm();
    setTargetForms(categories.map(blankTargetForm));
    setFormOpen(true);
  }

  function toggleBulkAssociate(id: string) {
    setBulkAssociateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openEditForm(plan: BusinessPlan) {
    setEditingId(plan.id);
    setAssociateId(plan.associate_id);
    setPeriodType(plan.period_type);
    setDateDay(plan.period_type === "day" ? plan.start_date : "");
    setRangeStart(plan.period_type === "range" ? plan.start_date : "");
    setRangeEnd(plan.period_type === "range" ? plan.end_date : "");
    setMonthValue(plan.period_type === "month" ? plan.start_date.slice(0, 7) : currentMonthValue());
    setYearValue(new Date(plan.start_date).getFullYear());
    setQuarterValue((Math.floor(new Date(plan.start_date).getMonth() / 3) + 1) as 1 | 2 | 3 | 4);
    setNotes(plan.notes ?? "");
    setTargetForms(
      categories.map((cat) => {
        const existing = plan.targets.find((t) => t.category_id === cat.id);
        return existing
          ? {
              category_id: cat.id,
              category_name: cat.name,
              expected_premium: existing.expected_premium !== null ? String(existing.expected_premium) : "",
              expected_policy_count:
                existing.expected_policy_count !== null ? String(existing.expected_policy_count) : "",
              commission_type: existing.commission_type,
              commission_value: String(existing.commission_value),
            }
          : blankTargetForm(cat);
      }),
    );
    setFormOpen(true);
  }

  function copyToNewPlan(plan: BusinessPlan) {
    openEditForm(plan);
    setEditingId(null); // same targets, but saves as a new plan
    showToast("Copied — adjust the period and numbers, then save as a new plan.");
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const { id } = await api.post<{ id: string }>("/product_categories.php", {
        name,
        sort_order: categories.length + 1,
      });
      const cat: ProductCategory = { id, name, sort_order: categories.length + 1, is_active: 1 };
      setCategories((prev) => [...prev, cat]);
      setTargetForms((prev) => [...prev, blankTargetForm(cat)]);
      setNewCategoryName("");
    } catch (err) {
      showToast(`Failed to add category: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const targetAssociates = bulkMode && !editingId ? bulkAssociateIds : associateId ? [associateId] : [];
    if (targetAssociates.length === 0) {
      showToast(bulkMode ? "Select at least one associate." : "Pick an associate.", "error");
      return;
    }
    const period = computePeriodDates(periodType, {
      date: dateDay,
      rangeStart,
      rangeEnd,
      month: monthValue,
      year: yearValue,
      quarter: quarterValue,
    });
    if (!period) {
      showToast("Fill in the period fields.", "error");
      return;
    }
    const targets = targetForms
      .filter((t) => t.expected_premium.trim() !== "" || t.expected_policy_count.trim() !== "")
      .map((t) => ({
        category_id: t.category_id,
        expected_premium: t.expected_premium.trim() === "" ? null : Number(t.expected_premium),
        expected_policy_count: t.expected_policy_count.trim() === "" ? null : Number(t.expected_policy_count),
        commission_type: t.commission_type,
        commission_value: t.commission_value.trim() === "" ? 0 : Number(t.commission_value),
      }));
    if (!targets.length) {
      showToast("Set an expected achievement for at least one category.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const body = {
          associate_id: targetAssociates[0],
          period_type: periodType,
          ...period,
          notes: notes || null,
          targets,
        };
        await api.put(`/business_plans.php?id=${editingId}`, body);
        showToast("Plan updated.");
      } else {
        // Sequential, not Promise.all — this shares hosting with a small
        // number of concurrent PHP-FPM workers, and a burst of simultaneous
        // writes is more likely to trip than a short queue of them.
        let failures = 0;
        for (const aid of targetAssociates) {
          try {
            await api.post("/business_plans.php", {
              associate_id: aid,
              period_type: periodType,
              ...period,
              notes: notes || null,
              targets,
            });
          } catch {
            failures++;
          }
        }
        const ok = targetAssociates.length - failures;
        showToast(
          targetAssociates.length === 1
            ? "Plan created."
            : failures === 0
              ? `${ok} plans created.`
              : `${ok} of ${targetAssociates.length} plans created — ${failures} failed.`,
          failures > 0 ? "error" : undefined,
        );
      }
      setFormOpen(false);
      void loadAll();
    } catch (err) {
      showToast(`Failed to save plan: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setSaving(false);
  }

  async function deletePlan(plan: BusinessPlan) {
    setBusyId(plan.id);
    try {
      await api.del(`/business_plans.php?id=${plan.id}`);
      showToast("Plan deleted.");
      void loadAll();
    } catch (err) {
      showToast(`Failed to delete: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setBusyId(null);
  }

  async function sendEmail(plan: BusinessPlan) {
    setBusyId(plan.id);
    try {
      await api.post("/business_plan_send.php", { plan_id: plan.id });
      showToast(`Emailed to ${plan.associate_name}.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to send email.", "error");
    }
    setBusyId(null);
  }

  const filteredPlans = plans;

  return (
    <PortalLayout title="Business Planning" navItems={navItems}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("plans")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === "plans" ? "bg-navy text-on-navy" : "border border-line-strong text-text-soft"}`}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setTab("consolidated")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tab === "consolidated" ? "bg-navy text-on-navy" : "border border-line-strong text-text-soft"}`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Consolidated
          </button>
        </div>
        {tab === "plans" && (
          <div className="flex items-center gap-2">
            <Select
              value={filterAssociateId}
              onChange={(e) => setFilterAssociateId(e.target.value)}
              className="h-9 w-56"
            >
              <option value="">All Associates</option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={openNewForm}>
              <Plus className="h-3.5 w-3.5" /> New Plan
            </Button>
          </div>
        )}
      </div>

      {formOpen && (
        <Card className="mb-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-text">{editingId ? "Edit Plan" : "New Business Plan"}</h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-xs text-text-soft hover:underline"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label>{bulkMode ? "Associates" : "Associate"}</Label>
                  {!editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkMode((v) => !v);
                        setBulkAssociateIds([]);
                        setAssociateId("");
                      }}
                      className="text-xs text-gold-text hover:underline"
                    >
                      {bulkMode ? "Use a single associate" : "Apply to multiple associates"}
                    </button>
                  )}
                </div>
                {bulkMode ? (
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-line-strong p-2">
                    {associates.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm text-text">
                        <input
                          type="checkbox"
                          checked={bulkAssociateIds.includes(a.id)}
                          onChange={() => toggleBulkAssociate(a.id)}
                        />
                        {a.full_name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Select value={associateId} onChange={(e) => setAssociateId(e.target.value)} required>
                    <option value="">Select associate…</option>
                    {associates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Period Type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PERIOD_TYPE_LABEL) as PeriodType[]).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPeriodType(pt)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${periodType === pt ? "bg-crimson text-on-navy" : "border border-line-strong text-text-soft"}`}
                    >
                      {PERIOD_TYPE_LABEL[pt]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {periodType === "day" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Date</Label>
                  <Input type="date" value={dateDay} onChange={(e) => setDateDay(e.target.value)} required />
                </div>
              )}
              {periodType === "range" && (
                <>
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>To</Label>
                    <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} required />
                  </div>
                </>
              )}
              {periodType === "month" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Month</Label>
                  <Input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} required />
                </div>
              )}
              {periodType === "quarter" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={yearValue}
                      onChange={(e) => setYearValue(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quarter</Label>
                    <Select
                      value={quarterValue}
                      onChange={(e) => setQuarterValue(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    >
                      <option value={1}>Q1 (Jan–Mar)</option>
                      <option value={2}>Q2 (Apr–Jun)</option>
                      <option value={3}>Q3 (Jul–Sep)</option>
                      <option value={4}>Q4 (Oct–Dec)</option>
                    </Select>
                  </div>
                </>
              )}
              {periodType === "year" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={yearValue}
                    onChange={(e) => setYearValue(Number(e.target.value))}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Category Targets</Label>
              <div className="mt-1.5 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
                    <tr>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Expected Premium (₹)</th>
                      <th className="px-3 py-2">Expected Policies</th>
                      <th className="px-3 py-2">Commission Type</th>
                      <th className="px-3 py-2">Commission Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetForms.map((t, i) => (
                      <tr key={t.category_id} className="border-t border-line">
                        <td className="px-3 py-2 font-medium text-text">{t.category_name}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            value={t.expected_premium}
                            onChange={(e) =>
                              setTargetForms((prev) =>
                                prev.map((row, idx) =>
                                  idx === i ? { ...row, expected_premium: e.target.value } : row,
                                ),
                              )
                            }
                            className="h-8 w-32"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            value={t.expected_policy_count}
                            onChange={(e) =>
                              setTargetForms((prev) =>
                                prev.map((row, idx) =>
                                  idx === i ? { ...row, expected_policy_count: e.target.value } : row,
                                ),
                              )
                            }
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={t.commission_type}
                            onChange={(e) =>
                              setTargetForms((prev) =>
                                prev.map((row, idx) =>
                                  idx === i
                                    ? { ...row, commission_type: e.target.value as "percent" | "flat_per_policy" }
                                    : row,
                                ),
                              )
                            }
                            className="h-8"
                          >
                            <option value="percent">% of premium</option>
                            <option value="flat_per_policy">Flat / policy</option>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={t.commission_value}
                            onChange={(e) =>
                              setTargetForms((prev) =>
                                prev.map((row, idx) =>
                                  idx === i ? { ...row, commission_value: e.target.value } : row,
                                ),
                              )
                            }
                            className="h-8 w-24"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  placeholder="Add another category (e.g. Group Insurance)…"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-8 w-64"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => void addCategory()}>
                  <Plus className="h-3.5 w-3.5" /> Add category
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional — included in the email to the associate)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save Changes"
                    : bulkMode && bulkAssociateIds.length > 1
                      ? `Create ${bulkAssociateIds.length} Plans`
                      : "Create Plan"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "plans" ? (
        loading ? (
          <DashboardSkeleton />
        ) : filteredPlans.length === 0 ? (
          <EmptyState message="No business plans yet — create one to get started." icon={Target} />
        ) : (
          <div className="space-y-4">
            {filteredPlans.map((plan) => {
              const totals = planTotals(plan);
              const expanded = expandedId === plan.id;
              const busy = busyId === plan.id;
              return (
                <Card key={plan.id} interactive>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base text-text">{plan.associate_name}</h3>
                        <PacingBadge plan={plan} />
                        <span className="flex items-center gap-1 text-xs text-text-soft">
                          {plan.viewed_at ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {plan.viewed_at ? "Seen" : "Not yet seen"}
                        </span>
                      </div>
                      <p className="text-xs text-text-soft">
                        {PERIOD_TYPE_LABEL[plan.period_type]} · {plan.period_label}
                        {totals.commissionEarned > 0 && <> · Commission earned: {formatINR(totals.commissionEarned)}</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openEditForm(plan)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyToNewPlan(plan)}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void sendEmail(plan)}>
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void exportPlanPdf(plan)}>
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void exportPlanExcel(plan)}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void deletePlan(plan)}
                        className="text-crimson"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : plan.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-soft hover:bg-surface-2"
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <PlanOverallProgress plan={plan} />
                  </div>
                  {expanded && (
                    <div className="mt-4">
                      <PlanTargetsBreakdown targets={plan.targets} />
                      {plan.notes && <p className="mt-3 text-sm text-text-soft">Notes: {plan.notes}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Input
              type="month"
              value={consolidatedMonth}
              onChange={(e) => setConsolidatedMonth(e.target.value)}
              className="h-9 w-44"
            />
            {consolidated && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => void exportConsolidatedPdf(consolidated)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void exportConsolidatedExcel(consolidated)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </Button>
              </div>
            )}
          </div>

          {consolidatedLoading ? (
            <DashboardSkeleton />
          ) : !consolidated || consolidated.associates.length === 0 ? (
            <EmptyState message="No plans for this period yet." icon={BarChart3} />
          ) : (
            <>
              <Card interactive>
                <h2 className="mb-3 font-display text-lg text-text">Achievement by Associate</h2>
                <ComparisonBarChart
                  rows={consolidated.associates.map((a) => ({
                    label: a.associate_name,
                    expected: a.expected_premium,
                    achieved: a.achieved_premium,
                  }))}
                />
              </Card>

              <Card interactive className="overflow-x-auto">
                <h2 className="mb-3 font-display text-lg text-text">Leaderboard</h2>
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
                    <tr>
                      <th className="px-3 py-2">Associate</th>
                      <th className="px-3 py-2">Plans</th>
                      <th className="px-3 py-2 text-right">Target</th>
                      <th className="px-3 py-2 text-right">Achieved</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">Commission Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidated.associates.map((a) => (
                      <tr key={a.associate_id} className="border-t border-line odd:bg-surface-2/40">
                        <td className="px-3 py-2 font-medium text-text">{a.associate_name}</td>
                        <td className="px-3 py-2 text-text-soft">{a.plan_count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text-soft">
                          {formatINR(a.expected_premium)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text">
                          {formatINR(a.achieved_premium)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text">
                          {a.expected_premium ? Math.round((a.achieved_premium / a.expected_premium) * 100) : 0}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-gold-text">
                          {formatINR(a.commission_earned)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {consolidated.by_category.length > 0 && (
                <Card interactive>
                  <h2 className="mb-3 font-display text-lg text-text">Achievement by Category</h2>
                  <ComparisonBarChart
                    rows={consolidated.by_category.map((c) => ({
                      label: c.category_name,
                      expected: c.expected_premium,
                      achieved: c.achieved_premium,
                    }))}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
