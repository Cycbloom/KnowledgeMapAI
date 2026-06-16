// Inline types for Story Creation API

export interface StoryStructure {
  id: string;
  graph_id: string;
  structure_level: "story" | "act" | "sequence" | "chapter" | "scene";
  parent_structure_id: string | null;
  title: string;
  synopsis: string | null;
  display_order: number;
  template_beat_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  children?: StoryStructure[];
}

export interface StoryCharacter {
  id: string;
  graph_id: string;
  name: string;
  role_type: "protagonist" | "antagonist" | "supporting" | "minor";
  archetype: string | null;
  appearance: string | null;
  age: string | null;
  gender: string | null;
  motivation: string | null;
  fear: string | null;
  desire: string | null;
  flaw: string | null;
  backstory: string | null;
  arc_start: string | null;
  arc_end: string | null;
  created_at: string;
  updated_at: string;
  _count?: {
    relationships: number;
    appearances: number;
  };
}

export interface StorySceneDetail {
  id: string;
  graph_id: string;
  structure_id: string;
  pov_character_id: string | null;
  synopsis: string | null;
  content: string | null;
  location_name: string | null;
  time_setting: string | null;
  writing_status: "draft" | "revising" | "complete";
  word_count: number;
  created_at: string;
  updated_at: string;
  appearances?: StoryAppearance[];
}

export interface StoryAppearance {
  id: string;
  graph_id: string;
  character_id: string;
  scene_detail_id: string;
  role_in_scene:
    | "protagonist"
    | "antagonist"
    | "supporting"
    | "minor"
    | "mentioned";
  notes: string | null;
  created_at: string;
}

export interface StoryCharacterRelationship {
  id: string;
  graph_id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: string;
  strength: number;
  status: string;
  notes: string | null;
  created_at: string;
  source_character?: { id: string; name: string; role_type: string };
  target_character?: { id: string; name: string; role_type: string };
}

export interface InitializeTemplateResponse {
  message: string;
  templateName: string;
  templateCode: string;
  structures: StoryStructure[];
  count: number;
}

export interface IStoryStructuresApi {
  list(graphId: string): Promise<{ structures: StoryStructure[] }>;

  create(
    graphId: string,
    data: {
      structure_level: StoryStructure["structure_level"];
      parent_structure_id?: string;
      title: string;
      synopsis?: string;
      display_order: number;
      template_beat_id?: string;
    },
  ): Promise<StoryStructure>;

  update(
    graphId: string,
    id: string,
    data: Partial<{
      title: string;
      synopsis: string;
      display_order: number;
      template_beat_id: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<StoryStructure>;

  delete(graphId: string, id: string): Promise<{ message: string }>;

  initializeTemplate(
    graphId: string,
    templateCode: string,
  ): Promise<InitializeTemplateResponse>;
}

export interface IStoryCharactersApi {
  list(graphId: string): Promise<{ characters: StoryCharacter[] }>;

  create(
    graphId: string,
    data: Partial<Omit<StoryCharacter, "id" | "graph_id" | "created_at" | "updated_at">>,
  ): Promise<StoryCharacter>;

  update(
    graphId: string,
    id: string,
    data: Partial<Omit<StoryCharacter, "id" | "graph_id" | "created_at" | "updated_at">>,
  ): Promise<StoryCharacter>;

  delete(graphId: string, id: string): Promise<{ message: string }>;
}

export interface IStoryScenesApi {
  get(
    graphId: string,
    structureId: string,
  ): Promise<{ scene: StorySceneDetail | null }>;

  create(
    graphId: string,
    data: {
      structure_id: string;
      pov_character_id?: string;
      synopsis?: string;
      content?: string;
      location_name?: string;
      time_setting?: string;
      writing_status?: "draft" | "revising" | "complete";
      word_count?: number;
    },
  ): Promise<StorySceneDetail>;

  update(
    graphId: string,
    id: string,
    data: Partial<
      Omit<StorySceneDetail, "id" | "graph_id" | "structure_id" | "created_at" | "updated_at">
    >,
  ): Promise<StorySceneDetail>;
}

export interface IStoryAppearancesApi {
  create(
    graphId: string,
    data: {
      character_id: string;
      scene_detail_id: string;
      role_in_scene?: StoryAppearance["role_in_scene"];
      notes?: string;
    },
  ): Promise<StoryAppearance>;

  delete(graphId: string, id: string): Promise<{ message: string }>;

  getStats(
    graphId: string,
    characterId: string,
  ): Promise<{
    characterId: string;
    stats: {
      totalAppearances: number;
      totalRelationships: number;
      roleBreakdown: Record<string, number>;
    };
    appearances: StoryAppearance[];
    relationships: Array<{
      id: string;
      relationship_type: string;
      strength: number;
      status: string;
      notes: string | null;
      target_character_id: string;
      story_characters: { id: string; name: string; role_type: string };
    }>;
  }>;
}

export interface IStoryRelationshipsApi {
  list(graphId: string): Promise<{ relationships: StoryCharacterRelationship[] }>;

  create(
    graphId: string,
    data: {
      source_character_id: string;
      target_character_id: string;
      relationship_type: string;
      strength?: number;
      status?: string;
      notes?: string;
    },
  ): Promise<StoryCharacterRelationship>;

  delete(graphId: string, id: string): Promise<{ message: string }>;
}

export interface IStoryCreationApi {
  structures: IStoryStructuresApi;
  characters: IStoryCharactersApi;
  scenes: IStoryScenesApi;
  appearances: IStoryAppearancesApi;
  relationships: IStoryRelationshipsApi;
}
