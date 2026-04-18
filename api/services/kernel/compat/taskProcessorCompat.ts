import type { Kernel } from "../Kernel";
import type { TaskProcessor } from "../../taskProcessors/index";
import { logger } from "../../../utils/logger";

const processorMap = new Map<string, TaskProcessor>();
let kernelInstance: Kernel | null = null;

export function initTaskProcessorCompat(kernel: Kernel): void {
  kernelInstance = kernel;
  logger.info("[TaskProcessorCompat] Initialized with Kernel");
}

export function registerProcessor(type: string, processor: TaskProcessor): void {
  processorMap.set(type, processor);

  if (kernelInstance) {
    kernelInstance.registerExtension("taskProcessor", { type, processor });
  }
}

export function getProcessor(type: string): TaskProcessor | undefined {
  return processorMap.get(type);
}

export const taskProcessors = new Proxy({} as Record<string, TaskProcessor>, {
  get(_target, prop: string) {
    return processorMap.get(prop);
  },
  set(_target, prop: string, value: TaskProcessor) {
    registerProcessor(prop, value);
    return true;
  },
  ownKeys() {
    return Array.from(processorMap.keys());
  },
  has(_target, prop: string) {
    return processorMap.has(prop);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (processorMap.has(prop)) {
      return { configurable: true, enumerable: true, value: processorMap.get(prop) };
    }
    return undefined;
  },
});
