import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { conceptAggregationService, normalizeTitle } from '../graph/conceptAggregationService';
import { autoGraphService } from '../graph/index';
import { aiService } from '../ai/aiService';
import { cacheService, CacheKeys } from '../common/cacheService';
import { performanceMonitor } from '../ai/performanceMonitor';
import type { ExtractedConcept, LiteratureInfo, ConceptSource, ReferenceBook } from '@shared/types/graph';
import { BackboneModule, TITLE_TO_BACKBONE_MODULE } from '@shared/types/graph';

const MERGE_THRESHOLD = parseFloat(process.env.CONCEPT_MERGE_THRESHOLD || "0.85");
const FUZZY_TITLE_CONFIRM_THRESHOLD = 0.75;

class LiteratureApplyService {
  async applyLiterature(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    concepts: ExtractedConcept[],
    relations: Array<{ source: string; target: string; type: string; confidence: number }>,
    literature: LiteratureInfo,
  ): Promise<{
    success: boolean;
    addedCount: number;
    mergedCount: number;
    nodeMapping: Record<string, string>;
    mountingDetails: Array<{
      conceptTitle: string;
      targetModule?: BackboneModule;
      mountedTo: string | null;
      status: "success" | "failed";
      reason?: string;
    }>;
  }> {
    const startTime = Date.now();

    try {
      logger.info("Applying literature concepts", {
        graphId: graphId,
        conceptCount: concepts.length,
        relationCount: relations.length,
        literatureTitle: literature.title,
        userId: userId,
      });

      const nodeMapping: Record<string, string> = {};
      let addedCount = 0;
      let mergedCount = 0;

      // Track mounting statistics
      const mountingDetails: Array<{
        conceptTitle: string;
        targetModule?: BackboneModule;
        mountedTo: string | null;
        status: "success" | "failed";
        reason?: string;
      }> = [];

      const conceptsToProcess: ExtractedConcept[] = concepts;

      const { data: existingGraphNodes } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          knowledge_point_id,
          level,
          knowledge_points (
            id,
            title,
            embedding,
            properties
          )
        `,
        )
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      const existingNodesMap = new Map<
        string,
        { id: string; title: string; embedding?: number[] | undefined }
      >();

      const normalizedTitleMap = new Map<
        string,
        { id: string; title: string; embedding?: number[] | undefined }
      >();

      if (existingGraphNodes) {
        for (const gn of existingGraphNodes) {
          const kp = gn.knowledge_points as unknown as {
            id: string;
            title: string;
            embedding?: number[];
          };
          if (kp) {
            existingNodesMap.set(kp.id, {
              id: kp.id,
              title: kp.title,
              embedding: kp.embedding,
            });
            normalizedTitleMap.set(normalizeTitle(kp.title), {
              id: kp.id,
              title: kp.title,
              embedding: kp.embedding,
            });
          }
        }
      }

      logger.info("Existing nodes loaded", {
        existingNodeCount: existingNodesMap.size,
        normalizedTitleCount: normalizedTitleMap.size,
      });

      const conceptSource: ConceptSource = {
        title: literature.title,
        authors: literature.authors,
        year: literature.year,
        url: literature.url,
        fileName: literature.fileName,
        addedAt: new Date().toISOString(),
      };

      // Save complete literature metadata to literature_sources table
      try {
        const { data: existingLiterature, error: litError } = await supabase
          .from("literature_sources")
          .select("id")
          .eq("graph_id", graphId)
          .eq("title", literature.title)
          .maybeSingle();

        if (litError) {
          logger.warn(
            "Failed to check existing literature source:",
            litError.message,
          );
        }

        if (!existingLiterature) {
          const { error: insertLitError } = await supabase
            .from("literature_sources")
            .insert({
              graph_id: graphId,
              title: literature.title,
              authors: literature.authors,
              year: literature.year,
              type: literature.type || "document",
              journal: literature.journal,
              doi: literature.doi,
              url: literature.url,
              file_name: literature.fileName,
              keywords: literature.keywords,
              abstract: literature.abstract,
              volume: (literature as { volume?: string }).volume,
              issue: (literature as { issue?: string }).issue,
              pages: (literature as { pages?: string }).pages,
              publisher: (literature as { publisher?: string }).publisher,
              notes: (literature as { notes?: string }).notes,
            });

          if (insertLitError) {
            logger.warn(
              "Failed to save literature source:",
              insertLitError.message,
            );
          } else {
            logger.info("Literature source saved successfully", {
              title: literature.title,
              type: literature.type,
            });
          }
        } else {
          const existingData = existingLiterature as {
            id: string;
            journal?: string;
            doi?: string;
            keywords?: string[];
            abstract?: string;
          };
          const updateData: {
            journal?: string;
            doi?: string;
            keywords?: string[];
            abstract?: string;
          } = {};
          if (!existingData.journal && literature.journal)
            updateData.journal = literature.journal;
          if (!existingData.doi && literature.doi)
            updateData.doi = literature.doi;
          if (!existingData.keywords?.length && literature.keywords?.length)
            updateData.keywords = literature.keywords;
          if (!existingData.abstract && literature.abstract)
            updateData.abstract = literature.abstract;

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("literature_sources")
              .update(updateData)
              .eq("id", existingLiterature.id);
          }
        }
      } catch (litSaveError) {
        logger.warn("Exception while saving literature source:", litSaveError);
      }

      let titleDedupCount = 0;
      const remainingConcepts: (ExtractedConcept & {
        originalIndex: number;
      })[] = [];

      for (let i = 0; i < conceptsToProcess.length; i++) {
        const concept = conceptsToProcess[i];
        const normTitle = normalizeTitle(concept.title);

        const existingMatch = normalizedTitleMap.get(normTitle);
        if (existingMatch) {
          const upgradeResult =
            await conceptAggregationService.upgradeNodeLevel(
              supabase,
              existingMatch.id,
              [conceptSource],
            );

          if (upgradeResult.success) {
            const { data: existingGN } = await supabase
              .from("graph_nodes")
              .select("id")
              .eq("knowledge_point_id", existingMatch.id)
              .eq("graph_id", graphId)
              .is("deleted_at", null)
              .single();

            if (existingGN) {
              nodeMapping[concept.title] = existingMatch.id;
              mergedCount++;
              titleDedupCount++;
              logger.info(
                `Title dedup: "${concept.title}" merged with existing "${existingMatch.title}"`,
              );
              continue;
            }
          }
        }

        const batchDuplicate = remainingConcepts.find(
          (rc) => normalizeTitle(rc.title) === normTitle,
        );
        if (batchDuplicate) {
          if (concept.description.length > batchDuplicate.description.length) {
            batchDuplicate.description = concept.description;
          }
          logger.info(
            `Batch title dedup: "${concept.title}" merged with "${batchDuplicate.title}"`,
          );
          continue;
        }

        remainingConcepts.push({ ...concept, originalIndex: i });
      }

      logger.info("Title dedup completed", {
        titleDedupCount,
        remainingCount: remainingConcepts.length,
      });

      const conceptsWithEmbedding: Array<{
        concept: ExtractedConcept;
        embedding: number[] | null;
        originalIndex?: number;
      }> = [];

      logger.info("Processing concepts for embedding", {
        totalConcepts: remainingConcepts.length,
        conceptTitles: remainingConcepts.map((c) => c.title),
      });

      const conceptTexts = remainingConcepts.map(
        (c) => `${c.title}: ${c.description}`,
      );
      const batchEmbeddings =
        await aiService.generateEmbeddingsBatch(conceptTexts);

      for (let i = 0; i < remainingConcepts.length; i++) {
        const concept = remainingConcepts[i];
        const embedding = batchEmbeddings[i] ?? null;
        if (embedding === null) {
          logger.warn(
            `Failed to generate embedding for concept: ${concept.title}`,
          );
        }
        conceptsWithEmbedding.push({
          concept,
          embedding,
          originalIndex: concept.originalIndex,
        });
      }

      const successCount = conceptsWithEmbedding.filter(
        (c) => c.embedding !== null,
      ).length;
      logger.info("Embeddings generated", {
        successCount,
        failedCount: remainingConcepts.length - successCount,
      });

      const nodesToCreate: Array<{
        tempId: string;
        title: string;
        content: string;
        summary?: string;
        level: string;
        x_position: number;
        y_position: number;
        targetModule?: BackboneModule;
        source: ConceptSource;
      }> = [];

      for (let i = 0; i < conceptsWithEmbedding.length; i++) {
        const { concept, embedding } = conceptsWithEmbedding[i];
        let merged = false;

        if (embedding) {
          let fuzzyTitleMatched = false;
          const normConceptTitle = normalizeTitle(concept.title);
          for (const [, existingNode] of normalizedTitleMap) {
            const normExisting = normalizeTitle(existingNode.title);
            if (
              normConceptTitle.includes(normExisting) ||
              normExisting.includes(normConceptTitle)
            ) {
              if (!existingNode.embedding) continue;
              const titleSimilarity =
                await conceptAggregationService.calculateSimilarity(
                  embedding,
                  existingNode.embedding,
                );
              if (titleSimilarity >= FUZZY_TITLE_CONFIRM_THRESHOLD) {
                const upgradeResult =
                  await conceptAggregationService.upgradeNodeLevel(
                    supabase,
                    existingNode.id,
                    [conceptSource],
                  );
                if (upgradeResult.success) {
                  const { data: existingGN } = await supabase
                    .from("graph_nodes")
                    .select("id")
                    .eq("knowledge_point_id", existingNode.id)
                    .eq("graph_id", graphId)
                    .is("deleted_at", null)
                    .single();
                  if (existingGN) {
                    nodeMapping[concept.title] = existingNode.id;
                    merged = true;
                    mergedCount++;
                    fuzzyTitleMatched = true;
                    logger.info(
                      `Fuzzy title merge: "${concept.title}" matched existing "${existingNode.title}" (sim: ${titleSimilarity.toFixed(3)})`,
                    );
                    break;
                  }
                }
              }
            }
          }
          if (fuzzyTitleMatched) continue;

          try {
            const { data: similarResults, error: rpcError } =
              await supabase.rpc("match_knowledge_points", {
                query_embedding: embedding,
                match_threshold: MERGE_THRESHOLD,
                match_count: 5,
              });

            if (!rpcError && similarResults && Array.isArray(similarResults)) {
              for (const similar of similarResults) {
                const existingNode = existingNodesMap.get(similar.id);
                if (!existingNode) continue;

                if (similar.similarity >= MERGE_THRESHOLD) {
                  const upgradeResult =
                    await conceptAggregationService.upgradeNodeLevel(
                      supabase,
                      similar.id,
                      [conceptSource],
                    );

                  if (upgradeResult.success) {
                    const { data: existingGN } = await supabase
                      .from("graph_nodes")
                      .select("id")
                      .eq("knowledge_point_id", similar.id)
                      .eq("graph_id", graphId)
                      .is("deleted_at", null)
                      .single();

                    if (existingGN) {
                      nodeMapping[concept.title] = similar.id;
                      merged = true;
                      mergedCount++;
                      logger.info(
                        `Merged concept "${concept.title}" with existing "${existingNode.title}" (pgvector)`,
                      );
                      break;
                    }
                  }
                }
              }
            } else {
              logger.warn(
                "pgvector RPC failed, falling back to in-memory similarity",
              );
              for (const [existingId, existingNode] of existingNodesMap) {
                if (!existingNode.embedding) continue;
                const similarity =
                  await conceptAggregationService.calculateSimilarity(
                    embedding,
                    existingNode.embedding,
                  );

                if (similarity >= MERGE_THRESHOLD) {
                  const upgradeResult =
                    await conceptAggregationService.upgradeNodeLevel(
                      supabase,
                      existingId,
                      [conceptSource],
                    );

                  if (upgradeResult.success) {
                    const { data: existingGN } = await supabase
                      .from("graph_nodes")
                      .select("id")
                      .eq("knowledge_point_id", existingId)
                      .eq("graph_id", graphId)
                      .is("deleted_at", null)
                      .single();

                    if (existingGN) {
                      nodeMapping[concept.title] = existingId;
                      merged = true;
                      mergedCount++;
                      logger.info(
                        `Merged concept "${concept.title}" with existing "${existingNode.title}"`,
                      );
                      break;
                    }
                  }
                }
              }
            }
          } catch (rpcException) {
            logger.warn(
              "pgvector RPC exception, falling back to in-memory similarity",
            );
            for (const [existingId, existingNode] of existingNodesMap) {
              if (!existingNode.embedding) continue;
              const similarity =
                await conceptAggregationService.calculateSimilarity(
                  embedding,
                  existingNode.embedding,
                );

              if (similarity >= MERGE_THRESHOLD) {
                const upgradeResult =
                  await conceptAggregationService.upgradeNodeLevel(
                    supabase,
                    existingId,
                    [conceptSource],
                  );

                if (upgradeResult.success) {
                  const { data: existingGN } = await supabase
                    .from("graph_nodes")
                    .select("id")
                    .eq("knowledge_point_id", existingId)
                    .eq("graph_id", graphId)
                    .is("deleted_at", null)
                    .single();

                  if (existingGN) {
                    nodeMapping[concept.title] = existingId;
                    merged = true;
                    mergedCount++;
                    break;
                  }
                }
              }
            }
          }
        }

        if (!merged) {
          const angle = (i / conceptsWithEmbedding.length) * Math.PI * 2;
          const radius = 15 + i * 2;
          nodesToCreate.push({
            tempId: concept.title,
            title: concept.title,
            content: concept.description,
            summary: concept.summary,
            level: "normal",
            x_position: Math.round(Math.cos(angle) * radius),
            y_position: Math.round(Math.sin(angle) * radius),
            targetModule: concept.targetModule,
            source: conceptSource,
          });
        }
      }

      logger.info("Nodes to create determined", {
        nodesToCreateCount: nodesToCreate.length,
        mergedCount,
        conceptsWithEmbeddingCount: conceptsWithEmbedding.length,
      });

      const { data: backboneNodes } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          level,
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            properties
          )
        `,
        )
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      const backboneModuleMap = new Map<BackboneModule, string>();
      const backboneNodeIds = new Set<string>();

      if (backboneNodes) {
        for (const gn of backboneNodes) {
          if (gn.level !== "root" && gn.level !== "core") {
            continue;
          }

          const kp = gn.knowledge_points as unknown as {
            id: string;
            title: string;
            properties?: { backboneModule?: BackboneModule };
          };

          if (!kp) continue;

          let moduleValue = kp?.properties?.backboneModule;

          if (!moduleValue) {
            const matchedModule = TITLE_TO_BACKBONE_MODULE[kp.title.trim()];
            if (matchedModule) {
              moduleValue = matchedModule;
              logger.info(`Auto-matched backbone node by title`, {
                nodeId: gn.id,
                nodeTitle: kp.title,
                matchedModule,
              });
            }
          }

          if (moduleValue && !backboneModuleMap.has(moduleValue)) {
            backboneModuleMap.set(moduleValue, gn.id);
            backboneNodeIds.add(gn.id);
          }
        }
      }

      logger.info("Backbone nodes loaded", {
        backboneModuleCount: backboneModuleMap.size,
        modules: Array.from(backboneModuleMap.keys()),
        moduleDetails: Array.from(backboneModuleMap.entries()).map(
          ([module, id]) => ({
            module,
            nodeId: id,
          }),
        ),
        totalBackboneNodes: backboneNodes?.length || 0,
        nodesWithoutModule: (backboneNodes || []).filter((gn) => {
          const kp = gn.knowledge_points as unknown as {
            properties?: { backboneModule?: BackboneModule };
          };
          return !kp?.properties?.backboneModule;
        }).length,
      });

      if (nodesToCreate.length > 0) {
        const embeddingByTitle = new Map<string, number[]>();
        for (const cwe of conceptsWithEmbedding) {
          if (cwe.embedding) {
            embeddingByTitle.set(cwe.concept.title, cwe.embedding);
          }
        }

        const aiNodesData = nodesToCreate.map((node) => {
          const backboneNodeId = node.targetModule
            ? backboneModuleMap.get(node.targetModule)
            : null;

          if (node.targetModule && !backboneNodeId) {
            logger.warn(
              `Backbone node not found for module: ${node.targetModule}, concept "${node.title}" will be created as root node`,
            );
          }

          return {
            tempId: node.tempId,
            parentId: backboneNodeId || null,
            title: node.title,
            content: node.content,
            summary: node.summary,
            level: node.level,
            x_position: node.x_position,
            y_position: node.y_position,
            embedding: embeddingByTitle.get(node.title),
          };
        });

        logger.info("Nodes to create with parentId", {
          nodeCount: aiNodesData.length,
          nodesWithParent: aiNodesData.filter((n) => n.parentId).length,
          nodesWithoutParent: aiNodesData.filter((n) => !n.parentId).length,
          nodeDetails: aiNodesData.map((n) => ({
            title: n.title,
            parentId: n.parentId,
            targetModule: nodesToCreate.find((nd) => nd.tempId === n.tempId)
              ?.targetModule,
          })),
        });

        const createResult = await autoGraphService.processAINodes(
          supabase,
          userId,
          graphId,
          aiNodesData,
        );

        for (const [tempId, mapping] of Object.entries(
          createResult.nodeMapping,
        )) {
          nodeMapping[tempId] = mapping.knowledgePointId;
          addedCount++;

          const nodeData = nodesToCreate.find((n) => n.tempId === tempId);
          if (nodeData && nodeData.source) {
            // First, get the current properties
            const { data: currentKP } = await supabase
              .from("knowledge_points")
              .select("properties")
              .eq("id", mapping.knowledgePointId)
              .single();

            const currentProperties =
              (currentKP?.properties as Record<string, unknown>) || {};

            // Merge the new properties with existing ones
            const updatedProperties = {
              ...currentProperties,
              sources: [nodeData.source],
              sourceCount: 1,
              conceptType: conceptsToProcess.find((c) => c.title === tempId)
                ?.type,
              backboneModule: nodeData.targetModule,
            };

            const { error: updateError } = await supabase
              .from("knowledge_points")
              .update({
                properties: updatedProperties,
              })
              .eq("id", mapping.knowledgePointId);

            if (updateError) {
              logger.error("Failed to update knowledge point properties", {
                knowledgePointId: mapping.knowledgePointId,
                error: updateError.message,
              });
            } else {
              logger.info("Updated knowledge point properties", {
                knowledgePointId: mapping.knowledgePointId,
                backboneModule: nodeData.targetModule,
                conceptType: updatedProperties.conceptType,
              });
            }
          }

          // Track mounting status
          const nodeDataForMounting = nodesToCreate.find(
            (n) => n.tempId === tempId,
          );
          const aiNodeData = aiNodesData.find((n) => n.tempId === tempId);

          mountingDetails.push({
            conceptTitle: tempId,
            targetModule: nodeDataForMounting?.targetModule,
            mountedTo: aiNodeData?.parentId || null,
            status: aiNodeData?.parentId ? "success" : "failed",
            reason:
              nodeDataForMounting?.targetModule && !aiNodeData?.parentId
                ? "骨干节点不存在"
                : undefined,
          });
        }
      }

      const edgesToCreate: Array<{
        graph_id: string;
        source_knowledge_point_id: string;
        target_knowledge_point_id: string;
        relationship_type: string;
      }> = [];

      for (const relation of relations) {
        const sourceId = nodeMapping[relation.source];
        const targetId = nodeMapping[relation.target];

        if (sourceId && targetId && sourceId !== targetId) {
          edgesToCreate.push({
            graph_id: graphId,
            source_knowledge_point_id: sourceId,
            target_knowledge_point_id: targetId,
            relationship_type: relation.type,
          });
        }
      }

      if (edgesToCreate.length > 0) {
        await autoGraphService.createEdgesBatch(supabase, edgesToCreate);
      }

      const referenceBook: ReferenceBook = {
        title: literature.title,
        author: literature.authors?.join(", ") || "未知作者",
        url: literature.url,
        description: `从${literature.type === "paper" ? "论文" : literature.type === "book" ? "书籍" : "文献"}中提取了 ${concepts.length} 个概念`,
      };

      const { data: currentGraph } = await supabase
        .from("graphs")
        .select("reference_books")
        .eq("id", graphId)
        .single();

      const currentReferenceBooks = (currentGraph?.reference_books ||
        []) as ReferenceBook[];
      const existingBookIndex = currentReferenceBooks.findIndex(
        (book) =>
          book.title === referenceBook.title ||
          (referenceBook.url && book.url === referenceBook.url),
      );

      if (existingBookIndex >= 0) {
        currentReferenceBooks[existingBookIndex] = referenceBook;
      } else {
        currentReferenceBooks.push(referenceBook);
      }

      await supabase
        .from("graphs")
        .update({
          reference_books: currentReferenceBooks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", graphId);

      await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
      await cacheService.del(CacheKeys.GRAPH_NODES("public", graphId));

      const duration = Date.now() - startTime;

      const mountingSuccessCount = mountingDetails.filter(
        (m) => m.status === "success",
      ).length;
      const mountingFailedCount = mountingDetails.filter(
        (m) => m.status === "failed",
      ).length;
      const mountingFailedDetails = mountingDetails
        .filter((m) => m.status === "failed")
        .map((m) => ({
          concept: m.conceptTitle,
          targetModule: m.targetModule,
          reason: m.reason,
        }));

      logger.info("Literature concepts applied successfully", {
        graphId: graphId,
        addedCount,
        mergedCount,
        edgeCount: edgesToCreate.length,
        duration,
        mountingStats: {
          total: mountingDetails.length,
          success: mountingSuccessCount,
          failed: mountingFailedCount,
          failedDetails: mountingFailedDetails,
        },
      });

      performanceMonitor.recordLog({
        operation: "literature_apply",
        provider: "openai",
        model: "internal",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration,
        success: true,
        metadata: {
          graphId: graphId,
          userId: userId,
        },
      });

      return {
        success: true,
        addedCount,
        mergedCount,
        nodeMapping,
        mountingDetails,
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Literature Apply Error:", {
        error: err.message,
        stack: err.stack,
      });

      throw error;
    }
  }
}

export const literatureApplyService = new LiteratureApplyService();
