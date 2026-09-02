import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORAGE_ERROR_KINDS,
  StorageError,
  buildStorageDiagnosticReport,
  classifyStorageError,
  sanitizeStorageMessage,
} from '../src/lib/storageDiagnostics.js';

test('classifies SQLite lock failures', () => {
  assert.equal(classifyStorageError(new Error('SQLITE_BUSY: database is locked')), STORAGE_ERROR_KINDS.LOCKED);
});

test('classifies read-only and permission failures', () => {
  assert.equal(classifyStorageError(new Error('attempt to write a readonly database')), STORAGE_ERROR_KINDS.ACCESS);
  assert.equal(classifyStorageError(new Error('permission denied')), STORAGE_ERROR_KINDS.ACCESS);
});

test('classifies malformed schemas and damaged databases', () => {
  assert.equal(classifyStorageError(new Error('no such column: teamMode')), STORAGE_ERROR_KINDS.SCHEMA);
  assert.equal(classifyStorageError(new Error('database disk image is malformed')), STORAGE_ERROR_KINDS.CORRUPT);
});

test('redacts local paths from error messages and diagnostics', () => {
  const error = new StorageError({
    operation: 'save_entry',
    cause: new Error('unable to open database file C:\\Users\\Player\\AppData\\Roaming\\com.checkpoint.app\\checkpoint.db'),
  });
  const report = buildStorageDiagnosticReport({
    appVersion: '2.4.5',
    status: {
      driver: 'sqlite',
      state: 'error',
      schema: 'ready',
      writable: 'no',
      integrity: 'ok',
      lastError: {
        kind: error.kind,
        operation: error.operation,
        message: error.safeMessage,
      },
    },
  });

  assert.match(sanitizeStorageMessage(error), /\[redacted-path\]/);
  assert.doesNotMatch(report, /Player|AppData|checkpoint\.db/i);
  assert.match(report, /Error class: access/);
});
