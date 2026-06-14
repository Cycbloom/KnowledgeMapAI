// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ISchedulerApi = Record<string, (...args: any[]) => Promise<any>>;