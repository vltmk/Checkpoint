import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORAGE_ERROR_KINDS,
  STORAGE_INITIALIZATION_STAGES,
  StorageError,
  buildStorageDiagnosticReport,
  classifyStorageError,
  sanitizeStorageMessage,
  toStorageError,
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

test('preserves initialization failures alongside later save failures', () => {
  const initializationError = toStorageError(
    new Error('attempt to write a readonly database'),
    'initialize',
    STORAGE_INITIALIZATION_STAGES.WRITABILITY_CHECK,
  );
  const latestSaveError = toStorageError(
    new Error('Local database connection is unavailable.'),
    'save_entry',
  );
  const report = buildStorageDiagnosticReport({
    appVersion: '2.4.6',
    status: {
      driver: 'sqlite',
      state: 'error',
      initializationState: 'error',
      initializationStage: STORAGE_INITIALIZATION_STAGES.WRITABILITY_CHECK,
      initializationError: {
        kind: initializationError.kind,
        operation: initializationError.operation,
        stage: initializationError.stage,
        message: initializationError.safeMessage,
      },
      schema: 'ready',
      writable: 'no',
      integrity: 'ok',
      lastOperation: latestSaveError.operation,
      lastError: {
        kind: latestSaveError.kind,
        operation: latestSaveError.operation,
        stage: latestSaveError.stage,
        message: latestSaveError.safeMessage,
      },
    },
  });

  assert.match(report, /Initialization state: error/);
  assert.match(report, /Initialization stage: writability_check/);
  assert.match(report, /Initialization error class: access/);
  assert.match(report, /Initialization error detail: attempt to write a readonly database/);
  assert.match(report, /Last operation: save_entry/);
  assert.match(report, /Last error class: unavailable/);
});

test('labels each initialization phase without exposing record data', () => {
  const cases = [
    [STORAGE_INITIALIZATION_STAGES.LOAD, 'unable to open database file', STORAGE_ERROR_KINDS.ACCESS],
    [STORAGE_INITIALIZATION_STAGES.SCHEMA, 'no such column: teamMode', STORAGE_ERROR_KINDS.SCHEMA],
    [STORAGE_INITIALIZATION_STAGES.LEGACY_MIGRATION, 'database disk image is malformed', STORAGE_ERROR_KINDS.CORRUPT],
    [STORAGE_INITIALIZATION_STAGES.INTEGRITY_CHECK, 'SQLite integrity_check failed', STORAGE_ERROR_KINDS.CORRUPT],
    [STORAGE_INITIALIZATION_STAGES.WRITABILITY_CHECK, 'SQLITE_BUSY: database is locked', STORAGE_ERROR_KINDS.LOCKED],
  ];

  for (const [stage, message, kind] of cases) {
    const error = toStorageError(new Error(message), 'initialize', stage);
    const report = buildStorageDiagnosticReport({
      status: {
        driver: 'sqlite',
        state: 'error',
        initializationState: 'error',
        initializationStage: stage,
        initializationError: {
          kind: error.kind,
          operation: error.operation,
          stage: error.stage,
          message: error.safeMessage,
        },
      },
    });

    assert.match(report, new RegExp(`Initialization stage: ${stage}`));
    assert.match(report, new RegExp(`Initialization error class: ${kind}`));
    assert.doesNotMatch(report, /Raid gold|My secret proof/i);
  }
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
  assert.match(report, /Last error class: access/);
});
