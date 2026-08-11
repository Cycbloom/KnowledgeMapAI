/**
 * Shared mock factories for test files.
 *
 * Consolidates duplicated mock factory functions identified in tests/AUDIT.md
 * (14 files, ~800 lines of duplicate mock code). Factories extracted:
 * - createChainedMock: generic chainable mock builder (building block)
 * - createMockSupabase: mock SupabaseClient with chained query builder
 * - createMockResponse: mock Express Response (HTTP + SSE unified)
 * - createMockProvider: mock AIProvider
 * - buildCard: build a StudyCard for FSRS tests
 * - createMockRequest: mock Express Request
 *
 * Type safety: no `any`, no non-null assertions. All mock methods are vi.fn
 * instances so assertions like `expect(mock.from).toHaveBeenCalledWith(...)`
 * work out of the box.
 *
 * Usage:
 *   import { createMockSupabase, createMockResponse } from "<rel>/tests/helpers/mockFactories";
 */

import { vi } from "vitest";
import type { Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProvider, StudyCard } from "@shared/types";

// ============================================================================
// 1. createChainedMock — generic chainable mock builder
// ============================================================================

export interface ChainedMockTerminal {
  /** Terminal method name */
  name: string;
  /** Value the terminal method returns (or resolves to if async) */
  value: unknown;
  /** If true, wraps value in Promise.resolve(). Default: false */
  async?: boolean;
}

export interface ChainedMockSpec {
  /** Method names that return the mock itself for chaining */
  chainMethods?: readonly string[];
  /** Terminal methods that return a value instead of self */
  terminals?: readonly ChainedMockTerminal[];
}

/**
 * Creates a chainable mock object. Chain methods return the mock itself;
 * terminal methods return (or resolve to) the specified value.
 * All methods are vi.fn instances so assertions like
 * `expect(mock.select).toHaveBeenCalledWith(...)` work.
 *
 * This is the building block for createMockSupabase's query chain.
 */
export function createChainedMock(
  spec: ChainedMockSpec = {},
): Record<string, ReturnType<typeof vi.fn>> {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of spec.chainMethods ?? []) {
    obj[method] = vi.fn().mockReturnValue(obj);
  }

  for (const terminal of spec.terminals ?? []) {
    obj[terminal.name] =
      terminal.async === true
        ? vi.fn().mockResolvedValue(terminal.value)
        : vi.fn().mockReturnValue(terminal.value);
  }

  return obj;
}

// ============================================================================
// 2. createMockSupabase — mock SupabaseClient with chained query builder
// ============================================================================

export interface MockQueryChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  /** Makes the chain awaitable (PromiseLike) for `await supabase.from(t).select()` */
  then: (
    onFulfilled?: (value: unknown) => unknown | PromiseLike<unknown>,
    onRejected?: (reason: unknown) => unknown | PromiseLike<unknown>,
  ) => Promise<unknown>;
}

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  /** Reference to the query chain returned by the most recent from() call */
  _queryChain: MockQueryChain;
}

export interface MockSupabaseOptions {
  /** Data returned by terminal methods (single/maybeSingle/await). Default: null */
  data?: unknown;
  /** Error returned by terminal methods. Default: null */
  error?: unknown;
  /** If true, terminal methods reject with an Error instead of resolving. Default: false */
  reject?: boolean;
  /** Optional count injected into the resolved result (for pagination count queries). Default: undefined */
  count?: number;
}

/**
 * Creates a mock SupabaseClient with a chained query builder.
 *
 * Supported query patterns:
 * - `.from(table).select().eq().single()` → Promise<{data, error}>
 * - `.from(table).insert(payload).select()` → awaitable chain
 * - `.from(table).update(payload).eq().select()` → awaitable chain
 * - `.from(table).delete().eq()` → awaitable chain
 * - `.rpc(name, args)` → Promise<{data, error}>
 * - `.auth.getUser()` / `.auth.signInWithPassword()` / `.auth.signOut()`
 *
 * All methods are vi.fn instances. To assert on mock methods, cast the
 * returned client: `(client as unknown as MockSupabaseClient).from`
 */
export function createMockSupabase(
  options: MockSupabaseOptions = {},
): SupabaseClient {
  const { data = null, error = null, reject = false, count } = options;

  const result = { data, error, ...(count !== undefined ? { count } : {}) };
  const rejectError = new Error("Mock supabase error");

  const chain = createChainedMock({
    chainMethods: [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "neq",
      "in",
      "or",
      "gte",
      "gt",
      "lt",
      "lte",
      "contains",
      "is",
      "not",
      "order",
      "range",
      "limit",
    ],
    terminals: [
      { name: "single", value: result, async: true },
      { name: "maybeSingle", value: result, async: true },
    ],
  }) as unknown as MockQueryChain;

  // Override terminals for reject case
  if (reject) {
    chain.single.mockRejectedValue(rejectError);
    chain.maybeSingle.mockRejectedValue(rejectError);
  }

  // Make chain awaitable (PromiseLike) for `await supabase.from(t).select()`
  chain.then = (
    onFulfilled?: (value: unknown) => unknown | PromiseLike<unknown>,
    onRejected?: (reason: unknown) => unknown | PromiseLike<unknown>,
  ): Promise<unknown> =>
    (reject ? Promise.reject(rejectError) : Promise.resolve(result)).then(
      onFulfilled,
      onRejected,
    );

  const mock: MockSupabaseClient = {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue(result),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    _queryChain: chain,
  };

  return mock as unknown as SupabaseClient;
}

