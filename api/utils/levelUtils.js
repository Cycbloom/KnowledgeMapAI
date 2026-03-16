export const LEVEL_ORDER = ['root', 'core', 'sub', 'normal', 'leaf'];
export function getNextLevel(currentLevel) {
    const index = LEVEL_ORDER.indexOf(currentLevel);
    if (index === -1 || index >= LEVEL_ORDER.length - 1) {
        return 'leaf';
    }
    return LEVEL_ORDER[index + 1];
}
export function getPreviousLevel(currentLevel) {
    const index = LEVEL_ORDER.indexOf(currentLevel);
    if (index <= 0) {
        return 'root';
    }
    return LEVEL_ORDER[index - 1];
}
export function getLevelIndex(level) {
    return LEVEL_ORDER.indexOf(level);
}
export const LEVEL_WEIGHTS = {
    root: 1.0,
    core: 0.8,
    sub: 0.6,
    normal: 0.4,
    leaf: 0.2
};
//# sourceMappingURL=levelUtils.js.map