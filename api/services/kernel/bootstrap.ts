import { Kernel } from "./Kernel";
import { corePlugin } from "../plugins/CorePlugin";
import { graphPlugin } from "../plugins/GraphPlugin";
import { AIPlugin as aiPlugin } from "../plugins/AIPlugin";
import { StudyPlugin as studyPlugin } from "../plugins/StudyPlugin";
import { SchedulerPlugin as schedulerPlugin } from "../plugins/SchedulerPlugin";
import { AgentPlugin as agentPlugin } from "../plugins/AgentPlugin";

/**
 * 构造一个 Kernel 实例并注册全部内置插件。
 *
 * 将 Kernel bootstrap 集中到此函数，使：
 * - `api/app.ts` 的生产入口仅需一次调用即可获得已注册插件的 Kernel
 * - 测试可通过 `createApp(undefined)` 跳过 Kernel 副作用，实现隔离测试
 * - 未来新增入口（如 Electron 直接构造）可复用同一 bootstrap 路径
 */
export function bootstrapKernel(): Kernel {
  const kernel = new Kernel();
  kernel.registerPlugin(corePlugin);
  kernel.registerPlugin(graphPlugin);
  kernel.registerPlugin(aiPlugin);
  kernel.registerPlugin(studyPlugin);
  kernel.registerPlugin(schedulerPlugin);
  kernel.registerPlugin(agentPlugin);
  return kernel;
}
