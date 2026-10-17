// Schema migrations for the test-management database, applied in order.
// PRAGMA user_version records how many have run; never edit a shipped entry —
// append a new one instead.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE tm_projects (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    next_case_number INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE tm_suites (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES tm_projects(id),
    parent_id INTEGER REFERENCES tm_suites(id),
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );
  CREATE INDEX tm_suites_project ON tm_suites(project_id);

  CREATE TABLE tm_cases (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES tm_projects(id),
    suite_id INTEGER NOT NULL REFERENCES tm_suites(id),
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    preconditions TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'actual' CHECK (status IN ('draft', 'actual', 'deprecated')),
    automation TEXT NOT NULL DEFAULT 'manual' CHECK (automation IN ('manual', 'automated', 'to_automate')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE (project_id, number)
  );
  CREATE INDEX tm_cases_suite ON tm_cases(suite_id);

  CREATE TABLE tm_case_steps (
    id INTEGER PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES tm_cases(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    action TEXT NOT NULL,
    expected TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX tm_case_steps_case ON tm_case_steps(case_id);

  CREATE TABLE tm_case_tags (
    case_id INTEGER NOT NULL REFERENCES tm_cases(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (case_id, tag)
  );

  CREATE TABLE tm_runs (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES tm_projects(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX tm_runs_project ON tm_runs(project_id);

  CREATE TABLE tm_run_cases (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES tm_runs(id),
    case_id INTEGER NOT NULL REFERENCES tm_cases(id),
    snapshot TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'untested'
      CHECK (result IN ('untested', 'passed', 'failed', 'blocked', 'skipped')),
    comment TEXT NOT NULL DEFAULT '',
    assignee TEXT,
    result_by TEXT,
    result_at TEXT
  );
  CREATE INDEX tm_run_cases_run ON tm_run_cases(run_id);
  `,
];
