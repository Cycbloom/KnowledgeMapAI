import { Queue } from "bullmq";
import Redis from "ioredis";
import { logger } from "../../utils/logger";
import { isRedisAvailable } from "../../utils/redis";

let taskQueue: Queue | null = null;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  logger.info("🔌 Initializing Task Queue...");

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  connection.on("error", (err) => {
    if (isRedisAvailable) {
      logger.warn("Queue Redis connection error:", err.message);
    }
  });

  connection.on("connect", () => {
    logger.info("✅ Queue Redis connected");
  });

  connection.on("ready", () => {
    if (!taskQueue) {
      taskQueue = new Queue("task-queue", { connection });
      logger.info("✅ Task Queue initialized with Redis");
    }
  });

  connection.on("close", () => {
    if (taskQueue) {
      logger.warn("⚠️ Queue Redis connection closed, task scheduling disabled");
      taskQueue = null;
    }
  });

  connection.connect().catch((err) => {
    logger.warn("⚠️ Failed to connect to Redis for queue:", err.message);
    logger.info(
      "📦 Task scheduling will be disabled, using synchronous processing",
    );
  });
} else {
  logger.warn("⚠️ No REDIS_URL found, task scheduling will be disabled");
}

export { taskQueue };
