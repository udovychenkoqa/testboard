// Client-safe test-management enums and types (no DB imports) — shared by the
// repositories, API validation and UI.
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export const CASE_STATUSES = ['draft', 'actual', 'deprecated'] as const;
export const AUTOMATION = ['manual', 'automated', 'to_automate'] as const;
export const RESULTS = ['untested', 'passed', 'failed', 'blocked', 'skipped'] as const;

export type Priority = (typeof PRIORITIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type Automation = (typeof AUTOMATION)[number];
export type Result = (typeof RESULTS)[number];
