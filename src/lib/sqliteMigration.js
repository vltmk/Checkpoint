export const SQLITE_MAIN_PATH = 'sqlite:checkpoint.db';
export const SQLITE_LEGACY_PATH = 'sqlite:nodra_vault.db';
export const LEGACY_MIGRATION_STATE_KEY = 'checkpoint_legacy_migration_v1';

export const LEGACY_MIGRATION_STATES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

export async function closeSqlitePool(database, databasePath) {
  if (!database) return false;
  return database.close(databasePath);
}

async function tableExists(database, tableName) {
  const rows = await database.select(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getMigrationState(mainDb) {
  const rows = await mainDb.select(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [LEGACY_MIGRATION_STATE_KEY]
  );
  return rows?.[0]?.value || null;
}

async function setMigrationState(mainDb, state) {
  await mainDb.execute(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
     VALUES (?, ?, strftime('%s', 'now'))`,
    [LEGACY_MIGRATION_STATE_KEY, state]
  );
}

/**
 * Migrate the legacy SQLite database without ever closing the main pool.
 * The state marker makes a partially completed migration retryable while
 * preserving the historical behavior of skipping legacy import when the
 * current database already contains entries.
 */
export async function migrateLegacySqliteData({ mainDb, loadDatabase, now = () => Math.floor(Date.now() / 1000) }) {
  if (!mainDb || typeof loadDatabase !== 'function') {
    return { state: null, copied: false };
  }

  const migrationState = await getMigrationState(mainDb);
  if (migrationState === LEGACY_MIGRATION_STATES.COMPLETE) {
    return { state: migrationState, copied: false };
  }

  const countRows = await mainDb.select('SELECT COUNT(*) as cnt FROM work_entries');
  const hasEntries = Boolean(countRows?.[0]?.cnt > 0);

  // Preserve the existing behavior for users who already have a populated
  // current database and have not gone through legacy migration before.
  if (!migrationState && hasEntries) {
    await setMigrationState(mainDb, LEGACY_MIGRATION_STATES.COMPLETE);
    return { state: LEGACY_MIGRATION_STATES.COMPLETE, copied: false };
  }

  let legacyDb = null;
  let copied = false;
  try {
    await setMigrationState(mainDb, LEGACY_MIGRATION_STATES.IN_PROGRESS);
    legacyDb = await loadDatabase(SQLITE_LEGACY_PATH);

    if (!(await tableExists(legacyDb, 'work_entries'))) {
      await setMigrationState(mainDb, LEGACY_MIGRATION_STATES.COMPLETE);
      return { state: LEGACY_MIGRATION_STATES.COMPLETE, copied: false };
    }

    const legacyCount = await legacyDb.select('SELECT COUNT(*) as cnt FROM work_entries');
    if (!legacyCount?.[0]?.cnt) {
      await setMigrationState(mainDb, LEGACY_MIGRATION_STATES.COMPLETE);
      return { state: LEGACY_MIGRATION_STATES.COMPLETE, copied: false };
    }

    const oldEntries = await legacyDb.select('SELECT * FROM work_entries');
    for (const row of oldEntries) {
      await mainDb.execute(
        `INSERT OR IGNORE INTO work_entries (id, title, game, source, teamMode, teammates, income, currency, exchangeRate, rateUnit, status, dateTime, hours, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.title, row.game, row.source || 'Direct Client',
          row.teamMode || 0, row.teammates || '[]', row.income || 0,
          row.currency || 'TOMAN', row.exchangeRate || 3200, row.rateUnit || '1k',
          row.status || 'Working', row.dateTime, row.hours || 0,
          row.notes || '', row.created_at || now(), row.updated_at || now(),
        ]
      );
    }

    if (await tableExists(legacyDb, 'proof_attachments')) {
      const oldProofs = await legacyDb.select('SELECT * FROM proof_attachments');
      for (const proof of oldProofs) {
        await mainDb.execute(
          `INSERT OR IGNORE INTO proof_attachments (id, entry_id, name, data_blob, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [proof.id, proof.entry_id, proof.name, proof.data_blob, proof.size || 0, proof.created_at]
        );
      }
    }

    if (await tableExists(legacyDb, 'app_settings')) {
      const oldSettings = await legacyDb.select('SELECT * FROM app_settings');
      for (const setting of oldSettings) {
        await mainDb.execute(
          `INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
          [setting.key, setting.value, setting.updated_at || now()]
        );
      }
    }

    if (await tableExists(legacyDb, 'db_snapshots')) {
      const oldSnapshots = await legacyDb.select('SELECT * FROM db_snapshots');
      for (const snapshot of oldSnapshots) {
        await mainDb.execute(
          `INSERT OR IGNORE INTO db_snapshots (id, name, snapshot_json, entries_count, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [snapshot.id, snapshot.name, snapshot.snapshot_json, snapshot.entries_count || 0, snapshot.created_at]
        );
      }
    }

    await setMigrationState(mainDb, LEGACY_MIGRATION_STATES.COMPLETE);
    copied = true;
    return { state: LEGACY_MIGRATION_STATES.COMPLETE, copied };
  } finally {
    if (legacyDb) {
      try {
        // Passing the exact key is essential: omitting it closes every SQL
        // pool, including the main checkpoint database.
        await closeSqlitePool(legacyDb, SQLITE_LEGACY_PATH);
      } catch (error) {}
    }
  }
}
