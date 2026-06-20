import { SupabaseClient } from "@supabase/supabase-js";
import {
  fsrs,
  createEmptyCard,
  State,
  default_w,
  checkParameters,
  migrateParameters,
  generatorParameters,
  type Card,
  type Grade,
} from "ts-fsrs";
import { logger } from "../../utils/logger";

// 最少复习记录数
const MIN_REVIEW_COUNT = 100;

// 优化迭代次数
const MAX_ITERATIONS = 50;

// 数值微分的微扰量
const EPSILON = 1e-4;

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
    const { data } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    const currentSettings = (data?.settings as Record<string, unknown>) ?? {};
    const { fsrs_parameters, fsrs_parameter_source, fsrs_last_optimized_at, ...restSettings } = currentSettings as Record<string, unknown>;
    void fsrs_parameters; void fsrs_parameter_source; void fsrs_last_optimized_at;

    const { error } = await supabase
      .from("users")
      .update({ settings: restSettings })
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
      .select("fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, review_count, last_rating")
      .eq("user_id", userId)
      .gt("review_count", 0);

    if (error) {
      logger.error("Failed to collect review history", { userId, error: error.message });
      return [];
    }

    // 从有复习记录的卡片中提取训练数据
    // 只使用有真实评分记录的样本，过滤掉 last_rating 为 null 的记录
    // 避免所有样本使用默认 rating=3 导致优化偏差
    return (data ?? [])
      .filter((card) => card.fsrs_stability > 0 && card.review_count > 0 && card.last_rating != null)
      .map((card) => ({
        rating: card.last_rating,
        elapsed_days: card.fsrs_elapsed_days ?? 1,
        scheduled_days: card.fsrs_scheduled_days ?? 1,
        state: card.fsrs_state ?? "Review",
        stability: card.fsrs_stability,
        difficulty: card.fsrs_difficulty,
      }));
  }

  /**
   * 轻量级参数优化算法
   * 使用数值微分（有限差分法）计算每个参数的独立梯度：
   * ∂L/∂w[i] ≈ (L(w + ε·e_i) - L(w)) / ε
   */
  private runOptimization(initialW: number[], reviews: ReviewRecord[]): number[] {
    let w = [...initialW];
    const learningRate = 0.01;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const baseLoss = this.computeLoss(w, reviews);
      const gradients = new Array(w.length).fill(0);

      // 对每个参数独立计算梯度
      for (let i = 0; i < w.length; i++) {
        const wPerturbed = [...w];
        wPerturbed[i] += EPSILON;

        const perturbedLoss = this.computeLoss(wPerturbed, reviews);
        gradients[i] = (perturbedLoss - baseLoss) / EPSILON;
      }

      // 梯度裁剪：防止梯度爆炸
      const gradNorm = Math.sqrt(gradients.reduce((sum, g) => sum + g * g, 0));
      const maxGradNorm = 10.0;
      const clippedGradients = gradNorm > maxGradNorm
        ? gradients.map((g) => g * (maxGradNorm / gradNorm))
        : gradients;

      // 更新参数
      for (let i = 0; i < w.length; i++) {
        w[i] -= learningRate * clippedGradients[i];
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
   * 计算给定参数下的损失函数（对数间隔的均方误差）
   */
  private computeLoss(w: number[], reviews: ReviewRecord[]): number {
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

          const ratingValue = review.rating as Grade;
          const result = f.next(simulatedCard, new Date(), ratingValue);
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

    return count > 0 ? totalError / count : Infinity;
  }

  /**
   * 计算预测误差（均方根误差 RMSE）
   */
  private calculatePredictionError(w: number[], reviews: ReviewRecord[]): number {
    const loss = this.computeLoss(w, reviews);
    return loss === Infinity ? Infinity : Math.sqrt(loss);
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
