import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { http, passthrough } from 'msw';
import {
  describeIfDbAvailable,
  getAdminClient,
  getAuthedClient,
  cleanTable,
} from '../../../tests/helpers/testDb';
import { server } from '../../../tests/setup/mswServer';
import { graphService } from '../../services/graph/graphService';
import { knowledgePointService } from '../../services/graph/knowledgePointService';
import { graphNodeService } from '../../services/graph/graphNodeService';
import { edgeService } from '../../services/graph/edgeService';
import { cacheService } from '../../services/common/cacheService';

/**
 * MSW passthrough helper — lets requests to local Supabase reach the real
 * server instead of being intercepted. Must be re-added in beforeEach because
 * setupTests.ts calls server.resetHandlers() in afterEach.
 */
const mswPassthroughLocalSupabase = () =>
  server.use(http.all('http://127.0.0.1:54321/*', () => passthrough()));

// Mock AI service to avoid real embedding/LLM calls during integration tests.
// generateEmbedding returns null → checkDuplicateGraphTopic returns isDuplicate=false,
// and no embedding vector is stored.
vi.mock('../../services/ai/aiService', () => ({
  aiService: {
    generateEmbedding: vi.fn().mockResolvedValue(null),
  },
}));

// Mock logger to keep test output clean
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphRow {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  deleted_at: string | null;
  is_public: boolean;
  is_favorite: boolean;
}

