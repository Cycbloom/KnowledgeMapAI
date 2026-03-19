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

let resolvedApi: ApiType | null = null;

function getResolvedApi(): ApiType {
  if (resolvedApi) {
    return resolvedApi;
  }

  console.log('[api adapter] Determining API type...');
  const isMobile = isCapacitorMobile();
  console.log('[api adapter] isCapacitorMobile() returned:', isMobile);

  if (isMobile) {
    console.log('[api adapter] Using mobile API');
    resolvedApi = {
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
  } else {
    console.log('[api adapter] Using web API');
    resolvedApi = webApi;
  }

  return resolvedApi;
}

export const getApi = getResolvedApi;

export const api = new Proxy({} as ApiType, {
  get(_target, prop) {
    const currentApi = getResolvedApi();
    return (currentApi as any)[prop];
  },
}) as ApiType;
