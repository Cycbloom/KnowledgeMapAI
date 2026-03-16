import { cacheService, CacheKeys } from "../common/cacheService.js";
import { buildNodeFromGraphNode, GRAPH_NODES_SELECT, } from "../../utils/nodeHelpers.js";
import { softDelete } from "../../utils/softDelete.js";
import { logger } from "../../utils/logger.js";
import { getLevelIndex } from "../../utils/levelUtils.js";
import { withRpcFallback } from "../../utils/rpcFallback.js";
import { checkDuplicateGraphTopic, } from "../../utils/similaritySearch.js";
import { aiService } from "../ai/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ErrorCodes } from "../../constants/errorCodes.js";
import { supabaseAdmin } from "../../supabase.js";
export class GraphService {
    async listGraphs(supabase, userId) {
        const cacheKey = CacheKeys.USER_GRAPHS(userId);
        return cacheService.getOrSet(cacheKey, async () => {
            return withRpcFallback(supabase, {
                rpcName: "get_user_graphs_with_counts",
                rpcParams: { p_user_id: userId },
                fallbackFn: () => this.listGraphsFallback(supabase, userId),
            });
        });
    }
    async listGraphsFallback(supabase, userId) {
        const { data: graphs, error } = await supabase
            .from("knowledge_graphs")
            .select("*")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("is_favorite", { ascending: false })
            .order("last_used_at", { ascending: false });
        if (error)
            throw error;
        const graphIds = graphs?.map((g) => g.id) || [];
        if (graphIds.length === 0) {
            return [];
        }
        const [nodeCountsResult, graphNodesDataResult] = await Promise.all([
            supabase
                .from("graph_nodes")
                .select("graph_id")
                .in("graph_id", graphIds)
                .is("deleted_at", null),
            supabase
                .from("graph_nodes")
                .select(`
          graph_id,
          knowledge_points (
            properties
          )
        `)
                .in("graph_id", graphIds)
                .is("deleted_at", null),
        ]);
        const countMap = new Map();
        nodeCountsResult.data?.forEach((n) => {
            countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
        });
        const tagsMap = new Map();
        graphNodesDataResult.data?.forEach((gn) => {
            const tags = gn.knowledge_points?.properties?.tags || [];
            if (!tagsMap.has(gn.graph_id)) {
                tagsMap.set(gn.graph_id, new Set());
            }
            tags.forEach((tag) => tagsMap.get(gn.graph_id).add(tag));
        });
        return (graphs?.map((g) => ({
            id: g.id,
            user_id: g.user_id,
            title: g.title,
            description: g.description,
            is_public: g.is_public,
            is_favorite: g.is_favorite,
            created_at: g.created_at,
            updated_at: g.updated_at,
            deleted_at: g.deleted_at,
            nodes_count: countMap.get(g.id) || 0,
            tags: Array.from(tagsMap.get(g.id) || []),
        })) || []);
    }
    async listTrash(supabase, userId) {
        return withRpcFallback(supabase, {
            rpcName: "get_user_trashed_graphs",
            rpcParams: { p_user_id: userId },
            fallbackFn: () => this.listTrashFallback(supabase, userId),
        });
    }
    async listTrashFallback(supabase, userId) {
        const { data: graphs, error } = await supabase
            .from("knowledge_graphs")
            .select("*")
            .eq("user_id", userId)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false });
        if (error)
            throw error;
        const graphIds = graphs?.map((g) => g.id) || [];
        if (graphIds.length === 0) {
            return [];
        }
        const { data: nodeCounts } = await supabase
            .from("graph_nodes")
            .select("graph_id")
            .in("graph_id", graphIds)
            .is("deleted_at", null);
        const countMap = new Map();
        nodeCounts?.forEach((n) => {
            countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
        });
        return (graphs?.map((g) => ({
            id: g.id,
            user_id: g.user_id,
            title: g.title,
            description: g.description,
            is_public: g.is_public,
            is_favorite: g.is_favorite,
            created_at: g.created_at,
            updated_at: g.updated_at,
            deleted_at: g.deleted_at,
            nodes_count: countMap.get(g.id) || 0,
        })) || []);
    }
    async getGraph(supabase, graphId, _userId) {
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .select("*")
            .eq("id", graphId)
            .is("deleted_at", null)
            .maybeSingle();
        if (error) {
            logger.error("getGraph error:", error);
            throw error;
        }
        return data;
    }
    async updateLastUsedAt(supabase, graphId, userId) {
        await supabase
            .from("knowledge_graphs")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", graphId)
            .eq("user_id", userId);
    }
    async createGraph(supabase, userId, title, description, options) {
        if (!options?.skipDuplicateCheck) {
            const duplicateCheck = await checkDuplicateGraphTopic(supabase, userId, title, { threshold: 0.85 });
            if (duplicateCheck.isDuplicate) {
                const similarGraph = duplicateCheck.similarGraphs[0];
                throw new AppError(`主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(similarGraph.similarity * 100).toFixed(1)}%`, 400, ErrorCodes.DUPLICATE_TOPIC);
            }
        }
        let embedding;
        try {
            embedding = await aiService.generateEmbedding(title);
        }
        catch (e) {
            logger.warn("Failed to generate embedding for graph topic:", e);
            embedding = null;
        }
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .insert({
            user_id: userId,
            title,
            description: description || null,
            embedding: embedding ?? undefined,
        })
            .select()
            .single();
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        return data;
    }
    async checkTopicDuplicate(supabase, userId, topic, excludeGraphId) {
        return checkDuplicateGraphTopic(supabase, userId, topic, {
            excludeGraphId,
        });
    }
    async updateGraphEmbedding(supabase, graphId, title) {
        try {
            const embedding = await aiService.generateEmbedding(title);
            if (embedding) {
                await supabase
                    .from("knowledge_graphs")
                    .update({ embedding })
                    .eq("id", graphId);
            }
        }
        catch (e) {
            logger.warn("Failed to update graph embedding:", e);
        }
    }
    async updateGraph(supabase, graphId, userId, updates) {
        if (updates.title) {
            const duplicateCheck = await checkDuplicateGraphTopic(supabase, userId, updates.title, {
                excludeGraphId: graphId,
            });
            if (duplicateCheck.isDuplicate) {
                const similarGraph = duplicateCheck.similarGraphs[0];
                throw new AppError(`主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(similarGraph.similarity * 100).toFixed(1)}%`, 400, ErrorCodes.DUPLICATE_TOPIC);
            }
        }
        const updateData = {
            ...updates,
            updated_at: new Date().toISOString(),
        };
        if (updates.title) {
            try {
                const embedding = await aiService.generateEmbedding(updates.title);
                if (embedding) {
                    updateData.embedding = embedding;
                }
            }
            catch (e) {
                logger.warn("Failed to generate embedding for updated graph topic:", e);
            }
        }
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .update(updateData)
            .eq("id", graphId)
            .eq("user_id", userId)
            .select()
            .single();
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        await cacheService.del(CacheKeys.GRAPH(graphId));
        return data;
    }
    async toggleFavorite(supabase, graphId, userId, isFavorite) {
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .update({
            is_favorite: isFavorite,
            updated_at: new Date().toISOString(),
        })
            .eq("id", graphId)
            .eq("user_id", userId)
            .select()
            .single();
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        return data;
    }
    async deleteGraph(supabase, graphId, userId) {
        const result = await softDelete(supabase, "knowledge_graphs", graphId);
        if (!result.success) {
            throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
        }
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        await cacheService.del(CacheKeys.GRAPH(graphId));
    }
    async restoreGraph(supabase, graphId, userId) {
        const { error } = await supabase
            .from("knowledge_graphs")
            .update({ deleted_at: null })
            .eq("id", graphId)
            .eq("user_id", userId);
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    }
    async permanentDeleteGraph(supabase, graphId, userId) {
        const { error } = await supabase
            .from("knowledge_graphs")
            .delete()
            .eq("id", graphId)
            .eq("user_id", userId);
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    }
    async restoreGraphs(supabase, graphIds, userId) {
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .update({ deleted_at: null })
            .in("id", graphIds)
            .eq("user_id", userId)
            .select("id");
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        return { count: data?.length || 0 };
    }
    async permanentDeleteGraphs(supabase, graphIds, userId) {
        const { data, error } = await supabase
            .from("knowledge_graphs")
            .delete()
            .in("id", graphIds)
            .eq("user_id", userId)
            .select("id");
        if (error)
            throw error;
        await cacheService.del(CacheKeys.USER_GRAPHS(userId));
        return { count: data?.length || 0 };
    }
    async getGraphNodes(supabase, _userId, graphId) {
        const { data: graphNodes, error: gnError } = await supabase
            .from("graph_nodes")
            .select(GRAPH_NODES_SELECT)
            .eq("graph_id", graphId)
            .is("deleted_at", null);
        if (gnError) {
            logger.error("getGraphNodes error:", gnError);
            throw gnError;
        }
        const nodes = (graphNodes || [])
            .map((gn) => {
            const node = buildNodeFromGraphNode(gn);
            if (!node)
                return null;
            return {
                id: node.id,
                graph_id: node.graph_id,
                graph_node_id: node.id,
                title: node.title,
                content: node.content,
                x_position: node.x_position,
                y_position: node.y_position,
                level: node.level,
                properties: node.properties,
                learning_material: node.learning_material,
                is_accepted: node.is_accepted,
                knowledge_point_id: node.knowledge_point_id,
                visibility: node.visibility,
                owner_id: node.owner_id,
                created_at: node.created_at,
                updated_at: node.updated_at,
            };
        })
            .filter(Boolean);
        const { data: edges, error: edgesError } = await supabase
            .from("edges")
            .select("*")
            .eq("graph_id", graphId)
            .is("deleted_at", null);
        if (edgesError)
            throw edgesError;
        return { nodes, edges: edges || [] };
    }
    async getGraphNodeStatus(supabase, userId, graphId) {
        const { data: cards, error } = await supabase
            .from("study_cards")
            .select("knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, review_count")
            .eq("user_id", userId)
            .eq("graph_id", graphId);
        if (error) {
            logger.error("getGraphNodeStatus error:", error);
            return {};
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const statusMap = {};
        (cards || []).forEach((card) => {
            const nextReview = card.next_review ? new Date(card.next_review) : null;
            const isDue = nextReview && nextReview <= now;
            const isDueToday = nextReview &&
                nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);
            const isMastered = card.fsrs_stability && card.fsrs_stability > 21;
            statusMap[card.knowledge_point_id] = {
                mastered: isMastered,
                locked: false,
                review_count: card.review_count || 0,
                next_review: card.next_review,
                due: isDue,
                due_today: isDueToday,
            };
        });
        return statusMap;
    }
    async getLearningPath(supabase, _userId, graphId) {
        const { data, error } = await supabase
            .from("learning_paths")
            .select("*")
            .eq("graph_id", graphId)
            .order("order_index", { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async analyzeGraph(supabase, userId, graphId) {
        const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);
        const validNodes = nodes.filter((n) => n !== null);
        const nodeCount = validNodes.length;
        const edgeCount = edges.length;
        const avgConnections = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;
        const levels = validNodes.reduce((acc, node) => {
            const level = typeof node.level === 'string' ? parseInt(node.level, 10) || 0 : node.level || 0;
            acc[level] = (acc[level] || 0) + 1;
            return acc;
        }, {});
        return {
            nodeCount,
            edgeCount,
            avgConnections: Math.round(avgConnections * 100) / 100,
            levels,
            density: nodeCount > 1 ? edgeCount / ((nodeCount * (nodeCount - 1)) / 2) : 0,
        };
    }
    async findMissingConnections(supabase, userId, graphId, maxSuggestions) {
        const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);
        const connectedPairs = new Set();
        edges.forEach((edge) => {
            connectedPairs.add(`${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`);
            connectedPairs.add(`${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`);
        });
        const suggestions = [];
        const validNodes = nodes.filter((n) => n !== null);
        for (let i = 0; i < validNodes.length && suggestions.length < maxSuggestions; i++) {
            for (let j = i + 1; j < validNodes.length && suggestions.length < maxSuggestions; j++) {
                const sourceId = validNodes[i].id;
                const targetId = validNodes[j].id;
                const key = `${sourceId}-${targetId}`;
                if (!connectedPairs.has(key)) {
                    const sourceLevel = getLevelIndex(validNodes[i].level) || 0;
                    const targetLevel = getLevelIndex(validNodes[j].level) || 0;
                    const score = Math.abs(sourceLevel - targetLevel);
                    suggestions.push({
                        source: sourceId,
                        target: targetId,
                        score,
                    });
                }
            }
        }
        return suggestions
            .sort((a, b) => a.score - b.score)
            .slice(0, maxSuggestions);
    }
    async getCombinedView(supabase, userId, graphIds) {
        const { data: graphs, error: graphsError } = await supabase
            .from("knowledge_graphs")
            .select("id, title")
            .in("id", graphIds)
            .eq("user_id", userId);
        if (graphsError) {
            throw graphsError;
        }
        if (!graphs || graphs.length !== graphIds.length) {
            throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
        }
        const { data: graphNodes, error: nodesError } = await supabase
            .from("graph_nodes")
            .select(`
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id
        )
      `)
            .in("graph_id", graphIds)
            .is("deleted_at", null);
        if (nodesError) {
            throw nodesError;
        }
        const { data: edges, error: edgesError } = await supabase
            .from("edges")
            .select("id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight")
            .in("graph_id", graphIds)
            .is("deleted_at", null);
        if (edgesError) {
            throw edgesError;
        }
        const graphMap = new Map(graphs.map((g) => [g.id, g]));
        const result = {
            graphs: graphIds.map((gid) => ({
                graph_id: gid,
                graph_title: graphMap.get(gid)?.title || "",
                color: "",
                nodes: (graphNodes || []).filter((gn) => gn.graph_id === gid),
                edges: (edges || []).filter((e) => e.graph_id === gid),
            })),
            shared_knowledge_points: [],
        };
        const kpGraphMap = new Map();
        (graphNodes || []).forEach((gn) => {
            const kpId = gn.knowledge_point_id;
            if (!kpGraphMap.has(kpId)) {
                kpGraphMap.set(kpId, []);
            }
            kpGraphMap.get(kpId).push(gn);
        });
        kpGraphMap.forEach((nodes, kpId) => {
            if (nodes.length > 1) {
                result.shared_knowledge_points.push({
                    knowledge_point_id: kpId,
                    knowledge_point: nodes[0].knowledge_points,
                    graph_nodes: nodes,
                });
            }
        });
        return result;
    }
}
export const graphService = new GraphService();
export async function getUserAccessibleGraphs(userId) {
    const { data: ownedGraphs, error: ownedError } = await supabaseAdmin
        .from("knowledge_graphs")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("last_used_at", { ascending: false });
    if (ownedError) {
        throw new Error(ownedError.message);
    }
    const { data: collaboratedGraphs, error: collabError } = await supabaseAdmin
        .from("graph_collaborators")
        .select(`
      role,
      graph:knowledge_graphs (*)
    `)
        .eq("user_id", userId)
        .not("accepted_at", "is", null);
    if (collabError) {
        throw new Error(collabError.message);
    }
    const ownedResults = (ownedGraphs || []).map((g) => ({
        ...g,
        user_role: "owner",
    }));
    const collabResults = (collaboratedGraphs || [])
        .filter((c) => {
        const graphData = Array.isArray(c.graph) ? c.graph[0] : c.graph;
        return graphData && !graphData.deleted_at;
    })
        .map((c) => {
        const graphData = Array.isArray(c.graph) ? c.graph[0] : c.graph;
        return {
            ...graphData,
            user_role: c.role,
        };
    });
    const allGraphs = [...ownedResults, ...collabResults];
    const uniqueGraphs = allGraphs.filter((graph, index, self) => index === self.findIndex((g) => g.id === graph.id));
    return uniqueGraphs;
}
export async function getGraphWithUserRole(graphId, userId) {
    const { data: graph, error } = await supabaseAdmin
        .from("knowledge_graphs")
        .select("*")
        .eq("id", graphId)
        .single();
    if (error) {
        return { graph: null, error: error.message };
    }
    if (!graph) {
        return { graph: null, error: "图谱不存在" };
    }
    let userRole;
    if (graph.user_id === userId) {
        userRole = "owner";
    }
    else {
        const { data: collaborator } = await supabaseAdmin
            .from("graph_collaborators")
            .select("role")
            .eq("graph_id", graphId)
            .eq("user_id", userId)
            .not("accepted_at", "is", null)
            .single();
        userRole = collaborator?.role;
    }
    return {
        graph: {
            ...graph,
            user_role: userRole,
        },
    };
}
export async function checkGraphAccess(graphId, userId, requiredRole = "viewer") {
    const { data: graph, error } = await supabaseAdmin
        .from("knowledge_graphs")
        .select("user_id, is_public")
        .eq("id", graphId)
        .single();
    if (error || !graph) {
        return { hasAccess: false, error: "图谱不存在" };
    }
    if (graph.user_id === userId) {
        return { hasAccess: true, role: "owner" };
    }
    if (graph.is_public && requiredRole === "viewer") {
        return { hasAccess: true, role: undefined };
    }
    const { data: collaborator } = await supabaseAdmin
        .from("graph_collaborators")
        .select("role")
        .eq("graph_id", graphId)
        .eq("user_id", userId)
        .not("accepted_at", "is", null)
        .single();
    if (!collaborator) {
        return { hasAccess: false, error: "无权访问此图谱" };
    }
    const role = collaborator.role;
    const roleHierarchy = {
        owner: 3,
        editor: 2,
        viewer: 1,
    };
    const hasAccess = roleHierarchy[role] >= roleHierarchy[requiredRole];
    return { hasAccess, role };
}
//# sourceMappingURL=graphService.js.map