import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { writeFile, mkdir, stat } from "node:fs/promises";
import * as path from "node:path";
import type { StudyCard } from "../shared/types/common";
import type { QuizSet, QuizSetCard } from "../shared/types/quiz";
import {
  type OfflineBundle,
  type OfflineEdgeRow,
  type OfflineGraphNodeRow,
  type OfflineGraphRow,
  type OfflineKnowledgePointRow,
  type OfflineOwner,
  OFFLINE_BUNDLE_VERSION,
} from "../shared/types/offline";

dotenv.config();

interface ExportArgs {
  output: string;
  userId?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * 电脑端导出离线学习数据包（供 Capacitor 移动端离线版内置）。
 *
 * 导出范围（学习主线所需）：
 * - owner 用户信息（id/email/settings → FSRS 参数来源）
 * - knowledge_graphs / knowledge_points
 * - study_cards（含全部 FSRS 进度字段）
 * - quiz_sets + quiz_set_cards（题库）
 *
 * 输出为 public/offline/bundle.json，`mobile:build` 时随静态资源打包进 APK。
 * 用法：npm run db:export:offline [-- --user <ownerId>]
 */
async function exportOfflineBundle(): Promise<void> {
  const args = parseArgs();
  const supabaseUrl = args.supabaseUrl || process.env.VITE_SUPABASE_URL;
  const supabaseKey = args.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Error: Supabase URL and key are required. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars or pass --url/--key.",
    );
    process.exit(1);
  }

  console.log("Connecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const owner = await resolveOwner(supabase, args.userId);
  if (!owner) {
    console.error("Error: no owner user found (pass --user <id> if needed).");
    process.exit(1);
  }
  console.log(`Exporting offline bundle for owner: ${owner.email} (${owner.id})`);

  const [graphs, knowledgePoints, graphNodes, edges, studyCards, quizSets, quizSetCards] =
    await Promise.all([
      exportGraphs(supabase, owner.id),
      exportKnowledgePoints(supabase, owner.id),
      exportGraphNodes(supabase, owner.id),
      exportEdges(supabase, owner.id),
      exportStudyCards(supabase, owner.id),
      exportQuizSets(supabase, owner.id),
      exportQuizSetCards(supabase, owner.id),
    ]);

  const bundle: OfflineBundle = {
    version: OFFLINE_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    owner,
    graphs,
    knowledgePoints,
    graphNodes,
    edges,
    studyCards,
    quizSets,
    quizSetCards,
  };

  const outputPath = path.resolve(process.cwd(), args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(bundle), "utf-8");

  const size = (await stat(outputPath)).size;
  console.log("\nOffline bundle exported:");
  console.log(`  owner:          ${owner.email}`);
  console.log(`  graphs:         ${graphs.length}`);
  console.log(`  knowledgePoints:${knowledgePoints.length}`);
  console.log(`  graphNodes:     ${graphNodes.length}`);
  console.log(`  edges:          ${edges.length}`);
  console.log(`  studyCards:     ${studyCards.length}`);
  console.log(`  quizSets:       ${quizSets.length}`);
  console.log(`  quizSetCards:   ${quizSetCards.length}`);
  console.log(`  output:         ${outputPath}`);
  console.log(`  size:           ${(size / 1024 / 1024).toFixed(2)} MB`);
}

async function resolveOwner(
  supabase: SupabaseClient,
  userId?: string,
): Promise<OfflineOwner | null> {
  let query = supabase
    .from("users")
    .select("id, email, name, level, xp, settings")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (userId) {
    query = supabase
      .from("users")
      .select("id, email, name, level, xp, settings")
      .eq("id", userId)
      .maybeSingle();
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Warning: failed to load owner user:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name ?? null,
    level: data.level ?? null,
    xp: data.xp ?? null,
    settings: (data.settings as Record<string, unknown> | null) ?? null,
  };
}

async function exportGraphs(
  supabase: SupabaseClient,
  userId: string,
): Promise<OfflineGraphRow[]> {
  const { data, error } = await supabase
    .from("knowledge_graphs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) {
    console.warn("Warning: failed to export knowledge_graphs:", error.message);
    return [];
  }
  return (data as unknown as OfflineGraphRow[]) || [];
}

async function exportKnowledgePoints(
  supabase: SupabaseClient,
  userId: string,
): Promise<OfflineKnowledgePointRow[]> {
  const { data, error } = await supabase
    .from("knowledge_points")
    .select("*")
    .eq("owner_id", userId);
  if (error) {
    console.warn("Warning: failed to export knowledge_points:", error.message);
    return [];
  }
  return (data as unknown as OfflineKnowledgePointRow[]) || [];
}

