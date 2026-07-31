import type { Plugin, KernelAPI } from "../kernel/types";
import studyRoutes from "../../routes/learning/study";
import learningPathsRoutes from "../../routes/learningPaths";
import quizSetRoutes from "../../routes/learning/quizSets";
import practiceSessionRoutes from "../../routes/study/practiceSessions";
import quizSessionRoutes from "../../routes/study/quizSessions";

export const StudyPlugin: Plugin = {
  name: "study",
  version: "1.0.0",
  description: "Study and learning services plugin",
  dependencies: ["graph", "ai"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/study", studyRoutes);
    kernel.registerRoutes("/api/v1/learning-paths", learningPathsRoutes);
    kernel.registerRoutes("/api/v1/quiz-sets", quizSetRoutes);
    kernel.registerRoutes("/api/v1/study/practice-sessions", practiceSessionRoutes);
    kernel.registerRoutes("/api/v1/study/quiz-sessions", quizSessionRoutes);
  },
};
