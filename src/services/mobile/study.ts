

export const mobileStudyApi = {
  getCards: (_params?: any) => {
    return { cards: [] };
  },
  getCardsByKnowledgePoint: (_knowledgePointId: string, _params?: any) => {
    return { cards: [] };
  },
  createCardsBatch: (_cards: unknown[]) => {
    return { success: true };
  },
  update: (_id: string, _data: unknown) => {
    return { success: true };
  },
  delete: (_id: string) => {
    return { success: true };
  },
  deleteBatch: (_ids: string[]) => {
    return { success: true };
  },
  updateProgress: (_id: string, _quality: number) => {
    return { success: true };
  },
  getCardGroups: (_knowledgePointId: string) => {
    return [];
  },
};

export const mobileDashboardApi = {
  getStats: async () => {
    return {
      total_graphs: 0,
      total_nodes: 0,
      total_edges: 0,
      total_study_cards: 0,
      study_streak: 0,
      today_reviews: 0,
    };
  },
};

export const mobileStatisticsApi = {
  getStats: async () => {
    return {
      metrics: {
        learning: 0,
        dueToday: 0,
        mastered: 0,
        new: 0,
      },
      distribution: {
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
      },
      heatmapData: [],
      weeklyData: [],
      forecastData: [],
      retentionThreshold: 0.9,
      avgStability: 7,
    };
  },
};
