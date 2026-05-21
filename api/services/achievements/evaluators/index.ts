import { evaluatorRegistry } from "../evaluatorRegistry"
import { focusEvaluators } from "./focusEvaluators"
import { streakEvaluators } from "./streakEvaluators"
import { taskEvaluators } from "./taskEvaluators"
import { studyEvaluators } from "./studyEvaluators"
import { creationEvaluators } from "./creationEvaluators"
import { periodicStreakEvaluators } from "./periodicStreakEvaluators"
import { specialEvaluators } from "./specialEvaluators"

const allEvaluators = [
  ...focusEvaluators,
  ...streakEvaluators,
  ...taskEvaluators,
  ...studyEvaluators,
  ...creationEvaluators,
  ...periodicStreakEvaluators,
  ...specialEvaluators,
]

for (const evaluator of allEvaluators) {
  evaluatorRegistry.register(evaluator)
}
