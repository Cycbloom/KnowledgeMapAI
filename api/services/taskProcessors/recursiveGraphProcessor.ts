import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index.js';
import { getAIProviderForTask } from '../ai/factory.js';
import { createKnowledgePointWithGraphNode } from '../../utils/nodeHelpers.js';
import { logger } from '../../utils/logger.js';
import { getAutoGraphPrompt } from './utils.js';

export class RecursiveGraphProcessor implements TaskProcessor {
  async process(
    taskId: string, 
    userId: string, 
    payload: any, 
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    try {
      await updateTaskStatus(supabase, taskId, 'processing', { 
        stage: 'init', 
        progress: 0 
      }, undefined, userId);

      const { graph_id, topic, depth = 3, style = 'academic' } = payload;

      const { data: graph } = await supabase
        .from('knowledge_graphs')
        .select('id, title')
        .eq('id', graph_id)
        .single();

      if (!graph) {
        throw new Error('Graph not found');
      }

      const provider = await getAIProviderForTask('text');
      if (!provider.hasKey) {
        throw new Error('AI provider not configured');
      }

      let totalNodes = 0;
      let totalEdges = 0;
      const nodeMap = new Map<string, string>();

      const systemPrompt = await getAutoGraphPrompt(supabase, userId, graph_id, 'init', {
        topic,
        isAcademic: style === 'academic',
        hasSources: false,
        isInit: true
      });

      const initCompletion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `主题：${topic}\n\n请生成知识图谱的根节点和核心节点。` }
        ],
        model: provider.model,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const initParsed = JSON.parse(initCompletion.choices[0].message.content || '{"root": null, "coreNodes": []}');
      
      const rootData = initParsed.root || { title: topic, content: `${topic}的核心概念` };
      const coreNodes = initParsed.coreNodes || [];

      const rootNodeResult = await createKnowledgePointWithGraphNode(supabase, userId, {
        graph_id,
        title: rootData.title,
        content: rootData.content || '',
        level: 'root',
        x_position: 400,
        y_position: 300
      });

      if (rootNodeResult) {
        nodeMap.set(rootData.title, rootNodeResult.id);
        totalNodes++;

        for (const coreNode of coreNodes) {
          const childNodeResult = await createKnowledgePointWithGraphNode(supabase, userId, {
            graph_id,
            title: coreNode.title,
            content: coreNode.content || '',
            level: 'core',
            x_position: 200 + Math.random() * 400,
            y_position: 500 + Math.random() * 200
          });

          if (childNodeResult) {
            nodeMap.set(coreNode.title, childNodeResult.id);
            totalNodes++;

            await supabase
              .from('edges')
              .insert({
                graph_id,
                source_knowledge_point_id: rootNodeResult.id,
                target_knowledge_point_id: childNodeResult.id,
                relationship_type: 'contains'
              });
            totalEdges++;
          }
        }
      }

      await updateTaskStatus(supabase, taskId, 'processing', { 
        stage: 'init_complete', 
        progress: 30,
        totalNodes 
      }, undefined, userId);

      if (depth >= 2) {
        const coreNodeEntries = Array.from(nodeMap.entries()).filter(([title]) => title !== rootData.title);
        
        for (let i = 0; i < coreNodeEntries.length; i++) {
          const [nodeTitle, nodeId] = coreNodeEntries[i];
          
          await updateTaskStatus(supabase, taskId, 'processing', { 
            stage: 'expanding', 
            progress: 30 + Math.round((i / coreNodeEntries.length) * 40),
            currentNode: nodeTitle
          }, undefined, userId);

          try {
            const expandPrompt = await getAutoGraphPrompt(supabase, userId, graph_id, 'expand', {
              nodeTitle,
              nodeContent: '',
              nodeLevel: 'core',
              isAcademic: style === 'academic',
              hasExistingChildren: false,
              existingChildren: ''
            });

            const expandCompletion = await provider.client.chat.completions.create({
              messages: [
                { role: "system", content: expandPrompt },
                { role: "user", content: `请为「${nodeTitle}」生成子节点。` }
              ],
              model: provider.model,
              response_format: { type: "json_object" },
              max_tokens: 3000,
            });

            const expandParsed = JSON.parse(expandCompletion.choices[0].message.content || '{"children": []}');
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 5)) {
              const subNodeResult = await createKnowledgePointWithGraphNode(supabase, userId, {
                graph_id,
                title: child.title,
                content: child.content || '',
                level: 'sub',
                x_position: 100 + Math.random() * 600,
                y_position: 700 + Math.random() * 200
              });

              if (subNodeResult) {
                nodeMap.set(child.title, subNodeResult.id);
                totalNodes++;

                await supabase
                  .from('edges')
                  .insert({
                    graph_id,
                    source_knowledge_point_id: nodeId,
                    target_knowledge_point_id: subNodeResult.id,
                    relationship_type: 'contains'
                  });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand node ${nodeTitle}:`, expandError);
          }
        }
      }

      if (depth >= 3) {
        const subNodeEntries = Array.from(nodeMap.entries()).filter(([title]) => {
          return title !== rootData.title && !coreNodes.some((c: any) => c.title === title);
        });

        for (let i = 0; i < Math.min(subNodeEntries.length, 10); i++) {
          const [nodeTitle, nodeId] = subNodeEntries[i];
          
          await updateTaskStatus(supabase, taskId, 'processing', { 
            stage: 'deep_expanding', 
            progress: 70 + Math.round((i / Math.min(subNodeEntries.length, 10)) * 25),
            currentNode: nodeTitle
          }, undefined, userId);

          try {
            const expandPrompt = await getAutoGraphPrompt(supabase, userId, graph_id, 'expand', {
              nodeTitle,
              nodeContent: '',
              nodeLevel: 'sub',
              isAcademic: style === 'academic',
              hasExistingChildren: false,
              existingChildren: ''
            });

            const expandCompletion = await provider.client.chat.completions.create({
              messages: [
                { role: "system", content: expandPrompt },
                { role: "user", content: `请为「${nodeTitle}」生成子节点。` }
              ],
              model: provider.model,
              response_format: { type: "json_object" },
              max_tokens: 2000,
            });

            const expandParsed = JSON.parse(expandCompletion.choices[0].message.content || '{"children": []}');
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 3)) {
              const leafNodeResult = await createKnowledgePointWithGraphNode(supabase, userId, {
                graph_id,
                title: child.title,
                content: child.content || '',
                level: 'leaf',
                x_position: 50 + Math.random() * 700,
                y_position: 900 + Math.random() * 200
              });

              if (leafNodeResult) {
                totalNodes++;

                await supabase
                  .from('edges')
                  .insert({
                    graph_id,
                    source_knowledge_point_id: nodeId,
                    target_knowledge_point_id: leafNodeResult.id,
                    relationship_type: 'contains'
                  });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand sub-node ${nodeTitle}:`, expandError);
          }
        }
      }

      await updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalNodes,
        totalEdges,
        graphId: graph_id
      }, undefined, userId);

    } catch (error: any) {
      logger.error('Recursive graph generation failed:', error);
      await updateTaskStatus(supabase, taskId, 'failed', null, error.message, userId);
    }
  }
}

registerProcessor('recursive_graph_generation', new RecursiveGraphProcessor());
