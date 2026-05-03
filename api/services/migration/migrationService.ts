import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import { Pool, PoolConfig } from "pg";
import { logger } from "../../utils/logger";

export type DatabaseStatus = "empty" | "partial" | "ready" | "needs_upgrade";

export interface MigrationFile {
  filename: string;
  version: string;
  content: string;
  checksum: string;
}

export interface MigrationResult {
  version: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface MigrationProgress {
  current: number;
  total: number;
  currentFile: string;
  results: MigrationResult[];
}

export interface DatabaseStatusResult {
  status: DatabaseStatus;
  executedVersions: string[];
  missingVersions: string[];
  totalMigrations: number;
  executedCount: number;
}

export interface MigrationHistoryEntry {
  version: string;
  filename: string;
  checksum: string;
  executedAt: string | null;
  status: "executed" | "pending" | "checksum_mismatch";
  storedChecksum: string | null;
}

const VERSION_PREFIX_REGEX = /^(\d+)[_a-zA-Z]/;
const TEST_SEED_PREFIX = "99_";

class MigrationService extends EventEmitter {
  private migrationsPath: string | null = null;
  private databaseUrl: string | null = null;
  private pool: Pool | null = null;

  setMigrationsPath(migrationsPath: string): void {
    this.migrationsPath = migrationsPath;
    logger.info(`Migration path set to: ${migrationsPath}`);
  }

  setDatabaseUrl(databaseUrl: string): void {
    this.databaseUrl = databaseUrl;
    if (this.pool) {
      this.pool.end().catch(() => {});
      this.pool = null;
    }
    logger.info("Database URL configured for migrations");
  }

  private getPool(): Pool {
    if (!this.pool) {
      const url = this.databaseUrl || process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          "Database URL is not configured. Call setDatabaseUrl() or set DATABASE_URL environment variable.",
        );
      }

      const poolConfig: PoolConfig = {
        connectionString: url,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };

      this.pool = new Pool(poolConfig);

      this.pool.on("error", (err) => {
        logger.error("Unexpected pool error:", err);
      });
    }

