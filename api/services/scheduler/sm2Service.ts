import { logger } from '../../utils/logger';

export interface SM2Result {
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: Date;
}

export interface SM2Input {
  quality: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export interface ReviewTaskData {
  id: string;
  knowledge_point_id: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
  last_review_date?: string;
  last_quality_score?: number;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

export class SM2Service {
  static calculateNextReview(input: SM2Input): SM2Result {
    const { quality, interval, easeFactor, repetitions } = input;

    const validatedQuality = Math.max(0, Math.min(5, Math.round(quality)));
    let newEaseFactor = easeFactor;
    let newRepetitions = repetitions;
    let newInterval = interval;

    if (validatedQuality < 3) {
      newRepetitions = 0;
      newInterval = 1;
    } else {
      newRepetitions = repetitions + 1;

      if (newRepetitions === 1) {
        newInterval = 1;
      } else if (newRepetitions === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * newEaseFactor);
      }
    }

    newEaseFactor = easeFactor + (0.1 - (5 - validatedQuality) * (0.08 + (5 - validatedQuality) * 0.02));
    newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    logger.info('SM-2 calculation completed', {
      quality: validatedQuality,
      oldInterval: interval,
      newInterval,
      oldEF: easeFactor,
      newEF: newEaseFactor,
      repetitions: newRepetitions,
    });

    return {
      interval: newInterval,
      easeFactor: Math.round(newEaseFactor * 100) / 100,
      repetitions: newRepetitions,
      nextReviewDate,
    };
  }

  static getInitialReviewParams(): { interval: number; easeFactor: number; repetitions: number } {
    return {
      interval: 1,
      easeFactor: DEFAULT_EASE_FACTOR,
      repetitions: 0,
    };
  }

  static calculateUrgency(reviewTask: ReviewTaskData): 'overdue' | 'today' | 'upcoming' | 'future' {
    const now = new Date();
    const nextReview = new Date(reviewTask.next_review_date);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (nextReview < now) {
      return 'overdue';
    } else if (nextReview <= todayEnd) {
      return 'today';
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      if (nextReview < nextWeek) {
        return 'upcoming';
      }
      return 'future';
    }
  }

  static calculatePriorityScore(
    reviewTask: ReviewTaskData,
    masteryLevel: number
  ): number {
    const urgency = this.calculateUrgency(reviewTask);

    const urgencyScores: Record<string, number> = {
      overdue: 100,
      today: 80,
      upcoming: 50,
      future: 20,
    };

    const urgencyScore = urgencyScores[urgency] || 0;
    const masteryScore = (1 - masteryLevel) * 50;
    const intervalScore = Math.max(0, 30 - reviewTask.interval_days * 2);

    return urgencyScore + masteryScore + intervalScore;
  }

  static sortReviewTasksByPriority(
    reviewTasks: ReviewTaskData[],
    masteryLevels: Record<string, number>
  ): ReviewTaskData[] {
    return [...reviewTasks].sort((a, b) => {
      const scoreA = this.calculatePriorityScore(a, masteryLevels[a.knowledge_point_id] || 0);
      const scoreB = this.calculatePriorityScore(b, masteryLevels[b.knowledge_point_id] || 0);
      return scoreB - scoreA;
    });
  }

  static estimateMasteryLevel(
    easeFactor: number,
    repetitions: number,
    intervalDays: number
  ): number {
    const efScore = Math.min(1, (easeFactor - MIN_EASE_FACTOR) / (DEFAULT_EASE_FACTOR - MIN_EASE_FACTOR));
    const repScore = Math.min(1, repetitions / 10);
    const intervalScore = Math.min(1, intervalDays / 30);

    const mastery = (efScore * 0.4 + repScore * 0.3 + intervalScore * 0.3);
    return Math.round(mastery * 100) / 100;
  }

  static suggestReviewTime(quality: number): string {
    if (quality < 2) {
      return '建议立即重新学习该知识点';
    } else if (quality < 4) {
      return '建议增加复习频率，巩固记忆';
    } else {
      return '掌握良好，按计划复习即可';
    }
  }
}

export const sm2Service = SM2Service;
