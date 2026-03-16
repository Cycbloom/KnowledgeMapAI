export const taskProcessors = {};
export function registerProcessor(type, processor) {
    taskProcessors[type] = processor;
}
export function getProcessor(type) {
    return taskProcessors[type];
}
//# sourceMappingURL=index.js.map