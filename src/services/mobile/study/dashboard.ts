import type { IDashboardApi } from "../../api/contracts/IDashboardApi";

export const mobileDashboardApi: IDashboardApi = {
  getStats: async () => {
    // 移动端无法计算热力图、盲点卡片、分布等聚合数据（依赖后端 RPC），
    // 返回空结构，聚合数据由桌面端下次登录时同步。
    return {
      heatmap: [],
      blindSpots: [],
      distribution: [],
    };
  },
  getTodaySummary: async () => {
    // 移动端不展示"今日回顾"聚合摘要（依赖后端 RPC 统计），返回全零计数。
    return {
      inboxCount: 0,
      dueCards: 0,
      dueTasks: 0,
    };
  },
};