interface GraphListItem {
  id: string;
  title: string;
  user_id: string;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'test123456';
const USER_B_PASSWORD = 'test123456';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describeIfDbAvailable('GraphService Integration', () => {
  let adminClient: SupabaseClient;
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let userBEmail: string;

  beforeAll(async () => {
    // Let MSW pass through requests to local Supabase (server.listen was
    // started in setupTests.ts; resetHandlers in afterEach removes overrides).
    mswPassthroughLocalSupabase();

    adminClient = getAdminClient();

    // Sign in as test user (User A)
    userAClient = await getAuthedClient(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    const { data: authData } = await userAClient.auth.getUser();
    userAId = authData.user?.id ?? '';
    if (!userAId) throw new Error('Failed to get test user ID');

    // Create User B for isolation tests
    userBEmail = `test-b-${Date.now()}@example.com`;
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: userBEmail,
        password: USER_B_PASSWORD,
        email_confirm: true,
      });
    if (createError) throw createError;
    userBId = newUser.user?.id ?? '';
    if (!userBId) throw new Error('Failed to create user B');

    // Sign in as User B
    userBClient = await getAuthedClient(userBEmail, USER_B_PASSWORD);
  });

  afterAll(async () => {
    // Re-add passthrough (afterEach in setupTests.ts calls server.resetHandlers)
    mswPassthroughLocalSupabase();

    // Clean up User B
    if (userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
    }
  });

  beforeEach(async () => {
    // Re-add passthrough (afterEach in setupTests.ts calls server.resetHandlers)
    mswPassthroughLocalSupabase();

    // Clean tables — CASCADE handles child tables (graph_nodes, edges,
    // graph_events, graph_snapshots, graph_backbone_modules, note_node_links, etc.)
    await cleanTable('knowledge_graphs');
    await cleanTable('knowledge_points');

    // Clear cache to ensure test isolation (listGraphs caches results)
    await cacheService.invalidateByUserId(userAId);
    await cacheService.invalidateByUserId(userBId);
  });

  // ===========================================================================
  // Graph CRUD
  // ===========================================================================

  describe('Graph CRUD', () => {
    it('should create a graph and verify it exists in DB', async () => {
      const graph = (await graphService.createGraph(
        adminClient,
        userAId,
        '测试图谱',
        '测试描述',
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      expect(graph).toBeDefined();
      expect(graph.id).toBeDefined();
      expect(graph.title).toBe('测试图谱');
      expect(graph.description).toBe('测试描述');
      expect(graph.user_id).toBe(userAId);
      expect(graph.deleted_at).toBeNull();

      // Verify directly in DB
      const { data: dbGraph, error } = await adminClient
        .from('knowledge_graphs')
        .select('*')
        .eq('id', graph.id)
        .single();

      expect(error).toBeNull();
      expect(dbGraph).not.toBeNull();
      expect(dbGraph?.title).toBe('测试图谱');
      expect(dbGraph?.description).toBe('测试描述');
      expect(dbGraph?.user_id).toBe(userAId);
    });

    it('should get a graph by ID', async () => {
      const created = (await graphService.createGraph(
        adminClient,
        userAId,
        '获取测试图谱',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      const fetched = (await graphService.getGraph(
        adminClient,
        created.id,
        null,
      )) as unknown as GraphRow | null;

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.title).toBe('获取测试图谱');
      expect(fetched?.user_id).toBe(userAId);
    });

    it('should list graphs for a user', async () => {
      // Create multiple graphs
      await graphService.createGraph(adminClient, userAId, '图谱A', undefined, {
        skipDuplicateCheck: true,
      });
      await graphService.createGraph(adminClient, userAId, '图谱B', undefined, {
        skipDuplicateCheck: true,
      });
      await graphService.createGraph(adminClient, userAId, '图谱C', undefined, {
        skipDuplicateCheck: true,
      });

      const graphs = (await graphService.listGraphs(
        adminClient,
        userAId,
      )) as unknown as GraphListItem[];

      expect(graphs).toHaveLength(3);
      const titles = graphs.map((g) => g.title).sort();
      expect(titles).toEqual(['图谱A', '图谱B', '图谱C']);
    });

    it('should update a graph title', async () => {
      const created = (await graphService.createGraph(
        adminClient,
        userAId,
        '旧标题',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      const updated = (await graphService.updateGraph(adminClient, created.id, userAId, {
        title: '新标题',
      })) as unknown as GraphRow;

      expect(updated.title).toBe('新标题');

      // Verify in DB
      const { data: dbGraph } = await adminClient
        .from('knowledge_graphs')
        .select('title')
        .eq('id', created.id)
        .single();

      expect(dbGraph?.title).toBe('新标题');
    });

    it('should soft delete a graph', async () => {
      const created = (await graphService.createGraph(
        adminClient,
        userAId,
        '删除测试',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      await graphService.deleteGraph(adminClient, created.id, userAId);

      // Verify deleted_at is set in DB
      const { data: dbGraph } = await adminClient
        .from('knowledge_graphs')
        .select('deleted_at')
        .eq('id', created.id)
        .single();

      expect(dbGraph?.deleted_at).not.toBeNull();

      // getGraph should return null (notDeleted filter excludes soft-deleted)
      const fetched = await graphService.getGraph(adminClient, created.id, null);
      expect(fetched).toBeNull();
    });
  });

  // ===========================================================================
  // Node CRUD
  // ===========================================================================

  describe('Node CRUD', () => {
    it('should create, get, update position, and remove a node in a graph', async () => {
      // Create graph
      const graph = (await graphService.createGraph(
        adminClient,
        userAId,
        '节点测试图谱',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      // Create knowledge point
      const kp = await knowledgePointService.create(adminClient, {
        title: '测试知识点',
        content: '测试内容',
        owner_id: userAId,
      });

      // Add to graph
      const node = await graphNodeService.addToGraph(adminClient, {
        graph_id: graph.id,
        knowledge_point_id: kp.id,
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.graph_id).toBe(graph.id);
      expect(node.knowledge_point_id).toBe(kp.id);

      // Get graph nodes — should have 1 node
      const nodes = await graphNodeService.getGraphNodes(adminClient, graph.id);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(node.id);

      // addToGraph returns a Node where id = knowledge_point_id (for frontend
      // graph visualization). updatePosition/removeFromGraph expect the
      // graph_nodes row UUID (DB primary key), so fetch it directly.
      const { data: graphNodeRow } = await adminClient
        .from('graph_nodes')
        .select('id')
        .eq('graph_id', graph.id)
        .eq('knowledge_point_id', kp.id)
        .is('deleted_at', null)
        .single();
      const graphNodeId = graphNodeRow?.id ?? '';
      expect(graphNodeId).not.toBe('');

      // Update position
      const updated = await graphNodeService.updatePosition(
        adminClient,
        graphNodeId,
        100,
        200,
      );

      expect(updated.x_position).toBe(100);
      expect(updated.y_position).toBe(200);

      // Remove from graph (soft delete)
      await graphNodeService.removeFromGraph(adminClient, graphNodeId, graph.id);

      // Verify node is soft deleted — getGraphNodes uses notDeleted filter
      const remainingNodes = await graphNodeService.getGraphNodes(adminClient, graph.id);
      expect(remainingNodes).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Edges
  // ===========================================================================

  describe('Edges', () => {
    it('should create an edge between two nodes and verify it exists', async () => {
      // Create graph
      const graph = (await graphService.createGraph(
        adminClient,
        userAId,
        '边测试图谱',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      // Create two knowledge points
      const kp1 = await knowledgePointService.create(adminClient, {
        title: '源知识点',
        content: '内容1',
        owner_id: userAId,
      });
      const kp2 = await knowledgePointService.create(adminClient, {
        title: '目标知识点',
        content: '内容2',
        owner_id: userAId,
      });

      // Add both to graph as nodes
      await graphNodeService.addToGraph(adminClient, {
        graph_id: graph.id,
        knowledge_point_id: kp1.id,
      });
      await graphNodeService.addToGraph(adminClient, {
        graph_id: graph.id,
        knowledge_point_id: kp2.id,
      });

      // Create edge between the two knowledge points
      const edge = await edgeService.create(adminClient, {
        graph_id: graph.id,
        source_knowledge_point_id: kp1.id,
        target_knowledge_point_id: kp2.id,
        relationship_type: 'contains',
      });

      expect(edge).toBeDefined();
      expect(edge.id).toBeDefined();
      expect(edge.graph_id).toBe(graph.id);
      expect(edge.source_knowledge_point_id).toBe(kp1.id);
      expect(edge.target_knowledge_point_id).toBe(kp2.id);
      expect(edge.relationship_type).toBe('contains');

      // Verify edge exists via getGraphEdges
      const edges = await edgeService.getGraphEdges(adminClient, graph.id);
      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe(edge.id);
      expect(edges[0].relationship_type).toBe('contains');
    });
  });

  // ===========================================================================
  // User Isolation (RLS)
  // ===========================================================================

  describe('User Isolation (RLS)', () => {
    it("should not show user A's graphs to user B", async () => {
      // Create a graph as user A using user A's authed client (RLS-enforced)
      const graph = (await graphService.createGraph(
        userAClient,
        userAId,
        '用户A的图谱',
        undefined,
        { skipDuplicateCheck: true },
      )) as unknown as GraphRow;

      expect(graph.user_id).toBe(userAId);

      // List graphs as user B — should not include user A's graph
      const userBGraphs = (await graphService.listGraphs(
        userBClient,
        userBId,
      )) as unknown as GraphListItem[];

      const userBGraphIds = userBGraphs.map((g) => g.id);
      expect(userBGraphIds).not.toContain(graph.id);

      // User B should have 0 graphs (we only created user A's graph)
      expect(userBGraphs).toHaveLength(0);
    });
  });
});
