// 故事创作相关类型
// StoryStructure, StoryCharacter, StorySceneDetail, StoryAppearance, StoryTemplate 等

import type { TemplateCategory } from "./graph-core";

export enum StoryStructureLevel {
  STORY = "story",
  ACT = "act",
  SEQUENCE = "sequence",
  CHAPTER = "chapter",
  SCENE = "scene",
}

export enum CharacterRoleType {
  PROTAGONIST = "protagonist",
  ANTAGONIST = "antagonist",
  SUPPORTING = "supporting",
  MINOR = "minor",
}

export enum CharacterRelationshipType {
  FAMILY_PARENT = "family_parent",
  FAMILY_SIBLING = "family_sibling",
  FRIEND = "friend",
  ENEMY = "enemy",
  RIVAL = "rival",
  MENTOR = "mentor",
  ALLY = "ally",
  ROMANTIC_INTEREST = "romantic_interest",
  LOVE_HATE = "love_hate",
  BETRAYER = "betrayer",
  CUSTOM = "custom",
}

export enum SceneRoleInScene {
  PROTAGONIST = "protagonist",
  ANTAGONIST = "antagonist",
  SUPPORTING = "supporting",
  MINOR = "minor",
  MENTIONED = "mentioned",
}

export enum WritingStatus {
  DRAFT = "draft",
  REVISING = "revising",
  COMPLETE = "complete",
}

export interface StoryStructure {
  id: string;
  graph_id: string;
  structure_level: StoryStructureLevel;
  parent_structure_id?: string;
  title: string;
  synopsis?: string;
  display_order: number;
  template_beat_id?: string;
  metadata?: Record<string, unknown>;
  children?: StoryStructure[];
  created_at: string;
  updated_at: string;
}

export interface StoryCharacter {
  id: string;
  graph_id: string;
  name: string;
  role_type: CharacterRoleType;
  archetype?: string;
  appearance?: string;
  age?: string;
  gender?: string;
  motivation?: string;
  fear?: string;
  desire?: string;
  flaw?: string;
  backstory?: string;
  arc_start?: string;
  arc_end?: string;
  relationships?: StoryCharacterRelationship[];
  appearances?: StoryAppearance[];
  created_at: string;
  updated_at: string;
}

export interface StoryCharacterRelationship {
  id: string;
  graph_id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: CharacterRelationshipType;
  strength: number;
  status: string;
  notes?: string;
  source_character?: StoryCharacter;
  target_character?: StoryCharacter;
  created_at: string;
  updated_at: string;
}

export interface StorySceneDetail {
  id: string;
  graph_id: string;
  structure_id: string;
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status: WritingStatus;
  word_count: number;
  structure?: StoryStructure;
  pov_character?: StoryCharacter;
  appearances?: StoryAppearance[];
  created_at: string;
  updated_at: string;
}

export interface StoryAppearance {
  id: string;
  graph_id: string;
  character_id: string;
  scene_detail_id: string;
  role_in_scene: SceneRoleInScene;
  notes?: string;
  character?: StoryCharacter;
  scene_detail?: StorySceneDetail;
  created_at: string;
}

export interface CreateStoryStructureData {
  graph_id: string;
  structure_level: StoryStructureLevel;
  parent_structure_id?: string;
  title: string;
  synopsis?: string;
  display_order: number;
  template_beat_id?: string;
}

export interface CreateCharacterData {
  graph_id: string;
  name: string;
  role_type: CharacterRoleType;
  archetype?: string;
  appearance?: string;
  age?: string;
  gender?: string;
  motivation?: string;
  fear?: string;
  desire?: string;
  flaw?: string;
  backstory?: string;
  arc_start?: string;
  arc_end?: string;
}

export interface CreateSceneDetailData {
  graph_id: string;
  structure_id: string;
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status?: WritingStatus;
}

export interface CreateAppearanceData {
  graph_id: string;
  character_id: string;
  scene_detail_id: string;
  role_in_scene: SceneRoleInScene;
  notes?: string;
}

export interface CreateRelationshipData {
  graph_id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: CharacterRelationshipType;
  strength: number;
  status: string;
  notes?: string;
}

export interface StoryTemplateBeat {
  id: string;
  template_id: string;
  beat_name: string;
  beat_description?: string;
  structure_level: StoryStructureLevel;
  display_order: number;
  suggested_content?: string;
  created_at: string;
  updated_at: string;
}

export interface StoryTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  template_type: "story_creation";
  is_system: boolean;
  user_id?: string;
  beats: StoryTemplateBeat[];
  created_at: string;
  updated_at: string;
}
