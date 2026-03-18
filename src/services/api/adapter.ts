import { isCapacitorMobile } from '../../config/mobileApiConfig';
import { api as webApi } from './index';
import { mobileApi } from '../mobile';

type ApiType = typeof webApi;

export const getApi = (): ApiType => {
  if (isCapacitorMobile()) {
    return {
      ...webApi,
      graphs: mobileApi.graphs as any,
      nodes: mobileApi.nodes as any,
      edges: mobileApi.edges as any,
      ai: mobileApi.ai as any,
      study: mobileApi.study as any,
      dashboard: mobileApi.dashboard as any,
      statistics: mobileApi.statistics as any,
    };
  }
  return webApi;
};

export const api = getApi();
