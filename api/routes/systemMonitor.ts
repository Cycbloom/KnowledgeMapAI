import { Router } from "express";
import os from "os";
import { logger } from "../utils/logger";
import { supabaseAdmin } from "../supabase";

const router = Router();

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  uptime: number;
  platform: string;
  nodeVersion: string;
}

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency?: number;
  message?: string;
  lastCheck: string;
}

const getCpuUsage = (): number => {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += (cpu.times as Record<string, number>)[type];
    }
    totalIdle += cpu.times.idle;
  });

  const totalUsed = totalTick - totalIdle;
  return Math.round((totalUsed / totalTick) * 100);
};

const getMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total: Math.round((total / 1024 / 1024 / 1024) * 100) / 100,
    used: Math.round((used / 1024 / 1024 / 1024) * 100) / 100,
    free: Math.round((free / 1024 / 1024 / 1024) * 100) / 100,
    usagePercent: Math.round((used / total) * 100),
  };
};

router.get("/system", async (_req, res) => {
  try {
    const cpuUsage = getCpuUsage();
    const memoryUsage = getMemoryUsage();
    const cpus = os.cpus();

    const stats: SystemStats = {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
      },
      memory: memoryUsage,
      uptime: Math.floor(process.uptime()),
      platform: process.platform,
      nodeVersion: process.version,
    };

    res.json(stats);
  } catch (error) {
    logger.error("Failed to get system stats:", error);
    res.status(500).json({ error: "Failed to get system stats" });
  }
});

router.get("/services", async (_req, res) => {
  const services: ServiceStatus[] = [];
  const now = new Date().toISOString();

  const checkDatabase = async (): Promise<ServiceStatus> => {
    const start = Date.now();
    try {
      const { error } = await supabaseAdmin
        .from("knowledge_graphs")
        .select("id")
        .limit(1);

      const latency = Date.now() - start;

      if (error) {
        return {
          name: "PostgreSQL (Supabase)",
          status: "down",
          latency,
          message: error.message,
          lastCheck: now,
        };
      }

      return {
        name: "PostgreSQL (Supabase)",
        status: latency < 100 ? "healthy" : "degraded",
        latency,
        lastCheck: now,
      };
    } catch (error) {
      return {
        name: "PostgreSQL (Supabase)",
        status: "down",
        message: error instanceof Error ? error.message : "Unknown error",
        lastCheck: now,
      };
    }
  };

  const dbStatus = await checkDatabase();
  services.push(dbStatus);

  res.json({ services });
});

interface RequestStats {
  total: number;
  success: number;
  errors: number;
  avgResponseTime: number;
  byEndpoint: Record<
    string,
    { count: number; avgTime: number; errors: number }
  >;
}

let requestStats: RequestStats = {
  total: 0,
  success: 0,
  errors: 0,
  avgResponseTime: 0,
  byEndpoint: {},
};

let totalResponseTime = 0;

export const recordRequest = (
  endpoint: string,
  responseTime: number,
  isError: boolean,
) => {
  requestStats.total++;
  totalResponseTime += responseTime;
  requestStats.avgResponseTime = Math.round(
    totalResponseTime / requestStats.total,
  );

  if (isError) {
    requestStats.errors++;
  } else {
    requestStats.success++;
  }

  if (!requestStats.byEndpoint[endpoint]) {
    requestStats.byEndpoint[endpoint] = { count: 0, avgTime: 0, errors: 0 };
  }

  const endpointStats = requestStats.byEndpoint[endpoint];
  endpointStats.count++;
  endpointStats.avgTime = Math.round(
    (endpointStats.avgTime * (endpointStats.count - 1) + responseTime) /
      endpointStats.count,
  );

  if (isError) {
    endpointStats.errors++;
  }
};

router.get("/requests", (req, res) => {
  const hours = parseInt(req.query.hours as string) || 24;

  res.json({
    ...requestStats,
    period: `Last ${hours} hours`,
    errorRate:
      requestStats.total > 0
        ? Math.round((requestStats.errors / requestStats.total) * 100 * 100) /
          100
        : 0,
  });
});

router.get("/requests/reset", (_req, res) => {
  requestStats = {
    total: 0,
    success: 0,
    errors: 0,
    avgResponseTime: 0,
    byEndpoint: {},
  };
  totalResponseTime = 0;

  res.json({ success: true, message: "Request stats reset" });
});

router.get("/logs", async (_req, res) => {
  try {
    const logs: unknown[] = [];

    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error("Failed to get logs:", error);
    res.status(500).json({ error: "Failed to get logs" });
  }
});

router.get("/dashboard", async (_req, res) => {
  try {
    const [cpuUsage, memoryUsage] = [getCpuUsage(), getMemoryUsage()];
    const cpus = os.cpus();

    const dbStart = Date.now();
    let dbStatus = "healthy";
    let dbLatency = 0;
    try {
      const { error } = await supabaseAdmin
        .from("knowledge_graphs")
        .select("id")
        .limit(1);
      dbLatency = Date.now() - dbStart;
      if (error) dbStatus = "down";
    } catch {
      dbStatus = "down";
    }

    res.json({
      system: {
        cpu: {
          usage: cpuUsage,
          cores: cpus.length,
          model: cpus[0]?.model || "Unknown",
        },
        memory: memoryUsage,
        uptime: Math.floor(process.uptime()),
        platform: process.platform,
        nodeVersion: process.version,
        hostname: os.hostname(),
      },
      services: {
        database: {
          status: dbStatus,
          latency: dbLatency,
        },
      },
      requests: {
        total: requestStats.total,
        success: requestStats.success,
        errors: requestStats.errors,
        avgResponseTime: requestStats.avgResponseTime,
        errorRate:
          requestStats.total > 0
            ? Math.round(
                (requestStats.errors / requestStats.total) * 100 * 100,
              ) / 100
            : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get dashboard data:", error);
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
});

export default router;
