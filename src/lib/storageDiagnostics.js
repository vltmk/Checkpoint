const MAX_ERROR_MESSAGE_LENGTH = 240;

export const STORAGE_ERROR_KINDS = Object.freeze({
  LOCKED: 'locked',
  ACCESS: 'access',
  CORRUPT: 'corrupt',
  SCHEMA: 'schema',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
});

export const STORAGE_INITIALIZATION_STAGES = Object.freeze({
  LOAD: 'load',
  SCHEMA: 'schema',
  LEGACY_MIGRATION: 'legacy_migration',
  INTEGRITY_CHECK: 'integrity_check',
  WRITABILITY_CHECK: 'writability_check',
  READY: 'ready',
});

const USER_MESSAGES = Object.freeze({
  [STORAGE_ERROR_KINDS.LOCKED]: 'Your local ledger is busy. Close any other CHECKPOINT windows or backup/sync tools, then try again.',
  [STORAGE_ERROR_KINDS.ACCESS]: 'CHECKPOINT cannot write to its local data folder. Check available disk space and Windows folder permissions, then try again.',
  [STORAGE_ERROR_KINDS.CORRUPT]: 'CHECKPOINT could not verify the local ledger database. Keep this form open and send the copied diagnostics to support.',
  [STORAGE_ERROR_KINDS.SCHEMA]: 'CHECKPOINT could not prepare the local ledger database. Keep this form open and send the copied diagnostics to support.',
  [STORAGE_ERROR_KINDS.UNAVAILABLE]: 'The local ledger database is unavailable. Keep this form open and try again after resolving the storage issue.',
  [STORAGE_ERROR_KINDS.UNKNOWN]: 'CHECKPOINT could not save this record. Your form has been kept intact; copy diagnostics if the problem continues.',
});

export function sanitizeStorageMessage(error) {
  const raw = String(error?.message || error || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '[redacted-path]')
    .replace(/(?:file:\/\/)?\/(?:Users|home)\/[^\s"']+/gi, '[redacted-path]')
    .replace(/\s+/g, ' ')
    .trim();

  return raw.slice(0, MAX_ERROR_MESSAGE_LENGTH) || 'No technical message was provided.';
}

export function classifyStorageError(error) {
  const message = sanitizeStorageMessage(error).toLowerCase();

  if (/sqlite_busy|database is locked|database is busy|busy timeout|cannot start a transaction/.test(message)) {
    return STORAGE_ERROR_KINDS.LOCKED;
  }

  if (/readonly|read-only|permission denied|access is denied|unable to open database file|disk is full|database or disk is full|i\/o error/.test(message)) {
    return STORAGE_ERROR_KINDS.ACCESS;
  }

  if (/malformed|corrupt|not a database|integrity_check|database disk image is malformed/.test(message)) {
    return STORAGE_ERROR_KINDS.CORRUPT;
  }

  if (/no such (table|column)|schema|duplicate column name|has no column named/.test(message)) {
    return STORAGE_ERROR_KINDS.SCHEMA;
  }

  if (/not initialized|unavailable|failed to initialize|database connection|closed pool|pool is closed|database not loaded/.test(message)) {
    return STORAGE_ERROR_KINDS.UNAVAILABLE;
  }

  return STORAGE_ERROR_KINDS.UNKNOWN;
}

export class StorageError extends Error {
  constructor({ operation = 'unknown', stage = null, cause, kind } = {}) {
    const safeMessage = sanitizeStorageMessage(cause);
    super(safeMessage);
    this.name = 'StorageError';
    this.operation = operation;
    this.stage = stage;
    this.kind = kind || classifyStorageError(cause);
    this.safeMessage = safeMessage;
    this.userMessage = USER_MESSAGES[this.kind] || USER_MESSAGES[STORAGE_ERROR_KINDS.UNKNOWN];
  }
}

export function toStorageError(error, operation, stage = null) {
  if (error instanceof StorageError && (!operation || error.operation === operation) && (!stage || error.stage === stage)) {
    return error;
  }

  return new StorageError({
    operation: operation || error?.operation || 'unknown',
    stage: stage || error?.stage || null,
    cause: error,
    kind: error instanceof StorageError ? error.kind : undefined,
  });
}

export function buildStorageDiagnosticReport({ appVersion = 'unknown', status = {}, checks = {} } = {}) {
  const initializationError = status.initializationError || {};
  const lastError = status.lastError || {};
  const lines = [
    'CHECKPOINT Storage Diagnostics',
    `Generated: ${new Date().toISOString()}`,
    `App version: ${appVersion}`,
    `Driver: ${status.driver || 'unknown'}`,
    `State: ${status.state || 'unknown'}`,
    `Initialization state: ${status.initializationState || 'unknown'}`,
    `Initialization stage: ${status.initializationStage || 'unknown'}`,
    `Schema: ${status.schema || 'unknown'}`,
    `Writable: ${checks.writable || status.writable || 'unknown'}`,
    `Integrity: ${checks.integrity || status.integrity || 'unknown'}`,
    `Initialization operation: ${initializationError.operation || 'none'}`,
    `Initialization error class: ${initializationError.kind || 'none'}`,
  ];

  if (initializationError.message) {
    lines.push(`Initialization error detail: ${sanitizeStorageMessage(initializationError.message)}`);
  }

  lines.push(
    `Last operation: ${lastError.operation || status.lastOperation || 'none'}`,
    `Last error stage: ${lastError.stage || 'none'}`,
    `Last error class: ${lastError.kind || 'none'}`,
  );

  if (lastError.message) {
    lines.push(`Last error detail: ${sanitizeStorageMessage(lastError.message)}`);
  }

  lines.push('Record values, proof attachments, and local file paths are intentionally excluded.');
  return lines.join('\n');
}