    return this.pool;
  }

  private resolveMigrationsPath(): string {
    if (this.migrationsPath) {
      return this.migrationsPath;
    }

    const isPackaged =
      (process as { resourcesPath?: string }).resourcesPath?.includes(
        "resources",
      ) ?? false;

    if (isPackaged) {
      const resourcesPath = (process as { resourcesPath?: string })
        .resourcesPath;
      if (resourcesPath) {
        return path.join(resourcesPath, "migrations");
      }
    }

    const projectRoot = path.resolve(process.cwd());
    return path.join(projectRoot, "supabase", "migrations");
  }

  getMigrationFiles(): MigrationFile[] {
    const dirPath = this.resolveMigrationsPath();

    if (!fs.existsSync(dirPath)) {
      logger.warn(`Migrations directory not found: ${dirPath}`);
      return [];
    }

    const entries = fs.readdirSync(dirPath);
    const sqlFiles = entries.filter(
      (file) => file.endsWith(".sql") && !file.startsWith(TEST_SEED_PREFIX),
    );

    const sorted = sqlFiles.sort((a, b) => {
      const aMatch = a.match(VERSION_PREFIX_REGEX);
      const bMatch = b.match(VERSION_PREFIX_REGEX);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });

    const migrations: MigrationFile[] = sorted.map((filename) => {
      const filePath = path.join(dirPath, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const version = filename.replace(/\.sql$/, "");
      const checksum = this.computeChecksum(content);

      return { filename, version, content, checksum };
    });

    logger.info(`Found ${migrations.length} migration files in ${dirPath}`);
    return migrations;
  }

  private async isSupabaseMigrationsApplied(pool: Pool): Promise<boolean> {
    try {
      const schemaCheck = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'supabase_migrations'
        ) AS exists`,
      );
      if (!(schemaCheck.rows[0]?.exists ?? false)) {
        return false;
      }

      const tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
        ) AS exists`,
      );
      if (!(tableCheck.rows[0]?.exists ?? false)) {
        return false;
      }

      const countResult = await pool.query(
        "SELECT COUNT(*) AS cnt FROM supabase_migrations.schema_migrations",
      );
      const count = parseInt(countResult.rows[0]?.cnt ?? "0", 10);
      return count > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Failed to check supabase_migrations status:", message);
      return false;
    }
  }

  private async ensureSchemaVersionsTable(pool: Pool): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _schema_versions (
        id SERIAL PRIMARY KEY,
        version VARCHAR(100) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64)
      );
    `);
  }

  private async syncSchemaVersions(pool: Pool): Promise<boolean> {
    const supabaseApplied = await this.isSupabaseMigrationsApplied(pool);
    if (!supabaseApplied) {
      return false;
    }

    await this.ensureSchemaVersionsTable(pool);

    const executedResult = await pool.query(
      "SELECT version FROM _schema_versions",
    );
    const executedSet = new Set(
      executedResult.rows.map((r: { version: string }) => r.version),
    );

    const allMigrations = this.getMigrationFiles();
    const missingMigrations = allMigrations.filter(
      (m) => !executedSet.has(m.version),
    );

    if (missingMigrations.length === 0) {
      return false;
    }

    logger.info(
      `Syncing ${missingMigrations.length} migration version(s) from Supabase CLI to _schema_versions...`,
    );

    for (const migration of missingMigrations) {
      await pool.query(
        `INSERT INTO _schema_versions (version, checksum)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        [migration.version, migration.checksum],
      );
    }

    logger.info(
      `Synced ${missingMigrations.length} migration version(s) to _schema_versions`,
    );
    return true;
  }

  async getDatabaseStatus(): Promise<DatabaseStatusResult> {
    const pool = this.getPool();

    try {
      const usersCheck = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'
        ) AS exists`,
      );

      const usersExists = usersCheck.rows[0]?.exists ?? false;

      if (!usersExists) {
        return {
          status: "empty",
          executedVersions: [],
          missingVersions: this.getMigrationFiles().map((m) => m.version),
          totalMigrations: this.getMigrationFiles().length,
          executedCount: 0,
        };
      }

      const schemaVersionsCheck = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '_schema_versions'
        ) AS exists`,
      );

      const schemaVersionsExists = schemaVersionsCheck.rows[0]?.exists ?? false;

      if (!schemaVersionsExists) {
        const synced = await this.syncSchemaVersions(pool);
        if (synced) {
          return this.buildReadyStatus(pool);
        }

        return {
          status: "partial",
          executedVersions: [],
          missingVersions: this.getMigrationFiles().map((m) => m.version),
          totalMigrations: this.getMigrationFiles().length,
          executedCount: 0,
        };
      }

      const executedResult = await pool.query(
        "SELECT version FROM _schema_versions ORDER BY id",
      );
      const executedVersions = executedResult.rows.map(
        (r: { version: string }) => r.version,
      );

      const allMigrations = this.getMigrationFiles();
      const allVersions = allMigrations.map((m) => m.version);
      const missingVersions = allVersions.filter(
        (v) => !executedVersions.includes(v),
      );

      if (missingVersions.length > 0) {
        const synced = await this.syncSchemaVersions(pool);
        if (synced) {
          return this.buildReadyStatus(pool);
        }
      }

      let status: DatabaseStatus;
      if (missingVersions.length === 0) {
        status = "ready";
      } else {
        status = "needs_upgrade";
      }

      return {
        status,
        executedVersions,
        missingVersions,
        totalMigrations: allMigrations.length,
        executedCount: executedVersions.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to get database status:", message);
      throw error;
    }
  }

  private async buildReadyStatus(pool: Pool): Promise<DatabaseStatusResult> {
    const executedResult = await pool.query(
      "SELECT version FROM _schema_versions ORDER BY id",
    );
    const executedVersions = executedResult.rows.map(
      (r: { version: string }) => r.version,
    );
    const allMigrations = this.getMigrationFiles();
    const allVersions = allMigrations.map((m) => m.version);
    const missingVersions = allVersions.filter(
      (v) => !executedVersions.includes(v),
    );

    return {
      status: missingVersions.length === 0 ? "ready" : "needs_upgrade",
      executedVersions,
      missingVersions,
      totalMigrations: allMigrations.length,
      executedCount: executedVersions.length,
    };
  }

  async executeMigrations(): Promise<MigrationResult[]> {
    const allMigrations = this.getMigrationFiles();
    const pool = this.getPool();

    if (allMigrations.length === 0) {
      logger.info("No migration files found");
      return [];
    }

    const schemaVersionsCheck = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_schema_versions'
      ) AS exists`,
    );

    const schemaVersionsExists = schemaVersionsCheck.rows[0]?.exists ?? false;

    if (!schemaVersionsExists) {
      logger.info("Creating _schema_versions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS _schema_versions (
          id SERIAL PRIMARY KEY,
          version VARCHAR(100) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64)
        );
      `);
    }

    const executedResult = await pool.query(
      "SELECT version FROM _schema_versions ORDER BY id",
    );
    const executedVersions = new Set(
      executedResult.rows.map((r: { version: string }) => r.version),
    );

    const pendingMigrations = allMigrations.filter(
      (m) => !executedVersions.has(m.version),
    );

    if (pendingMigrations.length === 0) {
      logger.info("All migrations already executed");
      return [];
    }

    logger.info(
      `Executing ${pendingMigrations.length} pending migration(s)...`,
    );

    const results: MigrationResult[] = [];

    for (let i = 0; i < pendingMigrations.length; i++) {
      const migration = pendingMigrations[i];
      const startTime = Date.now();

      this.emit("progress", {
        current: i + 1,
        total: pendingMigrations.length,
        currentFile: migration.filename,
        results,
      } satisfies MigrationProgress);

      try {
        await this.executeSingleMigration(pool, migration);

        const duration = Date.now() - startTime;
        const result: MigrationResult = {
          version: migration.version,
          success: true,
          duration,
        };
        results.push(result);

        logger.info(
          `Migration ${migration.version} executed successfully (${duration}ms)`,
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);
        const result: MigrationResult = {
          version: migration.version,
          success: false,
          error: message,
          duration,
        };
        results.push(result);

        logger.error(`Migration ${migration.version} failed: ${message}`);

        break;
      }
    }

    this.emit("complete", results);

    return results;
  }

  private async executeSingleMigration(
    pool: Pool,
    migration: MigrationFile,
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(migration.content);

      await client.query(
        `INSERT INTO _schema_versions (version, checksum)
         VALUES ($1, $2)
         ON CONFLICT (version) DO UPDATE SET
           executed_at = NOW(),
           checksum = EXCLUDED.checksum`,
        [migration.version, migration.checksum],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getMigrationHistory(): Promise<MigrationHistoryEntry[]> {
    const allMigrations = this.getMigrationFiles();
    const pool = this.getPool();

    const schemaVersionsCheck = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_schema_versions'
      ) AS exists`,
    );

    const schemaVersionsExists = schemaVersionsCheck.rows[0]?.exists ?? false;

    const executedMap = new Map<
      string,
      { executedAt: string; checksum: string }
    >();

    if (schemaVersionsExists) {
      const result = await pool.query(
        "SELECT version, executed_at, checksum FROM _schema_versions ORDER BY id",
      );

      for (const row of result.rows) {
        executedMap.set(row.version, {
          executedAt: row.executed_at,
          checksum: row.checksum,
        });
      }
    }

    return allMigrations.map((migration) => {
      const executed = executedMap.get(migration.version);

      if (!executed) {
        return {
          version: migration.version,
          filename: migration.filename,
          checksum: migration.checksum,
          executedAt: null,
          status: "pending" as const,
          storedChecksum: null,
        };
      }

      const checksumMismatch =
        executed.checksum !== null && executed.checksum !== migration.checksum;

      return {
        version: migration.version,
        filename: migration.filename,
        checksum: migration.checksum,
        executedAt: executed.executedAt,
        status: checksumMismatch
          ? ("checksum_mismatch" as const)
          : ("executed" as const),
        storedChecksum: executed.checksum,
      };
    });
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info("Migration database pool closed");
    }
  }

  private computeChecksum(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
}

export const migrationService = new MigrationService();
