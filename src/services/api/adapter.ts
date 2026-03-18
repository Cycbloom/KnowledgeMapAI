import { isCapacitorMobile } from "../../config/mobileApiConfig";
import { api as webApi } from "./index";
import {
  mobileAuthApi,
  mobileGraphsApi,
  mobileNodesApi,
  mobileEdgesApi,
  mobileAiApi,
  mobileStudyApi,
  mobileDashboardApi,
  mobileStatisticsApi,
} from "../mobile";

type ApiType = typeof webApi;

const createNoopApi = (originalApi: any) => {
  const noop = () => Promise.resolve({});

  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === "function") {
        return noop;
      }
      if (value && typeof value === "object") {
        return createNoopApi(value);
      }
      return noop;
    },
  };

  return new Proxy(originalApi, handler);
};

export const getApi = (): ApiType => {
  if (isCapacitorMobile()) {
    return {
      ...webApi,
      auth: mobileAuthApi || webApi.auth,
      graphs: mobileGraphsApi || webApi.graphs,
      nodes: mobileNodesApi || webApi.nodes,
      edges: mobileEdgesApi || webApi.edges,
      ai: mobileAiApi || webApi.ai,
      study: mobileStudyApi || webApi.study,
      dashboard: mobileDashboardApi || webApi.dashboard,
      statistics: mobileStatisticsApi || webApi.statistics,
      knowledgePoints: createNoopApi(webApi.knowledgePoints),
      graphNodes: createNoopApi(webApi.graphNodes),
      combinedView: createNoopApi(webApi.combinedView),
      tts: createNoopApi(webApi.tts),
      search: createNoopApi(webApi.search),
      tasks: createNoopApi(webApi.tasks),
      data: createNoopApi(webApi.data),
      templates: createNoopApi(webApi.templates),
      prompts: createNoopApi(webApi.prompts),
      focus: createNoopApi(webApi.focus),
      achievements: createNoopApi(webApi.achievements),
      periodicTasks: createNoopApi(webApi.periodicTasks),
      learningPaths: createNoopApi(webApi.learningPaths),
      rag: createNoopApi(webApi.rag),
      autoGraph: createNoopApi(webApi.autoGraph),
      learningPath: createNoopApi(webApi.learningPath),
      health: createNoopApi(webApi.health),
      backup: createNoopApi(webApi.backup),
      scheduler: createNoopApi(webApi.scheduler),
      quiz: createNoopApi(webApi.quiz),
      aiActions: createNoopApi(webApi.aiActions),
    };
  }
  return webApi;
};

export const api = getApi();
