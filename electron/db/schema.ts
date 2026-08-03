// =====================================================
// Knowledge Map - SQLite Schema Adapter for Local-First
// =====================================================
//
// Type mapping: PostgreSQL -> SQLite
// JSONB        -> TEXT (auto JSON parse/stringify)
// vector(N)    -> TEXT (JSON array, no local vector search)
// Custom enums -> TEXT (app-level validation)
// TIMESTAMPTZ  -> TEXT (ISO 8601 string)
// UUID         -> TEXT (app-level UUID generation)
// BOOLEAN      -> INTEGER (0/1)
// BIGINT       -> INTEGER
// DECIMAL(M,N) -> REAL
// DOUBLE PRECISION -> REAL
// FLOAT        -> REAL
// VARCHAR(N)   -> TEXT
// TIME         -> TEXT
// DATE         -> TEXT
// TEXT[]       -> TEXT (JSON array)
// UUID[]       -> TEXT (JSON array)
// INTEGER[]    -> TEXT (JSON array)

export interface ColumnDef {
  name: string;
  type: string; // SQLite type
  pgType: string; // Original PostgreSQL type for serialization hints
  nullable: boolean;
  defaultValue?: string | null; // SQLite default expression
  isJsonb?: boolean; // Needs JSON parse/stringify
  isVector?: boolean; // Needs JSON parse/stringify for embeddings
  isArray?: boolean; // PostgreSQL array type, stored as JSON
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  primaryKey: string[];
  indexes: IndexDef[];
  syncEnabled: boolean; // Whether this table participates in sync
  userColumn?: string; // Column that identifies the user (for sync filtering)
  hasDeletedAt?: boolean; // Whether table uses soft delete
  hasUpdatedAt?: boolean; // Whether table has updated_at for incremental sync
}

// =====================================================
// Helper: Define columns with consistent patterns
// =====================================================

const idColumn = (name = 'id'): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'UUID',
  nullable: false,
  defaultValue: null,
});



const userIdNullableColumn = (name = 'user_id'): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'UUID',
  nullable: true,
  defaultValue: null,
});

const fkColumn = (name: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'UUID',
  nullable: true,
  defaultValue: null,
});

const fkRequiredColumn = (name: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'UUID',
  nullable: false,
  defaultValue: null,
});

const textColumn = (name: string, nullable = true, defaultValue?: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'TEXT',
  nullable,
  defaultValue: defaultValue ?? null,
});

const textRequiredColumn = (name: string, defaultValue?: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'TEXT',
  nullable: false,
  defaultValue: defaultValue ?? null,
});

const varcharColumn = (name: string, nullable = true, defaultValue?: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'VARCHAR',
  nullable,
  defaultValue: defaultValue ?? null,
});

const integerColumn = (name: string, nullable = true, defaultValue?: string): ColumnDef => ({
  name,
  type: 'INTEGER',
  pgType: 'INTEGER',
  nullable,
  defaultValue: defaultValue ?? null,
});

const realColumn = (name: string, nullable = true, defaultValue?: string): ColumnDef => ({
  name,
  type: 'REAL',
  pgType: 'DECIMAL',
  nullable,
  defaultValue: defaultValue ?? null,
});

const booleanColumn = (name: string, defaultValue = '0'): ColumnDef => ({
  name,
  type: 'INTEGER',
  pgType: 'BOOLEAN',
  nullable: false,
  defaultValue,
});

const booleanNullableColumn = (name: string): ColumnDef => ({
  name,
  type: 'INTEGER',
  pgType: 'BOOLEAN',
  nullable: true,
  defaultValue: null,
});

const jsonbColumn = (name: string, defaultValue = "'{}'"): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'JSONB',
  nullable: false,
  defaultValue,
  isJsonb: true,
});

const jsonbArrayColumn = (name: string, defaultValue = "'[]'"): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'JSONB',
  nullable: false,
  defaultValue,
  isJsonb: true,
});

const jsonbNullableColumn = (name: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'JSONB',
  nullable: true,
  defaultValue: null,
  isJsonb: true,
});

const vectorColumn = (name: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'vector(1024)',
  nullable: true,
  defaultValue: null,
  isVector: true,
});

const timestampColumn = (name: string, nullable = true, defaultValue?: string): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'TIMESTAMPTZ',
  nullable,
  defaultValue: defaultValue ?? null,
});

const dateColumn = (name: string, nullable = true): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'DATE',
  nullable,
  defaultValue: null,
});

const timeColumn = (name: string, nullable = false): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: 'TIME',
  nullable,
  defaultValue: null,
});

const pgArrayColumn = (name: string, pgElementType: string, defaultValue = "'[]'"): ColumnDef => ({
  name,
  type: 'TEXT',
  pgType: `${pgElementType}[]`,
  nullable: false,
  defaultValue,
  isArray: true,
});



// Sync tracking columns added to every user-facing table
const syncStatusColumn = (): ColumnDef => ({
  name: 'sync_status',
  type: 'TEXT',
  pgType: 'TEXT',
  nullable: false,
  defaultValue: "'synced'",
});

const localUpdatedAtColumn = (): ColumnDef => ({
  name: 'local_updated_at',
  type: 'TEXT',
  pgType: 'TEXT',
  nullable: true,
  defaultValue: null,
});

// =====================================================
// Table Definitions
// =====================================================