// ============================================================================
// 3. createMockResponse — mock Express Response (HTTP + SSE)
// ============================================================================

export interface MockResponseOptions {
  /** Return value of res.write(). Default: true */
  writeReturn?: boolean;
}

export type MockResponse = Response & {
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  /** Trigger registered event listeners */
  emit: (event: string, ...args: unknown[]) => void;
  /** Recorded res.write() arguments (raw SSE data lines) */
  writes: string[];
  /** Parsed SSE content extracted from write() calls (data: {"content":"..."}) */
  chunks: string[];
};

/**
 * Creates a mock Express Response supporting both HTTP and SSE scenarios.
 *
 * - `write(data)` records data in `writes[]` and parses SSE `data:` lines
 *   to extract `content` into `chunks[]`. Returns `writeReturn` (default: true).
 * - `on(event, cb)` registers event listeners; `emit(event, ...args)` triggers them.
 * - `end()`, `setHeader()`, `get()` are vi.fn stubs.
 *
 * Accepts both positional and options-object signatures for backward compat:
 * - `createMockResponse()` → writeReturn: true
 * - `createMockResponse(false)` → writeReturn: false
 * - `createMockResponse({ writeReturn: false })` → writeReturn: false
 */
export function createMockResponse(): MockResponse;
export function createMockResponse(writeReturn: boolean): MockResponse;
export function createMockResponse(options: MockResponseOptions): MockResponse;
export function createMockResponse(
  options?: boolean | MockResponseOptions,
): MockResponse {
  const opts: MockResponseOptions =
    typeof options === "boolean" ? { writeReturn: options } : (options ?? {});

  const { writeReturn = true } = opts;
  const writes: string[] = [];
  const chunks: string[] = [];
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockRes = {
    write: vi.fn((data: string) => {
      writes.push(data);
      // Parse SSE data line: data: {"content":"..."}\n\n
      const match = /data: (.*)/.exec(data);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as { content?: string };
          if (parsed.content) {
            chunks.push(parsed.content);
          }
        } catch {
          // Non-JSON (e.g. [DONE]), ignore
        }
      }
      return writeReturn;
    }),
    end: vi.fn(),
    setHeader: vi.fn(),
    get: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(cb);
      return mockRes;
    }),
    emit: (event: string, ...args: unknown[]): void => {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
    writes,
    chunks,
  };

  return mockRes as unknown as MockResponse;
}

// ============================================================================
// 4. createMockProvider — mock AIProvider
// ============================================================================

/**
 * Creates a mock AIProvider for AI service tests.
 *
 * The returned provider has:
 * - `client.chat.completions.create`: vi.fn (for non-streaming chat)
 * - `client.embeddings.create`: vi.fn (for embeddings)
 * - `hasKey: true`, `model: "test-model"`, `providerType: "openai"`
 *
 * Override any field via `overrides`. Set `hasKey: false` to test the
 * no-API-key fallback path.
 */
export function createMockProvider(
  overrides: Partial<AIProvider> = {},
): AIProvider {
  const base = {
    hasKey: true,
    model: "test-model",
    providerType: "openai" as const,
    client: {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      embeddings: {
        create: vi.fn(),
      },
    },
  };
  return { ...base, ...overrides } as unknown as AIProvider;
}

// ============================================================================
// 5. buildCard — build a StudyCard for FSRS tests
// ============================================================================

/**
 * Builds a StudyCard with sensible defaults for FSRS engine tests.
 * Override any field via `overrides`.
 */
export function buildCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "card-1",
    knowledge_point_id: "kp-1",
    user_id: "user-1",
    graph_id: "graph-1",
    card_type: "qa",
    question: "q",
    answer: "a",
    next_review: new Date("2025-01-01T00:00:00Z").toISOString(),
    ...overrides,
  };
}

// ============================================================================
// 6. createMockRequest — mock Express Request
// ============================================================================

export interface MockRequest {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  user?: { id: string; [key: string]: unknown };
  method: string;
  get: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock Express Request with body, params, query, headers, user, method.
 * Override any field via `overrides`.
 */
export function createMockRequest(
  overrides: Partial<MockRequest> = {},
): MockRequest {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    method: "GET",
    get: vi.fn(),
    ...overrides,
  };
}
