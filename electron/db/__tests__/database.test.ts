/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../database';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let dbPath: string;

  beforeEach(() => {
    // Use a temp file for each test
    dbPath = path.join(os.tmpdir(), `test-knowledgemap-${Date.now()}.db`);
    dbManager = new DatabaseManager(dbPath);
  });

  afterEach(() => {
    if (dbManager.isReady()) {
      dbManager.close();
    }
    // Clean up temp file
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      // Also clean WAL and SHM files
      if (fs.existsSync(`${dbPath  }-wal`)) fs.unlinkSync(`${dbPath  }-wal`);
      if (fs.existsSync(`${dbPath  }-shm`)) fs.unlinkSync(`${dbPath  }-shm`);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize and create database file', () => {
      dbManager.initialize();
      expect(dbManager.isReady()).toBe(true);
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should create all tables on first init', () => {
      dbManager.initialize();
      const db = dbManager.getDb();

      // Check some core tables exist
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{name: string}>;
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('users');
      expect(tableNames).toContain('knowledge_graphs');
      expect(tableNames).toContain('knowledge_points');
      expect(tableNames).toContain('graph_nodes');
      expect(tableNames).toContain('edges');
      expect(tableNames).toContain('sync_metadata');
      expect(tableNames).toContain('sync_conflicts');
      expect(tableNames).toContain('schema_version');
    });

    it('should set schema version to 1', () => {
      dbManager.initialize();
      const db = dbManager.getDb();
      const row = db.prepare('SELECT version FROM schema_version').get() as { version: number };
      expect(row.version).toBe(1);
    });
  });

  describe('CRUD operations', () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it('should create and find a record by id', () => {
      const userId = crypto.randomUUID();
      const created = dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(created).toBeDefined();

      const found = dbManager.findById('users', userId);
      expect(found).toBeDefined();
      expect(found?.email).toBe('test@example.com');
      expect(found?.name).toBe('Test User');
    });

    it('should update a record', () => {
      const userId = crypto.randomUUID();
      dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const updated = dbManager.update('users', userId, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('should delete a record', () => {
      const userId = crypto.randomUUID();
      dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const deleted = dbManager.delete('users', userId);
      expect(deleted).toBe(true);

      const found = dbManager.findById('users', userId);
      expect(found).toBeNull();
    });

    it('should set sync_status to pending_push on create', () => {
      const userId = crypto.randomUUID();
      dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const found = dbManager.findById('users', userId);
      expect(found?.sync_status).toBe('pending_push');
    });

    it('should set sync_status to pending_push on update', () => {
      const userId = crypto.randomUUID();
      dbManager.batchCreate('users', [{
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      dbManager.update('users', userId, { name: 'Updated' });

      const found = dbManager.findById('users', userId);
      expect(found?.sync_status).toBe('pending_push');
    });
  });

  describe('JSONB serialization', () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it('should serialize and deserialize JSONB fields', () => {
      const graphId = crypto.randomUUID();
      const settings = { theme: 'dark', fontSize: 14 };

      dbManager.create('knowledge_graphs', {
        id: graphId,
        user_id: crypto.randomUUID(),
        title: 'Test Graph',
        settings,
        is_public: false,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const found = dbManager.findById('knowledge_graphs', graphId);
      expect(found?.settings).toEqual(settings);
    });
  });

  describe('Sync operations', () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it('should track pending push records', () => {
      const userId = crypto.randomUUID();
      dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const pending = dbManager.getPendingPush('users');
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(userId);
    });

    it('should mark records as synced', () => {
      const userId = crypto.randomUUID();
      dbManager.create('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbManager.markAsSynced('users', [userId]);

      const found = dbManager.findById('users', userId);
      expect(found?.sync_status).toBe('synced');
    });

    it('should count pending push across all tables', () => {
      dbManager.create('users', {
        id: crypto.randomUUID(),
        email: 'test1@example.com',
        name: 'User 1',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbManager.create('users', {
        id: crypto.randomUUID(),
        email: 'test2@example.com',
        name: 'User 2',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const counts = dbManager.countPendingPush();
      expect(counts.users).toBe(2);
    });

    it('should manage sync metadata', () => {
      dbManager.updateSyncMetadata('users', new Date().toISOString(), 'pull', 10);

      const metadata = dbManager.getSyncMetadata('users');
      expect(metadata).toBeDefined();
      expect(metadata?.sync_direction).toBe('pull');
      expect(metadata?.record_count).toBe(10);
    });

    it('should add and retrieve sync conflicts', () => {
      const recordId = crypto.randomUUID();
      dbManager.addSyncConflict('users', recordId, { name: 'Local' }, { name: 'Remote' });

      const conflicts = dbManager.getSyncConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].table_name).toBe('users');
      expect(conflicts[0].record_id).toBe(recordId);
    });

    it('should resolve sync conflicts', () => {
      const recordId = crypto.randomUUID();
      dbManager.addSyncConflict('users', recordId, { name: 'Local' }, { name: 'Remote' });

      const conflicts = dbManager.getSyncConflicts();
      dbManager.resolveConflict(conflicts[0].id);

      const unresolved = dbManager.getSyncConflicts();
      expect(unresolved.length).toBe(0);
    });
  });

  describe('Upsert', () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it('should insert new record on upsert', () => {
      const userId = crypto.randomUUID();
      dbManager.upsert('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        xp: 0,
        level: 1,
        sync_status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const found = dbManager.findById('users', userId);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Test User');
    });

    it('should update existing record on upsert', () => {
      const userId = crypto.randomUUID();
      dbManager.batchCreate('users', [{
        id: userId,
        email: 'test@example.com',
        name: 'Original',
        role: 'user',
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      dbManager.upsert('users', {
        id: userId,
        email: 'test@example.com',
        name: 'Upserted',
        role: 'user',
        xp: 100,
        level: 2,
        sync_status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const found = dbManager.findById('users', userId);
      expect(found?.name).toBe('Upserted');
      expect(found?.xp).toBe(100);
    });
  });
});
