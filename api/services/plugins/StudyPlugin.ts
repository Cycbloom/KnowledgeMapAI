import type { Plugin, KernelAPI } from "../kernel/types";
import studyRoutes from "../../routes/study";
import learningPathsRoutes from "../../routes/learningPaths";
import quizSetRoutes from "../../routes/quizSets";
import practiceSessionRoutes from "../../routes/study/practiceSessions";
import quizSessionRoutes from "../../routes/study/quizSessions";

export const StudyPlugin: Plugin = {
  name: "study",
  version: "1.0.0",
  description: "Study and learning services plugin",
  dependencies: ["graph", "ai"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/study", studyRoutes);
    kernel.registerRoutes("/api/learning-paths", learningPathsRoutes);
    kernel.registerRoutes("/api/quiz-sets", quizSetRoutes);
    kernel.registerRoutes("/api/study/practice-sessions", practiceSessionRoutes);
    kernel.registerRoutes("/api/study/quiz-sessions", quizSessionRoutes);
  },
};
