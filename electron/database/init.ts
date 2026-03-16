import {
  initializeDatabase,
  closeDatabase,
  runMigrations,
  getMigrationStatus
} from './connection.js';

let isInitialized = false;

export function initDatabaseService(): {
  success: boolean;
  migrations: { applied: string[]; pending: string[] };
  errors: Error[];
} {
  if (isInitialized) {
    const status = getMigrationStatus();
    return {
      success: true,
      migrations: status,
      errors: []
    };
  }

  try {
    initializeDatabase();
    
    const result = runMigrations();
    
    isInitialized = true;
    
    const status = getMigrationStatus();
    
    console.log('Database initialized successfully');
    console.log(`Applied ${result.applied.length} migrations`);
    
    if (result.errors.length > 0) {
      console.error('Migration errors:', result.errors);
    }
    
    return {
      success: result.errors.length === 0,
      migrations: status,
      errors: result.errors
    };
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return {
      success: false,
      migrations: { applied: [], pending: [] },
      errors: [error as Error]
    };
  }
}

export function shutdownDatabaseService(): void {
  if (isInitialized) {
    closeDatabase();
    isInitialized = false;
    console.log('Database service shutdown complete');
  }
}

export function isDatabaseInitialized(): boolean {
  return isInitialized;
}
