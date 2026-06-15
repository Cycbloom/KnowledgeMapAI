import { getSupabaseClient } from '@/lib/supabase';
import type {
  StoryStructure,
  StoryCharacter,
  StorySceneDetail,
  StoryAppearance,
  StoryCharacterRelationship,
  CreateStoryStructureData,
  CreateCharacterData,
  CreateSceneDetailData,
  CreateAppearanceData,
  CreateRelationshipData,
  StoryStructureLevel,
} from '@shared/types/graph';

function getSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized');
  }
  return client;
}

function buildTree(flatList: StoryStructure[]): StoryStructure[] {
  const map = new Map<string, StoryStructure>();
  const roots: StoryStructure[] = [];

  flatList.forEach(item => {
    map.set(item.id, { ...item, children: [] });
  });

  flatList.forEach(item => {
    const node = map.get(item.id);
    if (!node) return;
    if (item.parent_structure_id && map.has(item.parent_structure_id)) {
      const parent = map.get(item.parent_structure_id);
      parent?.children?.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export const storyCreationSupabaseApi = {
  structures: {
    list: async (graphId: string): Promise<StoryStructure[]> => {
      const { data, error } = await getSupabase()
        .from('story_structures')
        .select('*')
        .eq('graph_id', graphId)
        .order('display_order');

      if (error) throw error;
      return buildTree(data as StoryStructure[]);
    },

    create: async (data: CreateStoryStructureData): Promise<StoryStructure> => {
      const { data: result, error } = await getSupabase()
        .from('story_structures')
        .insert({
          graph_id: data.graph_id,
          structure_level: data.structure_level,
          parent_structure_id: data.parent_structure_id,
          title: data.title,
          synopsis: data.synopsis,
          display_order: data.display_order,
          template_beat_id: data.template_beat_id,
          metadata: {},
        })
        .select()
        .single();

      if (error) throw error;
      return result as StoryStructure;
    },

    update: async (
      graphId: string,
      id: string,
      data: Partial<Omit<CreateStoryStructureData, 'graph_id'>>,
    ): Promise<StoryStructure> => {
      const { data: result, error } = await getSupabase()
        .from('story_structures')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('graph_id', graphId)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as StoryStructure;
    },

    delete: async (graphId: string, id: string): Promise<void> => {
      const { error } = await getSupabase()
        .from('story_structures')
        .delete()
        .eq('graph_id', graphId)
        .eq('id', id);

      if (error) throw error;
    },

    initializeTemplate: async (
      graphId: string,
      templateCode: string,
    ): Promise<StoryStructure[]> => {
      const supabase = getSupabase();

      const { data: template, error: fetchError } = await supabase
        .from('story_templates')
        .select('*')
        .eq('template_code', templateCode)
        .single();

      if (fetchError) throw fetchError;

      const beats = (template.beats as Array<{
        id: string;
        level: StoryStructureLevel;
        name?: string;
        name_zh?: string;
        description?: string;
        parent_act?: string;
        percentage_start?: number;
        percentage_end?: number;
      }>) || [];

      const structuresToInsert = beats.map((beat, index) => ({
        graph_id: graphId,
        structure_level: beat.level,
        title: beat.name_zh || beat.name || '',
        synopsis: beat.description,
        display_order: index + 1,
        template_beat_id: beat.id,
        metadata: {
          percentage_start: beat.percentage_start,
          percentage_end: beat.percentage_end,
        },
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('story_structures')
        .insert(structuresToInsert)
        .select()
        .order('display_order');

      if (insertError) throw insertError;

      if (inserted && inserted.length > 0) {
        const idMap = new Map<string, string>();
        inserted.forEach((item: { id: string; template_beat_id?: string }) => {
          if (item.template_beat_id) {
            idMap.set(item.template_beat_id, item.id);
          }
        });

        for (const item of inserted) {
          const beat = beats.find(b => {
            const insertedId = idMap.get(b.id);
            return insertedId === item.id;
          });

          if (beat?.parent_act && idMap.has(beat.parent_act)) {
            const parentId = idMap.get(beat.parent_act);
            if (parentId && parentId !== item.id) {
              await supabase
                .from('story_structures')
                .update({ parent_structure_id: parentId })
                .eq('id', item.id);
            }
          }
        }
      }

      return storyCreationSupabaseApi.structures.list(graphId);
    },
  },

  characters: {
    list: async (graphId: string): Promise<StoryCharacter[]> => {
      const { data, error } = await getSupabase()
        .from('story_characters')
        .select('*')
        .eq('graph_id', graphId)
        .order('name');

      if (error) throw error;
      return data as StoryCharacter[];
    },

    create: async (data: CreateCharacterData): Promise<StoryCharacter> => {
      const { data: result, error } = await getSupabase()
        .from('story_characters')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as StoryCharacter;
    },

    update: async (
      graphId: string,
      id: string,
      data: Partial<CreateCharacterData>,
    ): Promise<StoryCharacter> => {
      const { data: result, error } = await getSupabase()
        .from('story_characters')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('graph_id', graphId)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as StoryCharacter;
    },

    delete: async (graphId: string, id: string): Promise<void> => {
      const { error } = await getSupabase()
        .from('story_characters')
        .delete()
        .eq('graph_id', graphId)
        .eq('id', id);

      if (error) throw error;
    },
  },

  scenes: {
    getByStructureId: async (
      structureId: string,
    ): Promise<StorySceneDetail | null> => {
      const { data, error } = await getSupabase()
        .from('story_scene_details')
        .select('*')
        .eq('structure_id', structureId)
        .maybeSingle();

      if (error) throw error;
      return data as StorySceneDetail | null;
    },

    create: async (data: CreateSceneDetailData): Promise<StorySceneDetail> => {
      const { data: result, error } = await getSupabase()
        .from('story_scene_details')
        .insert({
          graph_id: data.graph_id,
          structure_id: data.structure_id,
          pov_character_id: data.pov_character_id,
          synopsis: data.synopsis,
          content: data.content,
          location_name: data.location_name,
          time_setting: data.time_setting,
          writing_status: data.writing_status || 'draft',
          word_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return result as StorySceneDetail;
    },

    update: async (
      id: string,
      data: Partial<CreateSceneDetailData & { word_count?: number }>,
    ): Promise<StorySceneDetail> => {
      const updateData: Record<string, unknown> = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      if (data.content !== undefined) {
        updateData.word_count = data.content.length;
      }

      const { data: result, error } = await getSupabase()
        .from('story_scene_details')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as StorySceneDetail;
    },
  },

  appearances: {
    add: async (data: CreateAppearanceData): Promise<StoryAppearance> => {
      const { data: result, error } = await getSupabase()
        .from('story_appearances')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as StoryAppearance;
    },

    remove: async (graphId: string, id: string): Promise<void> => {
      const { error } = await getSupabase()
        .from('story_appearances')
        .delete()
        .eq('graph_id', graphId)
        .eq('id', id);

      if (error) throw error;
    },

    getStats: async (
      graphId: string,
      characterId: string,
    ): Promise<{
      total_appearances: number;
      as_protagonist: number;
      scenes: StoryAppearance[];
    }> => {
      const { data, error } = await getSupabase()
        .from('story_appearances')
        .select(
          `
          *,
          scene_detail:scene_detail_id (
            id,
            structure_id,
            synopsis,
            location_name
          )
        `,
        )
        .eq('graph_id', graphId)
        .eq('character_id', characterId);

      if (error) throw error;

      const appearances = data as Array<{
        role_in_scene: string;
        [key: string]: unknown;
      }>;
      return {
        total_appearances: appearances.length,
        as_protagonist: appearances.filter(
          (a) => a.role_in_scene === 'protagonist',
        ).length,
        scenes: data as StoryAppearance[],
      };
    },
  },

  relationships: {
    list: async (graphId: string): Promise<StoryCharacterRelationship[]> => {
      const { data, error } = await getSupabase()
        .from('story_character_relationships')
        .select(
          `
          *,
          source_character:source_character_id (*),
          target_character:target_character_id (*)
        `,
        )
        .eq('graph_id', graphId);

      if (error) throw error;
      return data as StoryCharacterRelationship[];
    },

    create: async (
      data: CreateRelationshipData,
    ): Promise<StoryCharacterRelationship> => {
      const { data: result, error } = await getSupabase()
        .from('story_character_relationships')
        .insert(data)
        .select(
          `
          *,
          source_character:source_character_id (*),
          target_character:target_character_id (*)
        `,
        )
        .single();

      if (error) throw error;
      return result as StoryCharacterRelationship;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await getSupabase()
        .from('story_character_relationships')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  },
};