async function exportGraphNodes(
  supabase: SupabaseClient,
  userId: string,
): Promise<OfflineGraphNodeRow[]> {
  const { data: graphs } = await supabase
    .from("knowledge_graphs")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const graphIds = (graphs ?? []).map((g) => g.id);
  if (graphIds.length === 0) return [];

  const all: OfflineGraphNodeRow[] = [];
  const batchSize = 100;
  for (let i = 0; i < graphIds.length; i += batchSize) {
    const batch = graphIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("graph_nodes")
      .select("*")
      .in("graph_id", batch)
      .is("deleted_at", null);
    if (error) {
      console.warn("Warning: failed to export graph_nodes batch:", error.message);
      continue;
    }
    all.push(...((data as unknown as OfflineGraphNodeRow[]) || []));
  }
  return all;
}

async function exportEdges(
  supabase: SupabaseClient,
  userId: string,
): Promise<OfflineEdgeRow[]> {
  const { data: graphs } = await supabase
    .from("knowledge_graphs")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const graphIds = (graphs ?? []).map((g) => g.id);
  if (graphIds.length === 0) return [];

  const all: OfflineEdgeRow[] = [];
  const batchSize = 100;
  for (let i = 0; i < graphIds.length; i += batchSize) {
    const batch = graphIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("edges")
      .select("*")
      .in("graph_id", batch)
      .is("deleted_at", null);
    if (error) {
      console.warn("Warning: failed to export edges batch:", error.message);
      continue;
    }
    all.push(...((data as unknown as OfflineEdgeRow[]) || []));
  }
  return all;
}

async function exportStudyCards(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudyCard[]> {
  const { data, error } = await supabase
    .from("study_cards")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.warn("Warning: failed to export study_cards:", error.message);
    return [];
  }
  return (data as unknown as StudyCard[]) || [];
}

async function exportQuizSets(
  supabase: SupabaseClient,
  userId: string,
): Promise<QuizSet[]> {
  const { data, error } = await supabase
    .from("quiz_sets")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.warn("Warning: failed to export quiz_sets:", error.message);
    return [];
  }
  return (data as unknown as QuizSet[]) || [];
}

async function exportQuizSetCards(
  supabase: SupabaseClient,
  userId: string,
): Promise<QuizSetCard[]> {
  const { data: quizSets } = await supabase
    .from("quiz_sets")
    .select("id")
    .eq("user_id", userId);
  const quizSetIds = (quizSets ?? []).map((s) => s.id);
  if (quizSetIds.length === 0) return [];

  const all: QuizSetCard[] = [];
  const batchSize = 100;
  for (let i = 0; i < quizSetIds.length; i += batchSize) {
    const batch = quizSetIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("quiz_set_cards")
      .select("*")
      .in("quiz_set_id", batch)
      .order("display_order", { ascending: true });
    if (error) {
      console.warn("Warning: failed to export quiz_set_cards batch:", error.message);
      continue;
    }
    all.push(...((data as unknown as QuizSetCard[]) || []));
  }
  return all;
}

function parseArgs(): ExportArgs {
  const args = process.argv.slice(2);
  const options: ExportArgs = { output: "public/offline/bundle.json" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      options.output = args[++i] ?? options.output;
    } else if (arg === "--user" || arg === "-u") {
      options.userId = args[++i];
    } else if (arg === "--url") {
      options.supabaseUrl = args[++i];
    } else if (arg === "--key") {
      options.supabaseKey = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run db:export:offline -- [options]

Options:
  --output, -o <path>  Output file path (default: public/offline/bundle.json)
  --user, -u <id>      Export data for a specific owner user (default: first user)
  --url <url>          Supabase URL (or set VITE_SUPABASE_URL)
  --key <key>          Supabase service role key (or set SUPABASE_SERVICE_ROLE_KEY)
  --help, -h           Show this help message

Examples:
  npm run db:export:offline
  npm run db:export:offline -- --user 123e4567-e89b-12d3-a456-426614174000
`);
      process.exit(0);
    }
  }

  return options;
}

const isMainModule =
  process.argv[1]?.endsWith("exportOfflineBundle.ts") ||
  process.argv[1]?.endsWith("exportOfflineBundle.js");

if (isMainModule) {
  exportOfflineBundle().catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  });
}

export { exportOfflineBundle };
