-- =====================================================
-- FSRS Mastery Unification: Column Comments
-- Migration 99: Synchronize schema documentation with
-- fsrs-mastery-unification spec (Task 7).
-- NOTE: All COMMENT targets below reference columns that
-- are PHYSICALLY PRESENT in the public schema (verified
-- against migrations 03/06/07 creation statements).
-- In particular, `task_subtasks.mastery_level` does NOT
-- exist as a DB column — it is a JOIN-derived virtual
-- field flattened from knowledge_points.mastery_level.
-- =====================================================

-- study_cards: FSRS core algorithm fields
COMMENT ON COLUMN study_cards.fsrs_state IS
  'FSRS CardState: New / Learning / Review / Relearning. @schedule decision: interval calc & queue routing';

COMMENT ON COLUMN study_cards.fsrs_stability IS
  'FSRS Stability (S) in days; long-term mastery baseline. @schedule decision: interval calc | @mastery display (baseline=S/(S+7))';

COMMENT ON COLUMN study_cards.fsrs_difficulty IS
  'FSRS Difficulty (D); per card intrinsic difficulty. @schedule decision: interval calc';

COMMENT ON COLUMN study_cards.fsrs_elapsed_days IS
  'FSRS elapsed days (Δt) since last review. @schedule decision: forgetting curve exponent input';

COMMENT ON COLUMN study_cards.fsrs_scheduled_days IS
  'FSRS scheduled interval days (I) for next review. @schedule decision: due_date = last_review + I';

COMMENT ON COLUMN study_cards.fsrs_retrievability IS
  'Retrievability (R) stored snapshot ~ baseline*decay at last review moment. @deprecated for display: use display_mastery derived via masteryContract. @schedule decision (due calc fallback) | @mastery display (legacy fallback only, prefer computeCardDisplayMastery with live decay)';

COMMENT ON COLUMN study_cards.fsrs_last_review IS
  'Timestamp of last FSRS review (UTC). @schedule decision (Δt base) + @mastery display (decay input)';

COMMENT ON COLUMN study_cards.next_review IS
  'Next due timestamp (UTC) for FSRS review — same semantic as FSRS "due_date". @schedule decision: queue ordering & overdue detection';

COMMENT ON COLUMN study_cards.review_count IS
  'Total number of reviews performed — used as the "repetitions" counter in FSRS-style reporting. @schedule decision (statistical input) | @mastery display (sessions indicator)';

-- knowledge_points: aggregated mastery
COMMENT ON COLUMN knowledge_points.mastery_level IS
  'Derived display mastery (0.00~1.00 DECIMAL(3,2)) from associated study_cards via aggregateDisplayMastery(strategy=''stabilityWeighted''). @mastery display: badges / progress bars / graph node color. @schedule decision: soft learning-state routing fallback only. SINGLE WRITE SOURCE = masteryCalculationService.batchUpdateMasteryLevels / updateKnowledgePointMastery';

-- task_subtasks: NOTE — there is NO physical `mastery_level` column on task_subtasks.
-- mastery_level exposed via the API is a JOIN-derived virtual field that proxies
-- knowledge_points.mastery_level (see getSubtaskData in subtaskQuizIntegration.ts).