// --- 01_core_users ---
const usersTable: TableDef = {
  name: 'users',
  columns: [
    idColumn(),
    { name: 'email', type: 'TEXT', pgType: 'VARCHAR(255)', nullable: false, defaultValue: null },
    { name: 'password_hash', type: 'TEXT', pgType: 'VARCHAR(255)', nullable: true, defaultValue: null },
    { name: 'name', type: 'TEXT', pgType: 'VARCHAR(100)', nullable: false, defaultValue: "'User'" },
    { name: 'plan', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'free'" },
    jsonbColumn('settings', "'{}'"),
    integerColumn('xp', false, '0'),
    integerColumn('level', false, '0'),
    { name: 'role', type: 'TEXT', pgType: 'user_role', nullable: false, defaultValue: "'user'" },
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [{ name: 'idx_users_email', columns: ['email'], unique: true }],
  syncEnabled: true,
  userColumn: 'id',
  hasUpdatedAt: true,
};

// --- 02_knowledge_graph ---
const knowledgeGraphsTable: TableDef = {
  name: 'knowledge_graphs',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    textRequiredColumn('title'),
    textColumn('description'),
    varcharColumn('domain'),
    jsonbColumn('settings', "'{}'"),
    booleanColumn('is_public', '0'),
    booleanColumn('is_favorite', '0'),
    fkColumn('parent_graph_id'),
    timestampColumn('last_used_at'),
    vectorColumn('embedding'),
    timestampColumn('deleted_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    varcharColumn('template_type'),
    fkColumn('task_id'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_knowledge_graphs_user_id', columns: ['user_id'] },
    { name: 'idx_knowledge_graphs_deleted_at', columns: ['deleted_at'] },
    { name: 'idx_knowledge_graphs_parent_graph_id', columns: ['parent_graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasDeletedAt: true,
  hasUpdatedAt: true,
};

const knowledgeGraphContentsTable: TableDef = {
  name: 'knowledge_graph_contents',
  columns: [
    fkRequiredColumn('graph_id'),
    textColumn('podcast_script'),
    jsonbArrayColumn('reference_books', "'[]'"),
    jsonbArrayColumn('external_links', "'[]'"),
    textColumn('learning_guide'),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['graph_id'],
  indexes: [],
  syncEnabled: true,
  userColumn: undefined, // Derived from knowledge_graphs -> user_id
  hasUpdatedAt: true,
};

// --- 03_knowledge_points ---
const knowledgePointsTable: TableDef = {
  name: 'knowledge_points',
  columns: [
    idColumn(),
    textRequiredColumn('title'),
    textColumn('content'),
    textColumn('learning_material'),
    jsonbArrayColumn('keywords', "'[]'"),
    jsonbColumn('properties', "'{}'"),
    vectorColumn('embedding'),
    { name: 'visibility', type: 'TEXT', pgType: 'knowledge_point_visibility', nullable: false, defaultValue: "'private'" },
    fkRequiredColumn('owner_id'),
    realColumn('mastery_level', false, '0'),
    timestampColumn('last_study_at'),
    integerColumn('total_study_duration', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_knowledge_points_owner_id', columns: ['owner_id'] },
  ],
  syncEnabled: true,
  userColumn: 'owner_id',
  hasUpdatedAt: true,
};

const knowledgePointVersionsTable: TableDef = {
  name: 'knowledge_point_versions',
  columns: [
    idColumn(),
    fkRequiredColumn('knowledge_point_id'),
    integerColumn('version_number', false),
    textRequiredColumn('title'),
    textColumn('content'),
    textColumn('learning_material'),
    jsonbArrayColumn('keywords', "'[]'"),
    jsonbColumn('properties', "'{}'"),
    textColumn('change_summary'),
    fkColumn('changed_by'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_kp_versions_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_kp_versions_kp_id_version', columns: ['knowledge_point_id', 'version_number'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined, // Derived from knowledge_point -> owner_id
  hasUpdatedAt: false,
};

// --- 04_graph_structure ---
const graphNodesTable: TableDef = {
  name: 'graph_nodes',
  columns: [
    idColumn(),
    fkRequiredColumn('graph_id'),
    fkRequiredColumn('knowledge_point_id'),
    realColumn('x_position', false, '0'),
    realColumn('y_position', false, '0'),
    { name: 'level', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'normal'" },
    booleanColumn('is_accepted', '1'),
    timestampColumn('deleted_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_graph_nodes_graph_id', columns: ['graph_id'] },
    { name: 'idx_graph_nodes_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_graph_nodes_graph_kp', columns: ['graph_id', 'knowledge_point_id'], unique: true },
    { name: 'idx_graph_nodes_deleted_at', columns: ['deleted_at'] },
  ],
  syncEnabled: true,
  userColumn: undefined, // Derived from graph -> user_id
  hasDeletedAt: true,
  hasUpdatedAt: true,
};

const edgesTable: TableDef = {
  name: 'edges',
  columns: [
    idColumn(),
    fkRequiredColumn('graph_id'),
    fkColumn('source_knowledge_point_id'),
    fkColumn('target_knowledge_point_id'),
    varcharColumn('relationship_type', false, "'contains'"),
    integerColumn('weight', false, '1'),
    textColumn('custom_label'),
    textColumn('custom_color'),
    { name: 'custom_line_style', type: 'TEXT', pgType: 'TEXT', nullable: true, defaultValue: "'solid'" },
    booleanNullableColumn('show_arrow'),
    timestampColumn('deleted_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_edges_graph_id', columns: ['graph_id'] },
    { name: 'idx_edges_source_kp', columns: ['source_knowledge_point_id'] },
    { name: 'idx_edges_target_kp', columns: ['target_knowledge_point_id'] },
    { name: 'idx_edges_graph_src_tgt_rel', columns: ['graph_id', 'source_knowledge_point_id', 'target_knowledge_point_id', 'relationship_type'], unique: true },
    { name: 'idx_edges_deleted_at', columns: ['deleted_at'] },
  ],
  syncEnabled: true,
  userColumn: undefined, // Derived from graph -> user_id
  hasDeletedAt: true,
  hasUpdatedAt: true,
};

const relationshipTypesTable: TableDef = {
  name: 'relationship_types',
  columns: [
    idColumn(),
    { name: 'name', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    { name: 'display_name', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    { name: 'category', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'custom'" },
    { name: 'color', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'#6B7280'" },
    { name: 'line_style', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'solid'" },
    { name: 'show_arrow', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'auto'" },
    booleanColumn('is_builtin', '0'),
    userIdNullableColumn(),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_relationship_types_name', columns: ['name'], unique: true },
    { name: 'idx_relationship_types_user_id', columns: ['user_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 05_domains_and_collaboration ---
const domainsTable: TableDef = {
  name: 'domains',
  columns: [
    idColumn(),
    varcharColumn('name', false),
    textColumn('description'),
    varcharColumn('color', false, "'#6366F1'"),
    varcharColumn('icon'),
    fkColumn('parent_id'),
    integerColumn('sort_order', false, '0'),
    fkRequiredColumn('user_id'),
    booleanColumn('is_system', '0'),
    timestampColumn('deleted_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_domains_user_id', columns: ['user_id'] },
    { name: 'idx_domains_parent_id', columns: ['parent_id'] },
    { name: 'idx_domains_deleted_at', columns: ['deleted_at'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasDeletedAt: true,
  hasUpdatedAt: true,
};

const graphDomainsTable: TableDef = {
  name: 'graph_domains',
  columns: [
    idColumn(),
    fkRequiredColumn('graph_id'),
    fkRequiredColumn('domain_id'),
    booleanColumn('is_primary', '0'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_graph_domains_graph_id', columns: ['graph_id'] },
    { name: 'idx_graph_domains_domain_id', columns: ['domain_id'] },
  ],
  syncEnabled: true,
  userColumn: undefined, // Derived from graph -> user_id
  hasUpdatedAt: false,
};

const graphCollaboratorsTable: TableDef = {
  name: 'graph_collaborators',
  columns: [
    idColumn(),
    fkRequiredColumn('graph_id'),
    fkRequiredColumn('user_id'),
    { name: 'role', type: 'TEXT', pgType: 'collaborator_role', nullable: false, defaultValue: "'viewer'" },
    fkColumn('invited_by'),
    { name: 'invitation_token', type: 'TEXT', pgType: 'UUID', nullable: true, defaultValue: null },
    timestampColumn('invited_at'),
    timestampColumn('accepted_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_graph_collaborators_graph_id', columns: ['graph_id'] },
    { name: 'idx_graph_collaborators_user_id', columns: ['user_id'] },
    { name: 'idx_graph_collaborators_graph_user', columns: ['graph_id', 'user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const graphRelationsTable: TableDef = {
  name: 'graph_relations',
  columns: [
    idColumn(),
    fkColumn('source_graph_id'),
    fkColumn('target_graph_id'),
    { name: 'relation_type', type: 'TEXT', pgType: 'VARCHAR(50)', nullable: false, defaultValue: null },
    textColumn('context'),
    jsonbColumn('metadata', "'{}'"),
    realColumn('confidence', false, '1.0'),
    { name: 'source', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'manual'" },
    pgArrayColumn('shared_concepts', 'TEXT', "'[]'"),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_graph_relations_source', columns: ['source_graph_id'] },
    { name: 'idx_graph_relations_target', columns: ['target_graph_id'] },
    { name: 'idx_graph_relations_src_tgt_type', columns: ['source_graph_id', 'target_graph_id', 'relation_type'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const backupSnapshotsTable: TableDef = {
  name: 'backup_snapshots',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    varcharColumn('type', false),
    textRequiredColumn('file_path'),
    integerColumn('file_size', false, '0'),
    integerColumn('graphs_count', false, '0'),
    integerColumn('nodes_count', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_backup_snapshots_user_id', columns: ['user_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 06_study_and_cards ---
const quizSetsTable: TableDef = {
  name: 'quiz_sets',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkColumn('graph_id'),
    varcharColumn('title', false),
    textColumn('description'),
    jsonbColumn('config', "'{}'"),
    { name: 'status', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'draft'" },
    integerColumn('card_count', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_quiz_sets_user_id', columns: ['user_id'] },
    { name: 'idx_quiz_sets_graph_id', columns: ['graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const studyCardsTable: TableDef = {
  name: 'study_cards',
  columns: [
    idColumn(),
    fkColumn('knowledge_point_id'),
    fkColumn('user_id'),
    fkColumn('graph_id'),
    fkColumn('source_graph_id'),
    textRequiredColumn('question'),
    textRequiredColumn('answer'),
    textColumn('explanation'),
    { name: 'card_type', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'qa'" },
    jsonbNullableColumn('options'),
    integerColumn('difficulty', false, '1'),
    timestampColumn('last_reviewed'),
    timestampColumn('next_review', false),
    integerColumn('review_count', false, '0'),
    { name: 'fsrs_state', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'New'" },
    realColumn('fsrs_stability', false, '0'),
    realColumn('fsrs_difficulty', false, '0'),
    realColumn('fsrs_elapsed_days', false, '0'),
    realColumn('fsrs_scheduled_days', false, '0'),
    realColumn('fsrs_retrievability', false, '0'),
    timestampColumn('fsrs_last_review'),
    fkColumn('quiz_set_id'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_study_cards_user_id', columns: ['user_id'] },
    { name: 'idx_study_cards_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_study_cards_graph_id', columns: ['graph_id'] },
    { name: 'idx_study_cards_quiz_set_id', columns: ['quiz_set_id'] },
    { name: 'idx_study_cards_next_review', columns: ['next_review'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const quizSetCardsTable: TableDef = {
  name: 'quiz_set_cards',
  columns: [
    idColumn(),
    fkRequiredColumn('quiz_set_id'),
    fkRequiredColumn('card_id'),
    integerColumn('display_order', false, '0'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_quiz_set_cards_quiz_set_id', columns: ['quiz_set_id'] },
    { name: 'idx_quiz_set_cards_card_id', columns: ['card_id'] },
    { name: 'idx_quiz_set_cards_set_card', columns: ['quiz_set_id', 'card_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const studyProgressTable: TableDef = {
  name: 'study_progress',
  columns: [
    idColumn(),
    fkColumn('user_id'),
    fkColumn('graph_id'),
    integerColumn('total_nodes', false, '0'),
    integerColumn('mastered_nodes', false, '0'),
    realColumn('progress_percentage', false, '0'),
    integerColumn('study_streak', false, '0'),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_study_progress_user_id', columns: ['user_id'] },
    { name: 'idx_study_progress_user_graph', columns: ['user_id', 'graph_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 07_scheduler_tasks ---
const queuesTable: TableDef = {
  name: 'queues',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    textRequiredColumn('name'),
    { name: 'color', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'blue'" },
    integerColumn('time_slice', false, '30'),
    integerColumn('priority', false),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_queues_user_id', columns: ['user_id'] },
    { name: 'idx_queues_user_priority', columns: ['user_id', 'priority'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const userTasksTable: TableDef = {
  name: 'user_tasks',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    textRequiredColumn('title'),
    textColumn('description'),
    fkColumn('queue_id'),
    integerColumn('queue_level', false, '0'),
    integerColumn('position', false, '0'),
    integerColumn('estimated_duration'),
    integerColumn('actual_duration'),
    timestampColumn('deadline'),
    { name: 'status', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'pending'" },
    pgArrayColumn('tags', 'TEXT', "'[]'"),
    fkColumn('knowledge_point_id'),
    fkColumn('graph_id'),
    integerColumn('priority', false, '0'),
    { name: 'task_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'one_time'" },
    integerColumn('total_duration'),
    { name: 'progress_mode', type: 'TEXT', pgType: 'TEXT', nullable: true, defaultValue: null },
    integerColumn('progress_percentage', false, '0'),
    fkColumn('parent_task_id'),
    jsonbColumn('context', "'{}'"),
    timestampColumn('scheduled_start'),
    timestampColumn('scheduled_end'),
    textColumn('notes'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    timestampColumn('deleted_at'),
    timestampColumn('completed_at'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_tasks_user_id', columns: ['user_id'] },
    { name: 'idx_user_tasks_queue_id', columns: ['queue_id'] },
    { name: 'idx_user_tasks_status', columns: ['status'] },
    { name: 'idx_user_tasks_parent_task_id', columns: ['parent_task_id'] },
    { name: 'idx_user_tasks_graph_id', columns: ['graph_id'] },
    { name: 'idx_user_tasks_deleted_at', columns: ['deleted_at'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasDeletedAt: true,
  hasUpdatedAt: true,
};

const taskExecutionsTable: TableDef = {
  name: 'task_executions',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    fkRequiredColumn('user_id'),
    timestampColumn('started_at', false),
    timestampColumn('ended_at'),
    integerColumn('duration'),
    integerColumn('queue_level'),
    { name: 'status', type: 'TEXT', pgType: 'TEXT', nullable: true, defaultValue: null },
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_executions_task_id', columns: ['task_id'] },
    { name: 'idx_task_executions_user_id', columns: ['user_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const taskTagsTable: TableDef = {
  name: 'task_tags',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    textRequiredColumn('name'),
    { name: 'color', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'#3B82F6'" },
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_tags_user_id', columns: ['user_id'] },
    { name: 'idx_task_tags_user_name', columns: ['user_id', 'name'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const taskSettingsTable: TableDef = {
  name: 'task_settings',
  columns: [
    idColumn(),
    { name: 'user_id', type: 'TEXT', pgType: 'UUID', nullable: false, defaultValue: null },
    integerColumn('q0_time_slice', false, '25'),
    integerColumn('q1_time_slice', false, '50'),
    integerColumn('q2_time_slice', false, '100'),
    integerColumn('break_duration', false, '5'),
    booleanColumn('sound_enabled', '1'),
    booleanColumn('notification_enabled', '1'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_settings_user_id', columns: ['user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const taskDependenciesTable: TableDef = {
  name: 'task_dependencies',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    fkRequiredColumn('depends_on_task_id'),
    { name: 'dependency_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'strict'" },
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_dependencies_task_id', columns: ['task_id'] },
    { name: 'idx_task_dependencies_depends_on', columns: ['depends_on_task_id'] },
    { name: 'idx_task_dependencies_task_dep', columns: ['task_id', 'depends_on_task_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const taskSchedulesTable: TableDef = {
  name: 'task_schedules',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkRequiredColumn('task_template_id'),
    { name: 'schedule_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    jsonbColumn('schedule_config', "'{}'"),
    timestampColumn('next_run_at'),
    timestampColumn('last_run_at'),
    booleanColumn('is_active', '1'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_schedules_user_id', columns: ['user_id'] },
    { name: 'idx_task_schedules_task_template_id', columns: ['task_template_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const taskProgressPlansTable: TableDef = {
  name: 'task_progress_plans',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    dateColumn('plan_date', false),
    integerColumn('planned_percentage', false),
    integerColumn('actual_percentage', false, '0'),
    { name: 'status', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'pending'" },
    textColumn('notes'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_progress_plans_task_id', columns: ['task_id'] },
    { name: 'idx_task_progress_plans_task_date', columns: ['task_id', 'plan_date'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const userTimeSlotsTable: TableDef = {
  name: 'user_time_slots',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    integerColumn('day_of_week'),
    timeColumn('start_time', false),
    timeColumn('end_time', false),
    booleanColumn('is_available', '1'),
    textColumn('label'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_time_slots_user_id', columns: ['user_id'] },
    { name: 'idx_user_time_slots_user_day_start', columns: ['user_id', 'day_of_week', 'start_time'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const taskSubtasksTable: TableDef = {
  name: 'task_subtasks',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    textRequiredColumn('title'),
    textColumn('description'),
    { name: 'status', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'pending'" },
    integerColumn('priority', false, '0'),
    integerColumn('position', false, '0'),
    integerColumn('estimated_duration'),
    integerColumn('actual_duration'),
    timestampColumn('due_date'),
    timestampColumn('completed_at'),
    fkColumn('learning_path_node_id'),
    fkRequiredColumn('knowledge_point_id'),
    { name: 'learning_state', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'learning'" },
    timestampColumn('last_state_change_at', false),
    jsonbArrayColumn('state_history', "'[]'"),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_subtasks_task_id', columns: ['task_id'] },
    { name: 'idx_task_subtasks_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_task_subtasks_lpn_id', columns: ['learning_path_node_id'] },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: true,
};

const taskLinksTable: TableDef = {
  name: 'task_links',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    { name: 'link_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'web'" },
    textColumn('title'),
    textRequiredColumn('url'),
    textColumn('description'),
    textColumn('icon'),
    jsonbColumn('metadata', "'{}'"),
    integerColumn('position', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_links_task_id', columns: ['task_id'] },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: true,
};

const taskKnowledgePointsTable: TableDef = {
  name: 'task_knowledge_points',
  columns: [
    idColumn(),
    fkRequiredColumn('task_id'),
    fkRequiredColumn('knowledge_point_id'),
    integerColumn('relevance_score', false, '100'),
    booleanColumn('is_primary', '0'),
    textColumn('notes'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_kp_task_id', columns: ['task_id'] },
    { name: 'idx_task_kp_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_task_kp_task_kp', columns: ['task_id', 'knowledge_point_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const taskTemplatesTable: TableDef = {
  name: 'task_templates',
  columns: [
    idColumn(),
    userIdNullableColumn(),
    textRequiredColumn('name'),
    textColumn('description'),
    { name: 'category', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'custom'" },
    textRequiredColumn('title_template'),
    textColumn('description_template'),
    integerColumn('estimated_duration', false, '25'),
    pgArrayColumn('tags', 'TEXT', "'[]'"),
    integerColumn('priority', false, '2'),
    booleanColumn('is_default', '0'),
    booleanColumn('is_system', '0'),
    integerColumn('usage_count', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_templates_user_id', columns: ['user_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const taskReviewsTable: TableDef = {
  name: 'task_reviews',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkColumn('task_id'),
    { name: 'review_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    textColumn('content'),
    { name: 'mood', type: 'TEXT', pgType: 'TEXT', nullable: true, defaultValue: null },
    textColumn('difficulties'),
    textColumn('improvements'),
    textColumn('learnings'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_task_reviews_user_id', columns: ['user_id'] },
    { name: 'idx_task_reviews_task_id', columns: ['task_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const schedulerWeightProfilesTable: TableDef = {
  name: 'scheduler_weight_profiles',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    jsonbColumn('weights', '\'{"timeSlot":0.15,"mastery":0.2,"dependency":0.2,"typeMatch":0.1,"priority":0.15,"urgency":0.1,"availability":0.1}\''),
    jsonbNullableColumn('task_type_time_map'),
    { name: 'chronotype', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'balanced'" },
    timestampColumn('last_auto_adjusted_at'),
    booleanColumn('auto_adjust_enabled', '1'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_scheduler_weight_user_id', columns: ['user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 08_learning_paths ---
const learningPathsTable: TableDef = {
  name: 'learning_paths',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    textRequiredColumn('title'),
    textColumn('description'),
    textColumn('goal'),
    dateColumn('target_date'),
    fkColumn('source_graph_id'),
    fkColumn('domain_id'),
    { name: 'path_type', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'single_graph'" },
    integerColumn('total_estimated_time', false, '0'),
    booleanColumn('ai_generated', '0'),
    { name: 'status', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'active'" },
    integerColumn('daily_minutes_target', false, '30'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_learning_paths_user_id', columns: ['user_id'] },
    { name: 'idx_learning_paths_source_graph_id', columns: ['source_graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const learningPathNodesTable: TableDef = {
  name: 'learning_path_nodes',
  columns: [
    idColumn(),
    fkRequiredColumn('path_id'),
    fkColumn('knowledge_point_id'),
    fkColumn('graph_id'),
    integerColumn('order_index', false, '0'),
    textRequiredColumn('title'),
    textColumn('description'),
    integerColumn('estimated_time', false, '30'),
    booleanColumn('is_milestone', '0'),
    pgArrayColumn('prerequisites', 'UUID', "'[]'"),
    { name: 'status', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'pending'" },
    timestampColumn('started_at'),
    timestampColumn('completed_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_learning_path_nodes_path_id', columns: ['path_id'] },
    { name: 'idx_learning_path_nodes_kp_id', columns: ['knowledge_point_id'] },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: true,
};

const learningPathPrerequisitesTable: TableDef = {
  name: 'learning_path_prerequisites',
  columns: [
    idColumn(),
    fkRequiredColumn('path_node_id'),
    fkRequiredColumn('prerequisite_node_id'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_lp_prerequisites_path_node', columns: ['path_node_id'] },
    { name: 'idx_lp_prerequisites_prereq_node', columns: ['prerequisite_node_id'] },
    { name: 'idx_lp_prerequisites_pair', columns: ['path_node_id', 'prerequisite_node_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const learningPathProgressTable: TableDef = {
  name: 'learning_path_progress',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkRequiredColumn('path_id'),
    fkRequiredColumn('node_id'),
    { name: 'status', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'pending'" },
    integerColumn('progress_percentage', false, '0'),
    integerColumn('time_spent', false, '0'),
    textColumn('notes'),
    integerColumn('planned_duration', false, '0'),
    pgArrayColumn('planned_nodes', 'UUID', "'[]'"),
    timestampColumn('started_at'),
    timestampColumn('completed_at'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_lp_progress_user_id', columns: ['user_id'] },
    { name: 'idx_lp_progress_path_id', columns: ['path_id'] },
    { name: 'idx_lp_progress_node_id', columns: ['node_id'] },
    { name: 'idx_lp_progress_user_path_node', columns: ['user_id', 'path_id', 'node_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const pathNodeTasksTable: TableDef = {
  name: 'path_node_tasks',
  columns: [
    idColumn(),
    fkRequiredColumn('path_id'),
    fkRequiredColumn('node_id'),
    fkRequiredColumn('task_id'),
    fkRequiredColumn('user_id'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_path_node_tasks_path_id', columns: ['path_id'] },
    { name: 'idx_path_node_tasks_node_id', columns: ['node_id'] },
    { name: 'idx_path_node_tasks_task_id', columns: ['task_id'] },
    { name: 'idx_path_node_tasks_node_task', columns: ['node_id', 'task_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const learningLoopsTable: TableDef = {
  name: 'learning_loops',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkColumn('knowledge_point_id'),
    fkColumn('graph_id'),
    { name: 'current_stage', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'learn'" },
    realColumn('mastery_level', false, '0'),
    integerColumn('loop_count', false, '0'),
    timestampColumn('last_stage_change_at', false),
    jsonbColumn('config', "'{}'"),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    textColumn('study_mode'),
    textColumn('current_workflow_stage'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_learning_loops_user_id', columns: ['user_id'] },
    { name: 'idx_learning_loops_kp_id', columns: ['knowledge_point_id'] },
    { name: 'idx_learning_loops_graph_id', columns: ['graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 09_gamification ---
const achievementsTable: TableDef = {
  name: 'achievements',
  columns: [
    idColumn(),
    varcharColumn('code', false),
    varcharColumn('name', false),
    textColumn('description'),
    varcharColumn('category', false),
    varcharColumn('icon'),
    { name: 'color', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'#3B82F6'" },
    integerColumn('xp_reward', false, '100'),
    varcharColumn('condition_type', false),
    integerColumn('condition_value', false),
    booleanColumn('is_hidden', '0'),
    pgArrayColumn('trigger_events', 'TEXT', "'[]'"),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_achievements_code', columns: ['code'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const userAchievementsTable: TableDef = {
  name: 'user_achievements',
  columns: [
    idColumn(),
    userIdNullableColumn(),
    fkColumn('achievement_id'),
    integerColumn('progress', false, '0'),
    jsonbColumn('metadata', "'{}'"),
    timestampColumn('unlocked_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_achievements_user_id', columns: ['user_id'] },
    { name: 'idx_user_achievements_achievement_id', columns: ['achievement_id'] },
    { name: 'idx_user_achievements_user_achievement', columns: ['user_id', 'achievement_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const periodicTasksTable: TableDef = {
  name: 'periodic_tasks',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    { name: 'period_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    dateColumn('period_start', false),
    dateColumn('period_end', false),
    { name: 'task_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    integerColumn('target', false),
    integerColumn('progress', false, '0'),
    { name: 'status', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'pending'" },
    integerColumn('xp_reward', false),
    integerColumn('pass_points', false, '10'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_periodic_tasks_user_id', columns: ['user_id'] },
    { name: 'idx_periodic_tasks_user_period_type', columns: ['user_id', 'period_type', 'period_start', 'task_type'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const periodicPassesTable: TableDef = {
  name: 'periodic_passes',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    { name: 'period_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    dateColumn('period_start', false),
    dateColumn('period_end', false),
    integerColumn('total_points', false, '0'),
    integerColumn('current_level', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_periodic_passes_user_id', columns: ['user_id'] },
    { name: 'idx_periodic_passes_user_period', columns: ['user_id', 'period_type', 'period_start'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const passRewardsTable: TableDef = {
  name: 'pass_rewards',
  columns: [
    idColumn(),
    { name: 'period_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    integerColumn('level', false),
    integerColumn('points_required', false),
    { name: 'reward_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    integerColumn('reward_value'),
    textColumn('achievement_code'),
    textRequiredColumn('name'),
    textColumn('description'),
    { name: 'icon', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: "'🎁'" },
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_pass_rewards_period_level', columns: ['period_type', 'level'], unique: true },
  ],
  syncEnabled: true,
  userColumn: undefined,
  hasUpdatedAt: false,
};

const userPassProgressTable: TableDef = {
  name: 'user_pass_progress',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkRequiredColumn('pass_id'),
    integerColumn('level', false),
    booleanColumn('claimed', '0'),
    timestampColumn('claimed_at'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_pass_progress_user_id', columns: ['user_id'] },
    { name: 'idx_user_pass_progress_pass_id', columns: ['pass_id'] },
    { name: 'idx_user_pass_progress_user_pass_level', columns: ['user_id', 'pass_id', 'level'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const userFocusStatsTable: TableDef = {
  name: 'user_focus_stats',
  columns: [
    idColumn(),
    { name: 'user_id', type: 'TEXT', pgType: 'UUID', nullable: false, defaultValue: null },
    integerColumn('total_focus_seconds', false, '0'),
    integerColumn('total_sessions', false, '0'),
    integerColumn('total_pomodoros', false, '0'),
    integerColumn('total_tasks_completed', false, '0'),
    integerColumn('current_streak', false, '0'),
    integerColumn('longest_streak', false, '0'),
    integerColumn('weekly_streak', false, '0'),
    integerColumn('monthly_streak', false, '0'),
    integerColumn('quarterly_streak', false, '0'),
    integerColumn('daily_task_streak', false, '0'),
    dateColumn('last_daily_completion'),
    dateColumn('last_focus_date'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_focus_stats_user_id', columns: ['user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 10_ai_and_prompts ---
const promptTemplatesTable: TableDef = {
  name: 'prompt_templates',
  columns: [
    idColumn(),
    textRequiredColumn('code'),
    { name: 'scope', type: 'TEXT', pgType: 'prompt_scope', nullable: false, defaultValue: null },
    userIdNullableColumn(),
    fkColumn('graph_id'),
    textRequiredColumn('template_content'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_prompt_templates_code', columns: ['code'] },
    { name: 'idx_prompt_templates_user_id', columns: ['user_id'] },
    { name: 'idx_prompt_templates_graph_id', columns: ['graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const aiActionsTable: TableDef = {
  name: 'ai_actions',
  columns: [
    idColumn(),
    varcharColumn('name', false),
    textColumn('description'),
    varcharColumn('icon'),
    { name: 'target_mode', type: 'TEXT', pgType: 'VARCHAR(50)', nullable: false, defaultValue: null },
    { name: 'scope', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: null },
    userIdNullableColumn(),
    fkColumn('graph_id'),
    textRequiredColumn('prompt_template'),
    jsonbColumn('variables', "'{}'"),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_ai_actions_user_id', columns: ['user_id'] },
    { name: 'idx_ai_actions_graph_id', columns: ['graph_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const appSettingsTable: TableDef = {
  name: 'app_settings',
  columns: [
    { name: 'key', type: 'TEXT', pgType: 'VARCHAR(255)', nullable: false, defaultValue: null },
    jsonbColumn('value', "'{}'"),
    textColumn('description'),
    timestampColumn('updated_at', false),
    fkColumn('updated_by'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['key'],
  indexes: [],
  syncEnabled: false, // Global settings, not per-user
  hasUpdatedAt: true,
};

const templatesTable: TableDef = {
  name: 'templates',
  columns: [
    idColumn(),
    userIdNullableColumn(),
    varcharColumn('name', false),
    textColumn('description'),
    { name: 'category', type: 'TEXT', pgType: 'VARCHAR(20)', nullable: false, defaultValue: "'knowledge'" },
    varcharColumn('template_type'),
    booleanColumn('is_system', '0'),
    jsonbColumn('nodes', "'{}'"),
    jsonbArrayColumn('edges', "'[]'"),
    jsonbNullableColumn('layout'),
    jsonbNullableColumn('generation_config'),
    jsonbNullableColumn('preview_data'),
    pgArrayColumn('tags', 'TEXT', "'[]'"),
    varcharColumn('difficulty', false, "'medium'"),
    integerColumn('estimated_nodes', false, '10'),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_templates_user_id', columns: ['user_id'] },
    { name: 'idx_templates_category', columns: ['category'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

// --- 11_focus_and_notifications ---
const focusSessionsTable: TableDef = {
  name: 'focus_sessions',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    fkColumn('task_id'),
    timestampColumn('started_at', false),
    timestampColumn('ended_at', false),
    integerColumn('duration', false),
    { name: 'mode', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    booleanColumn('completed', '1'),
    integerColumn('pomodoro_count', false, '0'),
    textColumn('white_noise_type'),
    booleanColumn('is_break', '0'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_focus_sessions_user_id', columns: ['user_id'] },
    { name: 'idx_focus_sessions_task_id', columns: ['task_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const notificationsTable: TableDef = {
  name: 'notifications',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    varcharColumn('type', false),
    varcharColumn('title', false),
    textColumn('message'),
    jsonbColumn('data', "'{}'"),
    timestampColumn('read_at'),
    timestampColumn('created_at', false),
    timestampColumn('expires_at'),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_notifications_user_id', columns: ['user_id'] },
    { name: 'idx_notifications_read_at', columns: ['read_at'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const notificationSettingsTable: TableDef = {
  name: 'notification_settings',
  columns: [
    idColumn(),
    { name: 'user_id', type: 'TEXT', pgType: 'UUID', nullable: false, defaultValue: null },
    booleanColumn('browser_enabled', '1'),
    booleanColumn('sound_enabled', '1'),
    integerColumn('sound_volume', false, '50'),
    booleanColumn('task_start_enabled', '1'),
    booleanColumn('task_complete_enabled', '1'),
    booleanColumn('time_slice_end_enabled', '0'),
    booleanColumn('deadline_enabled', '1'),
    booleanColumn('break_enabled', '1'),
    booleanColumn('daily_summary_enabled', '0'),
    pgArrayColumn('deadline_reminder_minutes', 'INTEGER', "'[30,60]'"),
    booleanColumn('do_not_disturb_enabled', '0'),
    timeColumn('do_not_disturb_start', false),
    timeColumn('do_not_disturb_end', false),
    timestampColumn('created_at', false),
    timestampColumn('updated_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_notification_settings_user_id', columns: ['user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: true,
};

const userEfficiencyProfileTable: TableDef = {
  name: 'user_efficiency_profile',
  columns: [
    idColumn(),
    { name: 'user_id', type: 'TEXT', pgType: 'UUID', nullable: false, defaultValue: null },
    jsonbColumn('hourly_efficiency', "'{}'"),
    jsonbColumn('tag_efficiency', "'{}'"),
    jsonbColumn('queue_efficiency', "'{}'"),
    pgArrayColumn('peak_hours', 'INTEGER', "'[]'"),
    pgArrayColumn('low_hours', 'INTEGER', "'[]'"),
    timestampColumn('last_updated', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_efficiency_user_id', columns: ['user_id'], unique: true },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

const userActivitiesTable: TableDef = {
  name: 'user_activities',
  columns: [
    idColumn(),
    fkRequiredColumn('user_id'),
    { name: 'activity_type', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    textRequiredColumn('title'),
    textColumn('description'),
    timestampColumn('started_at', false),
    timestampColumn('ended_at'),
    integerColumn('duration'),
    jsonbColumn('metadata', "'{}'"),
    fkColumn('knowledge_point_id'),
    fkColumn('graph_id'),
    fkColumn('task_id'),
    timestampColumn('created_at', false),
    syncStatusColumn(),
    localUpdatedAtColumn(),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_user_activities_user_id', columns: ['user_id'] },
    { name: 'idx_user_activities_type', columns: ['activity_type'] },
    { name: 'idx_user_activities_started_at', columns: ['started_at'] },
    { name: 'idx_user_activities_kp_id', columns: ['knowledge_point_id'] },
  ],
  syncEnabled: true,
  userColumn: 'user_id',
  hasUpdatedAt: false,
};

// =====================================================
// System Tables (for sync management)
// =====================================================

const syncMetadataTable: TableDef = {
  name: 'sync_metadata',
  columns: [
    { name: 'table_name', type: 'TEXT', pgType: 'TEXT', nullable: false, defaultValue: null },
    timestampColumn('last_sync_at'),
    { name: 'sync_direction', type: 'TEXT', pgType: 'TEXT', nullable: true, defaultValue: null },
    integerColumn('record_count', false, '0'),
  ],
  primaryKey: ['table_name'],
  indexes: [],
  syncEnabled: false,
};

const syncConflictsTable: TableDef = {
  name: 'sync_conflicts',
  columns: [
    idColumn(),
    textRequiredColumn('table_name'),
    textRequiredColumn('record_id'),
    textRequiredColumn('local_data'),
    textRequiredColumn('remote_data'),
    integerColumn('resolved', false, '0'),
    timestampColumn('created_at', false),
    timestampColumn('resolved_at'),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_sync_conflicts_table_name', columns: ['table_name'] },
    { name: 'idx_sync_conflicts_resolved', columns: ['resolved'] },
  ],
  syncEnabled: false,
};

const syncOperationsTable: TableDef = {
  name: 'sync_operations',
  columns: [
    idColumn(),
    { name: 'table_name', type: 'TEXT', pgType: 'VARCHAR', nullable: false, defaultValue: null },
    { name: 'record_id', type: 'TEXT', pgType: 'UUID', nullable: false, defaultValue: null },
    { name: 'action', type: 'TEXT', pgType: 'VARCHAR', nullable: false, defaultValue: null },
    { name: 'changed_fields', type: 'TEXT', pgType: 'JSONB', nullable: true, defaultValue: null, isJsonb: true },
    { name: 'data', type: 'TEXT', pgType: 'JSONB', nullable: true, defaultValue: null, isJsonb: true },
    timestampColumn('created_at', false),
    booleanColumn('synced', '0'),
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_sync_ops_synced', columns: ['synced', 'created_at'] },
    { name: 'idx_sync_ops_table_record', columns: ['table_name', 'record_id'] },
  ],
  syncEnabled: false,
};

const schemaVersionTable: TableDef = {
  name: 'schema_version',
  columns: [
    integerColumn('version', false),
    timestampColumn('applied_at', false),
  ],
  primaryKey: ['version'],
  indexes: [],
  syncEnabled: false,
};

// =====================================================
// Export all table definitions
// =====================================================

export const TABLES: Record<string, TableDef> = {
  // 01_core_users
  users: usersTable,

  // 02_knowledge_graph
  knowledge_graphs: knowledgeGraphsTable,
  knowledge_graph_contents: knowledgeGraphContentsTable,

  // 03_knowledge_points
  knowledge_points: knowledgePointsTable,
  knowledge_point_versions: knowledgePointVersionsTable,

  // 04_graph_structure
  graph_nodes: graphNodesTable,
  edges: edgesTable,
  relationship_types: relationshipTypesTable,

  // 05_domains_and_collaboration
  domains: domainsTable,
  graph_domains: graphDomainsTable,
  graph_collaborators: graphCollaboratorsTable,
  graph_relations: graphRelationsTable,
  backup_snapshots: backupSnapshotsTable,

  // 06_study_and_cards
  quiz_sets: quizSetsTable,
  study_cards: studyCardsTable,
  quiz_set_cards: quizSetCardsTable,
  study_progress: studyProgressTable,

  // 07_scheduler_tasks
  queues: queuesTable,
  user_tasks: userTasksTable,
  task_executions: taskExecutionsTable,
  task_tags: taskTagsTable,
  task_settings: taskSettingsTable,
  task_dependencies: taskDependenciesTable,
  task_schedules: taskSchedulesTable,
  task_progress_plans: taskProgressPlansTable,
  user_time_slots: userTimeSlotsTable,
  task_subtasks: taskSubtasksTable,
  task_links: taskLinksTable,
  task_knowledge_points: taskKnowledgePointsTable,
  task_templates: taskTemplatesTable,
  task_reviews: taskReviewsTable,
  scheduler_weight_profiles: schedulerWeightProfilesTable,

  // 08_learning_paths
  learning_paths: learningPathsTable,
  learning_path_nodes: learningPathNodesTable,
  learning_path_prerequisites: learningPathPrerequisitesTable,
  learning_path_progress: learningPathProgressTable,
  path_node_tasks: pathNodeTasksTable,
  learning_loops: learningLoopsTable,

  // 09_gamification
  achievements: achievementsTable,
  user_achievements: userAchievementsTable,
  periodic_tasks: periodicTasksTable,
  periodic_passes: periodicPassesTable,
  pass_rewards: passRewardsTable,
  user_pass_progress: userPassProgressTable,
  user_focus_stats: userFocusStatsTable,

  // 10_ai_and_prompts
  prompt_templates: promptTemplatesTable,
  ai_actions: aiActionsTable,
  app_settings: appSettingsTable,
  templates: templatesTable,

  // 11_focus_and_notifications
  focus_sessions: focusSessionsTable,
  notifications: notificationsTable,
  notification_settings: notificationSettingsTable,
  user_efficiency_profile: userEfficiencyProfileTable,
  user_activities: userActivitiesTable,

  // System tables
  sync_metadata: syncMetadataTable,
  sync_conflicts: syncConflictsTable,
  sync_operations: syncOperationsTable,
  schema_version: schemaVersionTable,
};
