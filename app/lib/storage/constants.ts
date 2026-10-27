import path from 'node:path';

// DATA_DIR lets the e2e suite run against an isolated, throwaway data folder.
export const DATA_PATH = process.env.DATA_DIR || 'data';
export const RESULTS_PATH = 'results';
export const REPORTS_PATH = 'reports';
export const CONFIG_FILENAME = 'config.json';

export const APP_CONFIG_S3 = `${DATA_PATH}/${CONFIG_FILENAME}`;
export const RESULTS_BUCKET = `${DATA_PATH}/${RESULTS_PATH}`;
export const REPORTS_BUCKET = `${DATA_PATH}/${REPORTS_PATH}`;

const CWD = process.cwd();

// resolve, not join: an absolute DATA_DIR (e.g. a mounted volume) must be used as-is.
export const DATA_FOLDER = path.resolve(CWD, DATA_PATH);
export const APP_CONFIG = path.join(DATA_FOLDER, CONFIG_FILENAME);
export const PW_CONFIG = path.join(CWD, 'playwright.config.ts');
export const TMP_FOLDER = path.join(CWD, '.tmp');
export const RESULTS_FOLDER = path.join(DATA_FOLDER, RESULTS_PATH);
export const REPORTS_FOLDER = path.join(DATA_FOLDER, REPORTS_PATH);

export const REPORT_METADATA_FILE = 'report-server-metadata.json';

export const DEFAULT_STREAM_CHUNK_SIZE = 512 * 1024; // 512KB
