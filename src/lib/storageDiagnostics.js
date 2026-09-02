const MAX_ERROR_MESSAGE_LENGTH = 240;

export const STORAGE_ERROR_KINDS = Object.freeze({
  LOCKED: 'locked',
  ACCESS: 'access',
  CORRUPT: 'corrupt',
  SCHEMA: 'schema',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
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

  if (/not initialized|unavailable|failed to initialize|database connection/.test(message)) {
    return STORAGE_ERROR_KINDS.UNAVAILABLE;
  }

  return STORAGE_ERROR_KINDS.UNKNOWN;
}

export class StorageError extends Error {
  constructor({ operation = 'unknown', cause, kind } = {}) {
    const safeMessage = sanitizeStorageMessage(cause);
    super(safeMessage);
    this.name = 'StorageError';
    this.operation = operation;
    this.kind = kind || classifyStorageError(cause);
    this.safeMessage = safeMessage;
    this.userMessage = USER_MESSAGES[this.kind] || USER_MESSAGES[STORAGE_ERROR_KINDS.UNKNOWN];
  }
}

export function toStorageError(error, operation) {
  if (error instanceof StorageError) return error;
  return new StorageError({ operation, cause: error });
}

export function buildStorageDiagnosticReport({ appVersion = 'unknown', status = {}, checks = {} } = {}) {
  const error = status.lastError || {};
  const lines = [
    'CHECKPOINT Storage Diagnostics',
    `Generated: ${new Date().toISOString()}`,
    `App version: ${appVersion}`,
    `Driver: ${status.driver || 'unknown'}`,
    `State: ${status.state || 'unknown'}`,
    `Schema: ${status.schema || 'unknown'}`,
    `Writable: ${checks.writable || status.writable || 'unknown'}`,
    `Integrity: ${checks.integrity || status.integrity || 'unknown'}`,
    `Last operation: ${error.operation || status.lastOperation || 'none'}`,
    `Error class: ${error.kind || 'none'}`,
  ];

  if (error.message) {
    lines.push(`Error detail: ${sanitizeStorageMessage(error.message)}`);
  }

  lines.push('Record values, proof attachments, and local file paths are intentionally excluded.');
  return lines.join('\n');
}

