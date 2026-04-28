import { logger } from "../../utils/logger";

interface LockEntry {
  graphId: string;
  acquiredAt: number;
  taskId: string;
}

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

class GraphLockService {
  private locks: Map<string, LockEntry> = new Map();

  async acquireLock(graphId: string, taskId: string): Promise<boolean> {
    const existingLock = this.locks.get(graphId);

    if (existingLock) {
      const elapsed = Date.now() - existingLock.acquiredAt;
      if (elapsed < LOCK_TIMEOUT_MS) {
        logger.info(
          `[GraphLockService] Graph ${graphId} is locked by task ${existingLock.taskId}`,
        );
        return false;
      }
      logger.warn(
        `[GraphLockService] Lock for graph ${graphId} expired, releasing`,
      );
      this.locks.delete(graphId);
    }

    this.locks.set(graphId, {
      graphId,
      acquiredAt: Date.now(),
      taskId,
    });

    logger.info(
      `[GraphLockService] Lock acquired for graph ${graphId} by task ${taskId}`,
    );
    return true;
  }

  releaseLock(graphId: string, taskId: string): void {
    const lock = this.locks.get(graphId);
    if (lock && lock.taskId === taskId) {
      this.locks.delete(graphId);
      logger.info(
        `[GraphLockService] Lock released for graph ${graphId} by task ${taskId}`,
      );
    }
  }

  isLocked(graphId: string): boolean {
    const lock = this.locks.get(graphId);
    if (!lock) return false;

    const elapsed = Date.now() - lock.acquiredAt;
    if (elapsed >= LOCK_TIMEOUT_MS) {
      this.locks.delete(graphId);
      return false;
    }

    return true;
  }

  getLockInfo(graphId: string): LockEntry | null {
    return this.locks.get(graphId) || null;
  }
}

export const graphLockService = new GraphLockService();
