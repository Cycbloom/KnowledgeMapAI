import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

// Types
interface InterferencePair {
  kpId1: string;
  kpId2: string;
  similarity: number;
}

interface SemanticGroup {
  groupId: number;
  memberKpIds: string[];
  avgSimilarity: number;
}

interface SemanticSpacedItem {
  id: string;
  knowledgePointId: string;
}

const DEFAULT_INTERFERENCE_THRESHOLD = 0.75;
const MAX_SEMANTIC_SORT_SIZE = 100;

class SemanticInterferenceService {
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    // Validate inputs
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Detect interference pairs from a list of knowledge point IDs
   * Returns pairs with similarity above threshold, sorted by similarity descending
   */
  async detectInterferencePairs(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
    threshold: number = DEFAULT_INTERFERENCE_THRESHOLD,
  ): Promise<InterferencePair[]> {
    if (knowledgePointIds.length < 2) return [];

    // Batch query embeddings
    const embeddings = await this.fetchEmbeddings(supabase, knowledgePointIds);

    const pairs: InterferencePair[] = [];
    const ids = Array.from(embeddings.keys());

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const emb1 = embeddings.get(ids[i]);
        const emb2 = embeddings.get(ids[j]);
        if (!emb1 || !emb2) continue;

        const similarity = this.calculateCosineSimilarity(emb1, emb2);
        if (similarity >= threshold) {
          pairs.push({
            kpId1: ids[i],
            kpId2: ids[j],
            similarity: Math.round(similarity * 10000) / 10000,
          });
        }
      }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Group knowledge points by semantic similarity using union-find clustering
   */
  async getSemanticGroups(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
    threshold: number = DEFAULT_INTERFERENCE_THRESHOLD,
  ): Promise<SemanticGroup[]> {
    if (knowledgePointIds.length < 2) return [];

    const pairs = await this.detectInterferencePairs(supabase, knowledgePointIds, threshold);
    if (pairs.length === 0) return [];

    // Union-Find clustering
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x) ?? x));
      }
      return parent.get(x) ?? x;
    };
    const union = (x: string, y: string) => {
      const px = find(x);
      const py = find(y);
      if (px !== py) parent.set(px, py);
    };

    // Initialize
    for (const id of knowledgePointIds) {
      parent.set(id, id);
    }

    // Union similar pairs
    for (const pair of pairs) {
      union(pair.kpId1, pair.kpId2);
    }

    // Collect groups
    const groupMap = new Map<string, string[]>();
    for (const id of knowledgePointIds) {
      const root = find(id);
      if (!groupMap.has(root)) groupMap.set(root, []);
      const list = groupMap.get(root);
      if (list) {
        list.push(id);
      }
    }

    // Filter to groups with 2+ members, compute avg similarity
    const groups: SemanticGroup[] = [];
    let groupIndex = 0;
    for (const [_root, members] of groupMap) {
      if (members.length < 2) continue;

      // Calculate average similarity within group
      let totalSim = 0;
      let simCount = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const pair = pairs.find(
            (p) =>
              (p.kpId1 === members[i] && p.kpId2 === members[j]) ||
              (p.kpId1 === members[j] && p.kpId2 === members[i]),
          );
          if (pair) {
            totalSim += pair.similarity;
            simCount++;
          }
        }
      }

      groups.push({
        groupId: groupIndex++,
        memberKpIds: members,
        avgSimilarity: simCount > 0 ? Math.round((totalSim / simCount) * 10000) / 10000 : 0,
      });
    }

    return groups;
  }

  /**
   * Reorder review items to maximize semantic distance between adjacent items
   * Uses a greedy algorithm: always pick the item most dissimilar to the last picked item
   */
  async getSemanticSpacedOrder<T extends SemanticSpacedItem>(
    supabase: SupabaseClient,
    items: T[],
  ): Promise<T[]> {
    if (items.length <= 2) return items;

    // Collect unique knowledge point IDs
    const kpIds = [...new Set(items.map((item) => item.knowledgePointId))];

    // Fetch embeddings
    const embeddings = await this.fetchEmbeddings(supabase, kpIds);

    // If no embeddings available, return original order
    if (embeddings.size === 0) return items;

    // Build kpId -> embedding map
    const embMap = new Map<string, number[]>();
    for (const [id, emb] of embeddings) {
      embMap.set(id, emb);
    }

    // Limit for performance
    const itemsToSort = items.slice(0, MAX_SEMANTIC_SORT_SIZE);
    const remaining = items.slice(MAX_SEMANTIC_SORT_SIZE);

    // Greedy: start with first item that has embedding, then pick most dissimilar
    const sorted: T[] = [];
    const available = new Set<number>();

    for (let i = 0; i < itemsToSort.length; i++) {
      available.add(i);
    }

    // Start with the first item that has an embedding
    let currentIdx = -1;
    for (let i = 0; i < itemsToSort.length; i++) {
      if (embMap.has(itemsToSort[i].knowledgePointId)) {
        currentIdx = i;
        break;
      }
    }

    if (currentIdx === -1) return items; // No embeddings at all

    sorted.push(itemsToSort[currentIdx]);
    available.delete(currentIdx);

    while (available.size > 0) {
      const currentEmb = embMap.get(itemsToSort[currentIdx].knowledgePointId);
      let bestIdx = -1;
      let bestSimilarity = Infinity; // We want the LEAST similar (most distant)

      for (const idx of available) {
        const candidateEmb = embMap.get(itemsToSort[idx].knowledgePointId);
        if (!candidateEmb || !currentEmb) {
          // Items without embedding get neutral treatment
          if (bestSimilarity > 0.5) {
            bestSimilarity = 0.5;
            bestIdx = idx;
          }
          continue;
        }

        const sim = this.calculateCosineSimilarity(currentEmb, candidateEmb);
        if (sim < bestSimilarity) {
          bestSimilarity = sim;
          bestIdx = idx;
        }
      }

      if (bestIdx === -1) break;

      sorted.push(itemsToSort[bestIdx]);
      available.delete(bestIdx);
      currentIdx = bestIdx;
    }

    // Add any remaining items that weren't picked
    for (const idx of available) {
      sorted.push(itemsToSort[idx]);
    }

    return [...sorted, ...remaining];
  }

  /**
   * Fetch embeddings for a list of knowledge point IDs from the database
   */
  private async fetchEmbeddings(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();

    if (knowledgePointIds.length === 0) return result;

    try {
      const { data, error } = await supabase
        .from("knowledge_points")
        .select("id, embedding")
        .in("id", knowledgePointIds);

      if (error) {
        logger.error("[SemanticInterference] Failed to fetch embeddings:", error);
        return result;
      }

      for (const row of data ?? []) {
        if (row.embedding && Array.isArray(row.embedding)) {
          result.set(row.id, row.embedding as number[]);
        }
      }
    } catch (error) {
      logger.error("[SemanticInterference] Error fetching embeddings:", error);
    }

    return result;
  }
}

export const semanticInterferenceService = new SemanticInterferenceService();
export { SemanticInterferenceService };
export type { InterferencePair, SemanticGroup, SemanticSpacedItem };
