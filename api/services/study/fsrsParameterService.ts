import { SupabaseClient } from "@supabase/supabase-js";
import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  default_w,
  checkParameters,
  migrateParameters,
  generatorParameters,
  type Card,
} from "ts-fsrs";
import { logger } from "../../utils/logger";

// 最少复习记录数
const MIN_REVIEW_COUNT = 100;

// 优化迭代次数
const MAX_ITERATIONS = 50;

// 学习率
const LEARNING_RATE = 0.01;

export interface FsrsParameterSource {
  source: "default" | "custom" | "optimized";
  w: number[];
  request_retention: number;
  maximum_interval: number;
  last_optimized_at: string | null;
}

export interface OptimizeResult {
  success: boolean;
  oldW: number[];
  newW: number[];
  improvement: number;
  reviewCount: number;
  message: string;
}

interface ReviewRecord {
  rating: number;
  elapsed_days: number;
  scheduled_days: number;
  state: string;
  stability: number;
  difficulty: number;
}

export class FsrsParameterService {
  /**
   * 获取用户当前 FSRS 参数信息
   */
  async getParameters(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<FsrsParameterSource> {
    const { data } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    const settings = data?.settings ?? {};
    const storedW = settings.fsrs_parameters as number[] | undefined;
    const source: FsrsParameterSource["source"] = storedW
      ? (settings.fsrs_parameter_source as FsrsParameterSource["source"]) ?? "custom"
      : "default";

    return {
      source,
      w: storedW ? migrateParameters(storedW) : [...default_w],
      request_retention: settings.request_retention ?? 0.9,
      maximum_interval: settings.maximum_interval ?? 36500,
      last_optimized_at: settings.fsrs_last_optimized_at ?? null,
    };
  }

  /**
   * 手动设置 FSRS 参数
   */
  async setParameters(
    supabase: SupabaseClient,
    userId: string,
    w: number[],
  ): Promise<FsrsParameterSource> {
    const validatedW = checkParameters(w);
    const migratedW = migrateParameters([...validatedW]);

    await this.saveParameters(supabase, userId, migratedW, "custom");

    return {
      source: "custom",
      w: migratedW,
      request_retention: 0.9,
      maximum_interval: 36500,
      last_optimized_at: null,
    };
  }

  /**
   * 重置为默认参数
   */
  async resetParameters(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({
        settings: {
          fsrs_parameters: null,
          fsrs_parameter_source: null,
          fsrs_last_optimized_at: null,
        },
      })
      .eq("id", userId);

    if (error) {
      logger.error("Failed to reset FSRS parameters", { userId, error: error.message });
      throw error;
    }
  }

  /**
   * 触发参数优化
   */
  async optimizeParameters(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<OptimizeResult> {
    // 1. 收集复习历史
    const reviews = await this.collectReviewHistory(supabase, userId);

    if (reviews.length < MIN_REVIEW_COUNT) {
      return {
        success: false,
        oldW: [...default_w],
        newW: [...default_w],
        improvement: 0,
        reviewCount: reviews.length,
        message: `复习数据不足（${reviews.length}/${MIN_REVIEW_COUNT}），继续使用默认参数`,
      };
    }

    // 2. 获取当前参数
    const currentParams = await this.getParameters(supabase, userId);
    const oldW = [...currentParams.w];

    // 3. 运行优化
    const optimizedW = this.runOptimization(oldW, reviews);

    // 4. 验证参数
    try {
      checkParameters(optimizedW);
    } catch {
      logger.warn("Optimized parameters failed validation, keeping current", { userId });
      return {
        success: false,
        oldW,
        newW: oldW,
        improvement: 0,
        reviewCount: reviews.length,
        message: "优化后参数验证失败，保留当前参数",
      };
    }

    // 5. 计算改进度
    const oldError = this.calculatePredictionError(oldW, reviews);
    const newError = this.calculatePredictionError(optimizedW, reviews);
    const improvement = oldError > 0 ? (oldError - newError) / oldError : 0;

    // 6. 存储
    await this.saveParameters(supabase, userId, optimizedW, "optimized");

    logger.info("FSRS parameters optimized", {
      userId,
      reviewCount: reviews.length,
      improvement: Math.round(improvement * 100) / 100,
    });

    return {
      success: true,
      oldW,
      newW: optimizedW,
      improvement: Math.round(improvement * 10000) / 10000,
      reviewCount: reviews.length,
      message: `参数优化完成，预测误差降低 ${Math.round(improvement * 100)}%`,
    };
  }

  /**
   * 收集用户复习历史数据
   */
  private async collectReviewHistory(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<ReviewRecord[]> {
    const { data, error } = await supabase
      .from("study_cards")
      .select("fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, review_count")
      .eq("user_id", userId)
      .gt("review_count", 0);

    if (error) {
      logger.error("Failed to collect review history", { userId, error: error.message });
      return [];
    }

    // 从有复习记录的卡片中提取训练数据
    // 注意：study_cards 表没有直接存储 rating 历史，我们用当前状态反推
    // 通过 fsrs_state、stability、difficulty、scheduled_days 等参数重建训练数据
    return (data ?? [])
      .filter((card) => card.fsrs_stability > 0 && card.review_count > 0)
      .map((card) => ({
        rating: 3, // 默认 Good（无法获取历史 rating，使用最常见值）
        elapsed_days: card.fsrs_elapsed_days ?? 1,
        scheduled_days: card.fsrs_scheduled_days ?? 1,
        state: card.fsrs_state ?? "Review",
        stability: card.fsrs_stability,
        difficulty: card.fsrs_difficulty,
      }));
  }

  /**
   * 轻量级参数优化算法
   * 使用简化的梯度下降：调整 w 参数使预测的 scheduled_days 更接近实际
   */
  private runOptimization(initialW: number[], reviews: ReviewRecord[]): number[] {
    let w = [...initialW];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const gradients = new Array(w.length).fill(0);

      for (const review of reviews) {
        // 使用 FSRS 算法预测间隔
        try {
          const params = generatorParameters({ w });
          const f = fsrs(params);
          const card = createEmptyCard();
          // 模拟从当前状态复习
          const simulatedCard: Card = {
            ...card,
            stability: review.stability,
            difficulty: review.difficulty,
            state: State.Review,
            reps: 1,
            elapsed_days: review.elapsed_days,
            scheduled_days: review.scheduled_days,
            lapses: 0,
            learning_steps: 0,
          };

          const result = f.next(simulatedCard, new Date(), Rating.Good);
          const predictedInterval = result.card.scheduled_days;
          const actualInterval = review.scheduled_days;

          // 计算误差
          const error = predictedInterval - actualInterval;

          // 简化梯度：对 w 的每个参数施加微扰
          for (let i = 0; i < w.length; i++) {
            gradients[i] += error * 0.001; // 缩放因子
          }
        } catch {
          // 跳过无法计算的样本
          continue;
        }
      }

      // 更新参数
      const sampleCount = reviews.length || 1;
      for (let i = 0; i < w.length; i++) {
        w[i] -= LEARNING_RATE * gradients[i] / sampleCount;
      }

      // 钳制参数到合法范围
      try {
        w = [...migrateParameters(w)];
      } catch {
        break; // 参数越界，停止优化
      }
    }

    return w;
  }

  /**
   * 计算预测误差（均方根误差 RMSE）
   */
  private calculatePredictionError(w: number[], reviews: ReviewRecord[]): number {
    let totalError = 0;
    let count = 0;

    try {
      const params = generatorParameters({ w });
      const f = fsrs(params);

      for (const review of reviews) {
        try {
          const simulatedCard: Card = {
            ...createEmptyCard(),
            stability: review.stability,
            difficulty: review.difficulty,
            state: State.Review,
            reps: 1,
            elapsed_days: review.elapsed_days,
            scheduled_days: review.scheduled_days,
            lapses: 0,
            learning_steps: 0,
          };

          const result = f.next(simulatedCard, new Date(), Rating.Good);
          const predicted = result.card.scheduled_days;
          const actual = review.scheduled_days;

          // 使用对数误差，避免大间隔主导
          const logPredicted = Math.log(Math.max(1, predicted));
          const logActual = Math.log(Math.max(1, actual));
          totalError += (logPredicted - logActual) ** 2;
          count++;
        } catch {
          continue;
        }
      }
    } catch {
      return Infinity;
    }

    return count > 0 ? Math.sqrt(totalError / count) : Infinity;
  }

  /**
   * 保存参数到用户设置
   */
  private async saveParameters(
    supabase: SupabaseClient,
    userId: string,
    w: number[],
    source: "custom" | "optimized",
  ): Promise<void> {
    // 先获取当前 settings
    const { data } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    const currentSettings = (data?.settings as Record<string, unknown>) ?? {};

    const updatedSettings = {
      ...currentSettings,
      fsrs_parameters: w,
      fsrs_parameter_source: source,
      fsrs_last_optimized_at: source === "optimized" ? new Date().toISOString() : currentSettings.fsrs_last_optimized_at ?? null,
    };

    const { error } = await supabase
      .from("users")
      .update({ settings: updatedSettings })
      .eq("id", userId);

    if (error) {
      logger.error("Failed to save FSRS parameters", { userId, error: error.message });
      throw error;
    }
  }
}

export const fsrsParameterService = new FsrsParameterService();
