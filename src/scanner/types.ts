export type Severity = "critical" | "warning" | "healthy";

export interface Issue {
  id: number;
  title: string;
  severity: Severity;
  detail?: string;
}

export interface ScanResult {
  critical: Issue[];
  warnings: Issue[];
  healthyCount: number;
}
