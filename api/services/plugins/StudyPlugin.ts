import type { KernelAPI } from "../kernel/types";
import {
  studyService,
  studyProgressService,
  reviewService,
  learningPathService,
  spacedRepetitionBridge,
} from "../study/";
import studyRoutes from "../../routes/study";
import learningPathsRoutes from "../../routes/learningPaths";
import quizSetRoutes from "../../routes/quizSets";

export const StudyPlugin = {
  name: "study",
  version: "1.0.0",
  description: "Study and learning services plugin",
  dependencies: ["graph", "ai"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("studyService", studyService);
    kernel.registerService("studyProgressService", studyProgressService);
    kernel.registerService("reviewService", reviewService);
    kernel.registerService("learningPathService", learningPathService);
    kernel.registerService("spacedRepetitionBridge", spacedRepetitionBridge);

    kernel.registerRoutes("/study", studyRoutes);
    kernel.registerRoutes("/learning-paths", learningPathsRoutes);
    kernel.registerRoutes("/quiz-sets", quizSetRoutes);
  },
};
