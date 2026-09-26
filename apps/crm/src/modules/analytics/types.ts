// Shapes of GET /api/pivot.php (apps/crm-api/lib/pivot_data.php).
export type Fact = "policies" | "leads";
export type MeasureFormat = "int" | "inr" | "pct";

export interface DimensionMeta {
  key: string;
  label: string;
  time: boolean;
}

export interface MeasureMeta {
  key: string;
  label: string;
  format: MeasureFormat;
  /** derived measure: numerator field / denominator field × 100 */
  ratio?: [string, string];
}

export type PivotMeta = Record<Fact, { label: string; dims: DimensionMeta[]; measures: MeasureMeta[] }>;

export type MeasureBag = Record<string, number>;
export type PivotCell = { r: string; c: string } & MeasureBag;

export interface PivotResult {
  fact: Fact;
  rows: string;
  cols: string | null;
  row_keys: string[];
  col_keys: string[];
  cells: PivotCell[];
  row_totals: Record<string, MeasureBag>;
  col_totals: Record<string, MeasureBag>;
  grand: MeasureBag;
  truncated: { rows: boolean; cols: boolean; row_count: number; col_count: number };
}

export interface DrillRecord {
  id: string;
  client_id: string | null;
  title: string;
  line1: string | null;
  line2: string | null;
  amount: number | null;
  badge: string | null;
  date: string | null;
}

export interface DrillResult {
  total: number;
  shown: number;
  records: DrillRecord[];
}

export type Filters = Record<string, string[]>;

export interface PivotConfig {
  fact: Fact;
  rows: string;
  cols: string; // "" = none
  measure: string;
  view: "table" | "chart";
  filters: Filters;
}
