import { faker } from '@faker-js/faker';
import type { User } from '../../shared/types/user';
import type { Graph, Node, Edge } from '../../shared/types/graph';
import type { Note } from '../../shared/types/note';
import type { Task, StudyCard } from '../../shared/types/common';

/**
 * Seed faker for reproducible test data.
 *
 * @example
 * seedFaker(12345); // subsequent faker calls are deterministic
 */
export function seedFaker(seed: number): void {
  faker.seed(seed);
}

/**
 * Build a User entity with sensible random defaults.
 *
 * Based on: shared/types/user.ts → User
 * Required fields: id, email. Optional fields: name, user_metadata, profile.
 */
export function userFactory(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    ...overrides,
  };
}

/**
 * Build a Graph entity with sensible random defaults.
 *
 * Based on: shared/types/graph-entity.ts → Graph
 * Required fields: id, title, created_at.
 */
export function graphFactory(overrides?: Partial<Graph>): Graph {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(2),
    description: faker.lorem.sentence(),
    user_id: faker.string.uuid(),
    is_favorite: false,
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Build a Node entity with sensible random defaults.
 *
 * Based on: shared/types/graph-node.ts → Node
 * Node = GraphNode & Omit<KnowledgePoint, 'id'> & { tags?: string[] }
 * Required fields: id, graph_id, knowledge_point_id, x_position, y_position,
 *   level, is_accepted, created_at, updated_at, title, visibility, owner_id.
 */
export function nodeFactory(overrides?: Partial<Node>): Node {
  return {
    // GraphNode fields
    id: faker.string.uuid(),
    graph_id: faker.string.uuid(),
    knowledge_point_id: faker.string.uuid(),
    x_position: faker.number.float({ min: -500, max: 500 }),
    y_position: faker.number.float({ min: -500, max: 500 }),
    level: 'normal',
    is_accepted: true,
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    // KnowledgePoint fields (Omit 'id')
    title: faker.lorem.words(2),
    content: faker.lorem.sentence(),
    visibility: 'private',
    owner_id: faker.string.uuid(),
    ...overrides,
  };
}

/**
 * Build an Edge entity with sensible random defaults.
 *
 * Based on: shared/types/graph-edge.ts → Edge
 * Required fields: id, graph_id, source_knowledge_point_id, target_knowledge_point_id.
 */
export function edgeFactory(overrides?: Partial<Edge>): Edge {
  return {
    id: faker.string.uuid(),
    graph_id: faker.string.uuid(),
    source_knowledge_point_id: faker.string.uuid(),
    target_knowledge_point_id: faker.string.uuid(),
    custom_label: faker.lorem.word(),
    created_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Build a Note entity with sensible random defaults.
 *
 * Based on: shared/types/note.ts → Note
 * All fields are required (camelCase naming).
 */
export function noteFactory(overrides?: Partial<Note>): Note {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    title: faker.lorem.words(3),
    content: faker.lorem.paragraph(),
    type: 'note',
    date: null,
    templateId: null,
    tags: [],
    isPinned: false,
    isArchived: false,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Build a Task entity with sensible random defaults.
 *
 * Based on: shared/types/common.ts → Task
 * All fields are required (snake_case naming, legacy task type).
 */
export function taskFactory(overrides?: Partial<Task>): Task {
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.lorem.sentence(),
    queue_id: faker.string.uuid(),
    queue_level: faker.number.int({ min: 0, max: 2 }),
    position: faker.number.int({ min: 0, max: 100 }),
    estimated_duration: faker.number.int({ min: 5, max: 120 }),
    actual_duration: 0,
    deadline: faker.date.future().toISOString(),
    status: 'pending',
    tags: [],
    knowledge_point_id: faker.string.uuid(),
    priority: faker.number.int({ min: 0, max: 5 }),
    task_type: 'one_time',
    total_duration: 0,
    progress_mode: 'average',
    progress_percentage: 0,
    parent_task_id: '',
    context: '',
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
    completed_at: '',
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    deleted_at: '',
    ...overrides,
  };
}

/**
 * Build a StudyCard entity with sensible random defaults.
 *
 * Based on: shared/types/common.ts → StudyCard
 * Required fields: id, knowledge_point_id, user_id, graph_id, question,
 *   answer, card_type, next_review.
 *
 * FSRS-related fields (fsrs_state, fsrs_stability, etc.) are optional on the
 * type and left unset for a fresh "new" card. Use overrides to simulate
 * reviewed cards (see fsrsEngine.test.ts buildCard for reference).
 */
export function studyCardFactory(overrides?: Partial<StudyCard>): StudyCard {
  return {
    id: faker.string.uuid(),
    knowledge_point_id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    graph_id: faker.string.uuid(),
    question: faker.lorem.sentence(),
    answer: faker.lorem.sentence(),
    card_type: 'qa',
    next_review: faker.date.future().toISOString(),
    ...overrides,
  };
}

/**
 * Build a list of N entities. Each item gets unique random values (the
 * factory is invoked once per item). Optional overrides are applied to all
 * items.
 *
 * @example
 * const nodes = buildList(nodeFactory, 5, { graph_id: 'graph-1' });
 */
export function buildList<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overrides?: Partial<T>,
): T[] {
  return Array.from({ length: count }, () => factory(overrides));
}
