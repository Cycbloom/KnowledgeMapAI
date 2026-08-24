export type DetailKind =
  | { kind: "note"; noteId: string }
  | { kind: "learningPath"; id: string }
  | { kind: "quiz"; quizSetId: string }
  | { kind: "quizPractice"; quizSetId: string }
  | { kind: "schedulerTask"; taskId: string }
  | { kind: "combinedGraphs"; id1: string; id2: string };

export const parseDetailPath = (pathname: string): DetailKind | undefined => {
  let match: RegExpMatchArray | null = pathname.match(/^\/notes\/([^/]+)$/);
  if (match) return { kind: "note", noteId: match[1] };
  match = pathname.match(/^\/learning-paths\/([^/]+)$/);
  if (match) return { kind: "learningPath", id: match[1] };
  match = pathname.match(/^\/quiz\/([^/]+)\/practice$/);
  if (match) return { kind: "quizPractice", quizSetId: match[1] };
  match = pathname.match(/^\/quiz\/([^/]+)$/);
  if (match) return { kind: "quiz", quizSetId: match[1] };
  match = pathname.match(/^\/scheduler\/task\/([^/]+)$/);
  if (match) return { kind: "schedulerTask", taskId: match[1] };
  match = pathname.match(/^\/combined-graphs\/([^/]+)\/([^/]+)$/);
  if (match) return { kind: "combinedGraphs", id1: match[1], id2: match[2] };
  return undefined;
};

export const getDetailParentPath = (pathname: string): string | undefined => {
  const detail = parseDetailPath(pathname);
  if (!detail) return undefined;
  switch (detail.kind) {
    case "note":
      return "/notes";
    case "learningPath":
      return "/learning-paths";
    case "quiz":
      return "/study?view=quizzes";
    case "quizPractice":
      return `/quiz/${detail.quizSetId}`;
    case "schedulerTask":
      return "/scheduler";
    case "combinedGraphs":
      return "/graph-map";
  }
};
