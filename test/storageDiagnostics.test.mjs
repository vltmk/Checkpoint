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
import {
  LEGACY_MIGRATION_STATE_KEY,
  LEGACY_MIGRATION_STATES,
  SQLITE_LEGACY_PATH,
  migrateLegacySqliteData,
} from '../src/lib/sqliteMigration.js';

test('classifies SQLite lock failures', () => {
  assert.equal(classifyStorageError(new Error('SQLITE_BUSY: database is locked')), STORAGE_ERROR_KINDS.LOCKED);
});

test('classifies read-only and permission failures', () => {
  assert.equal(classifyStorageError(new Error('attempt to write a readonly database')), STORAGE_ERROR_KINDS.ACCESS);
  assert.equal(classifyStorageError(new Error('permission denied')), STORAGE_ERROR_KINDS.ACCESS);
});

test('classifies closed SQLite pools as unavailable', () => {
  assert.equal(classifyStorageError(new Error('attempted to acquire a connection on a closed pool')), STORAGE_ERROR_KINDS.UNAVAILABLE);
  assert.equal(classifyStorageError(new Error('database not loaded')), STORAGE_ERROR_KINDS.UNAVAILABLE);
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
  assert.match(report, /Initialization operation: initialize/);
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

function createMigrationFixture({ failEntryId = null, initialEntries = [], initialState = null } = {}) {
  const state = { value: initialState, entries: [...initialEntries], closed: false };
  const legacyState = { closed: false };
  const closeCalls = [];
  let loadCalls = 0;
  let failedEntry = false;
  const legacyEntries = [
    { id: 'legacy-1', title: 'Legacy one', game: 'WoW', income: 10, currency: 'TOMAN', dateTime: '2026-09-01' },
    { id: 'legacy-2', title: 'Legacy two', game: 'WoW', income: 20, currency: 'TOMAN', dateTime: '2026-09-02' },
  ];

  const mainDb = {
    async select(query) {
      if (state.closed) throw new Error('attempted to acquire a connection on a closed pool');
      if (query.includes('SELECT value FROM app_settings')) {
        return state.value ? [{ value: state.value }] : [];
      }
      if (query.includes('SELECT COUNT(*) as cnt FROM work_entries')) {
        return [{ cnt: state.entries.length }];
      }
      if (query.includes('SELECT 1 AS connection_alive')) return [{ connection_alive: 1 }];
      return [];
    },
    async execute(query, values = []) {
      if (state.closed) throw new Error('attempted to acquire a connection on a closed pool');
      if (query.includes(`key, value, updated_at`) && values[0] === LEGACY_MIGRATION_STATE_KEY) {
        state.value = values[1];
        return;
      }
      if (query.includes('INSERT OR IGNORE INTO work_entries')) {
        const id = values[0];
        if (id === failEntryId && !failedEntry) {
          failedEntry = true;
          throw new Error('simulated migration failure');
        }
        if (!state.entries.includes(id)) state.entries.push(id);
      }
    },
  };

  const legacyDb = {
    async select(query) {
      if (legacyState.closed) throw new Error('legacy pool closed');
      if (query.includes('sqlite_master')) return [{ name: 'work_entries' }];
      if (query.includes('COUNT(*) as cnt')) return [{ cnt: legacyEntries.length }];
      if (query.includes('SELECT * FROM work_entries')) return legacyEntries;
      return [];
    },
    async close(databasePath) {
      closeCalls.push(databasePath);
      legacyState.closed = true;
      if (!databasePath) state.closed = true;
      return true;
    },
  };

  return {
    mainDb,
    legacyDb,
    state,
    closeCalls,
    get loadCalls() {
      return loadCalls;
    },
    async loadDatabase(databasePath) {
      loadCalls++;
      assert.equal(databasePath, SQLITE_LEGACY_PATH);
      legacyState.closed = false;
      return legacyDb;
    },
  };
}

test('legacy migration closes only its own pool and leaves the main pool usable', async () => {
  const fixture = createMigrationFixture();

  await migrateLegacySqliteData({
    mainDb: fixture.mainDb,
    loadDatabase: fixture.loadDatabase,
    now: () => 1720000000,
  });

  assert.deepEqual(fixture.closeCalls, [SQLITE_LEGACY_PATH]);
  assert.equal(fixture.state.closed, false);
  assert.equal(fixture.state.value, LEGACY_MIGRATION_STATES.COMPLETE);
  assert.equal(fixture.loadCalls, 1);
  assert.deepEqual(await fixture.mainDb.select('SELECT 1 AS connection_alive;'), [{ connection_alive: 1 }]);
});

test('legacy migration retries after a partial copy and completes only after success', async () => {
  const fixture = createMigrationFixture({ failEntryId: 'legacy-2' });

  await assert.rejects(
    migrateLegacySqliteData({ mainDb: fixture.mainDb, loadDatabase: fixture.loadDatabase }),
    /simulated migration failure/
  );
  assert.equal(fixture.state.value, LEGACY_MIGRATION_STATES.IN_PROGRESS);
  assert.deepEqual(fixture.state.entries, ['legacy-1']);
  assert.deepEqual(fixture.closeCalls, [SQLITE_LEGACY_PATH]);

  await migrateLegacySqliteData({ mainDb: fixture.mainDb, loadDatabase: fixture.loadDatabase });
  assert.equal(fixture.state.value, LEGACY_MIGRATION_STATES.COMPLETE);
  assert.deepEqual(fixture.state.entries, ['legacy-1', 'legacy-2']);
  assert.deepEqual(fixture.closeCalls, [SQLITE_LEGACY_PATH, SQLITE_LEGACY_PATH]);
});

test('populated current databases are marked migrated without opening the legacy pool', async () => {
  const fixture = createMigrationFixture({ initialEntries: ['current-1'] });
  let opened = false;

  await migrateLegacySqliteData({
    mainDb: fixture.mainDb,
    loadDatabase: async () => {
      opened = true;
      return fixture.legacyDb;
    },
  });

  assert.equal(opened, false);
  assert.equal(fixture.state.value, LEGACY_MIGRATION_STATES.COMPLETE);
});

test('completed legacy migrations do not reopen the legacy pool', async () => {
  const fixture = createMigrationFixture({ initialState: LEGACY_MIGRATION_STATES.COMPLETE });
  let opened = false;

  await migrateLegacySqliteData({
    mainDb: fixture.mainDb,
    loadDatabase: async () => {
      opened = true;
      return fixture.legacyDb;
    },
  });

  assert.equal(opened, false);
  assert.equal(fixture.loadCalls, 0);
  assert.deepEqual(fixture.closeCalls, []);
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
