import { TABLES, type TableDef } from "../schema";

/**
 * Generate the CREATE TABLE SQL statement for a given table definition.
 *
 * Notes on type adaptation:
 * - JSONB columns are stored as TEXT in SQLite; the application layer
 *   handles JSON.parse/stringify automatically (marked via isJsonb).
 * - vector(N) columns are stored as TEXT (JSON array); no local vector
 *   search is supported (marked via isVector).
 * - PostgreSQL array columns (TEXT[], UUID[], INTEGER[]) are stored as
 *   TEXT (JSON array); the application layer handles serialization
 *   (marked via isArray).
 * - Custom enums (user_role, collaborator_role, etc.) are stored as TEXT
 *   with app-level validation.
 * - TIMESTAMPTZ is stored as TEXT (ISO 8601 string).
 * - BOOLEAN is stored as INTEGER (0/1).
 * - DECIMAL/DOUBLE PRECISION/FLOAT are stored as REAL.
 */
function generateCreateTableSQL(table: TableDef): string {
  const columnDefs: string[] = [];

  for (const col of table.columns) {
    let def = `  ${col.name} ${col.type}`;

    if (!col.nullable) {
      def += " NOT NULL";
    }

    // Add PRIMARY KEY for single-column primary keys inline
    if (table.primaryKey.length === 1 && table.primaryKey[0] === col.name) {
      def += " PRIMARY KEY";
    }

    if (col.defaultValue !== null && col.defaultValue !== undefined) {
      def += ` DEFAULT ${col.defaultValue}`;
    }

    columnDefs.push(def);
  }

  // Add composite primary key if multi-column
  if (table.primaryKey.length > 1) {
    columnDefs.push(`  PRIMARY KEY (${table.primaryKey.join(", ")})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${table.name} (\n${columnDefs.join(",\n")}\n);`;
}

/**
 * Generate CREATE INDEX SQL statements for a given table definition.
 */
function generateIndexSQL(table: TableDef): string[] {
  const statements: string[] = [];

  for (const idx of table.indexes) {
    const unique = idx.unique ? "UNIQUE " : "";
    statements.push(
      `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name} (${idx.columns.join(", ")});`,
    );
  }

  return statements;
}

/**
 * Get the initial migration that creates all tables and indexes.
 *
 * Tables are created in dependency order to satisfy foreign key
 * relationships (even though SQLite doesn't enforce FK constraints
 * by default, we maintain the logical ordering for clarity).
 *
 * System tables (sync_metadata, sync_conflicts, schema_version) are
 * created last as they have no dependencies on user data tables.
 */
export function getInitialMigration(): string[] {
  const statements: string[] = [];

  // Define creation order based on foreign key dependencies.
  // Tables referenced by others must come first.
  const creationOrder = [
    // 01_core_users - no FK dependencies
    "users",

    // 02_knowledge_graph - depends on users
    "knowledge_graphs",

    // 03_knowledge_points - depends on users
    "knowledge_points",
    "knowledge_point_versions",

    // 04_graph_structure - depends on knowledge_graphs, knowledge_points
    "graph_nodes",
    "edges",
    "relationship_types",

    // 05_domains_and_collaboration - depends on users, knowledge_graphs
    "domains",
    "graph_domains",
    "graph_collaborators",
    "graph_relations",
    "backup_snapshots",

    // 06_study_and_cards - depends on users, knowledge_graphs, knowledge_points
    "quiz_sets",
    "study_cards",
    "quiz_set_cards",
    "study_progress",

    // 07_scheduler_tasks - depends on users, knowledge_points
    "queues",
    "user_tasks",
    "task_executions",
    "task_tags",
    "task_settings",
    "task_dependencies",
    "task_schedules",
    "task_progress_plans",
    "user_time_slots",
    "task_subtasks",
    "task_links",
    "task_knowledge_points",
    "task_templates",
    "task_reviews",
    "scheduler_weight_profiles",

    // 08_learning_paths - depends on users, knowledge_graphs, knowledge_points, user_tasks
    "learning_paths",
    "learning_path_nodes",
    "learning_path_prerequisites",
    "learning_path_progress",
    "path_node_tasks",
    "learning_loops",

    // 09_gamification - depends on users, achievements
    "achievements",
    "user_achievements",
    "periodic_tasks",
    "periodic_passes",
    "pass_rewards",
    "user_pass_progress",
    "user_focus_stats",

    // 10_ai_and_prompts - depends on users, knowledge_graphs
    "prompt_templates",
    "ai_actions",
    "app_settings",
    "templates",

    // 11_focus_and_notifications - depends on users, user_tasks, knowledge_points, knowledge_graphs
    "focus_sessions",
    "notifications",
    "notification_settings",
    "user_efficiency_profile",
    "user_activities",

    // System tables - no FK dependencies
    "sync_metadata",
    "sync_conflicts",
    "sync_operations",
    "schema_version",
  ];

  for (const tableName of creationOrder) {
    const table = TABLES[tableName];
    if (!table) {
      continue;
    }

    // CREATE TABLE
    statements.push(generateCreateTableSQL(table));

    // CREATE INDEX statements
    statements.push(...generateIndexSQL(table));
  }

  return statements;
}

/**
 * Version number for this initial migration.
 * Future migrations should use incrementing version numbers.
 */
export const INITIAL_SCHEMA_VERSION = 1;
