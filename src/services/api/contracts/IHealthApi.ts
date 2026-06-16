export interface IHealthApi {
  getOverview(): Promise<unknown>;

  getHeatmap(): Promise<unknown>;

  getWeakPoints(): Promise<unknown>;

  getWeeklyActivity(days?: number): Promise<unknown>;

  getPredictions(): Promise<unknown>;
}
