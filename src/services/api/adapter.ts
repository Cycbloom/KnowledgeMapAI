// 三端同构：手机/Web/Electron 共用同一套 webApi（IApi 契约不变）。
// 历史上有按环境切换 Supabase 直连层的逻辑（preloadMobileApi），
// 该链路由从未配置的 VITE_MOBILE_USE_SUPABASE_DIRECT 开关控制、整体休眠，
// 阶段 4 已随 src/services/mobile/ 一并删除，此处收敛为薄转发。

import { api } from "./index";

export { api };

export const getApi = () => api;
