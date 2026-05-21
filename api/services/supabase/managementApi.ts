import { appSettingsService } from "../core/appSettingsService";
import { reinitializeSupabaseClients } from "../../supabase";
import { migrationService } from "../migration/migrationService";
import { logger } from "../../utils/logger";

const SUPABASE_API_BASE = "https://api.supabase.com/v1";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Region {
  code: string;
  name: string;
  location: string;
}

interface CreateProjectOptions {
  organizationSlug: string;
  projectName: string;
  dbPassword: string;
  region: string;
}

interface ProjectCredentials {
  projectRef: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
}

interface QuickSetupResult extends ProjectCredentials {
  migrationResults: Array<{
    version: string;
    success: boolean;
    error?: string;
    duration: number;
  }>;
}

const REGION_NAME_MAP: Record<string, string> = {
  "us-east-1": "US East (N. Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ap-northeast-2": "Asia Pacific (Seoul)",
  "ap-northeast-3": "Asia Pacific (Osaka)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "eu-west-1": "EU (Ireland)",
  "eu-west-2": "EU (London)",
  "eu-west-3": "EU (Paris)",
  "eu-central-1": "EU (Frankfurt)",
  "eu-central-2": "EU (Zurich)",
  "ca-central-1": "Canada (Central)",
  "sa-east-1": "South America (São Paulo)",
  "me-south-1": "Middle East (Bahrain)",
  "af-south-1": "Africa (Cape Town)",
};

async function apiRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${SUPABASE_API_BASE}${path}`, options);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      (errorBody as { message?: string; msg?: string; error?: string })
        .message ??
      (errorBody as { msg?: string }).msg ??
      (errorBody as { error?: string }).error ??
      `Supabase API error: ${response.status}`;

    if (response.status === 401) {
      throw new Error("Personal Access Token is invalid or expired");
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listOrganizations(
  accessToken: string,
): Promise<Organization[]> {
  const data = (await apiRequest(
    accessToken,
    "GET",
    "/organizations",
  )) as Array<{ id: string; name: string; slug: string }>;

  return data.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
  }));
}

async function listRegions(accessToken: string): Promise<Region[]> {
  const data = (await apiRequest(
    accessToken,
    "GET",
    "/projects/available-regions",
  )) as Record<string, { name?: string; location?: string }>;

  const regions: Region[] = [];

  for (const [code, info] of Object.entries(data)) {
    regions.push({
      code,
      name: REGION_NAME_MAP[code] ?? info.name ?? code,
      location: info.location ?? "",
    });
  }

  return regions;
}

async function createProject(
  accessToken: string,
  options: CreateProjectOptions,
): Promise<{ ref: string; name: string }> {
  const data = (await apiRequest(accessToken, "POST", "/projects", {
    name: options.projectName,
    organization_slug: options.organizationSlug,
    db_pass: options.dbPassword,
    region: options.region,
  })) as { ref: string; name: string };

  return { ref: data.ref, name: data.name };
}

async function waitForProjectReady(
  accessToken: string,
  projectRef: string,
  timeoutMs: number = 180000,
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 10000;

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const data = (await apiRequest(
          accessToken,
          "GET",
          `/projects/${projectRef}/health`,
        )) as Array<{ status: string }>;

        const allHealthy =
          Array.isArray(data) &&
          data.length > 0 &&
          data.every((service) => service.status === "ACTIVE_HEALTHY");

        if (allHealthy) {
          resolve();
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          reject(
            new Error(
              `Project ${projectRef} did not become ready within ${timeoutMs}ms. You can manually configure it later.`,
            ),
          );
          return;
        }

        setTimeout(check, pollInterval);
      } catch (error) {
        if (Date.now() - startTime >= timeoutMs) {
          reject(
            new Error(
              `Project ${projectRef} did not become ready within ${timeoutMs}ms. You can manually configure it later.`,
            ),
          );
          return;
        }

        setTimeout(check, pollInterval);
      }
    };

    check();
  });
}

async function getProjectApiKeys(
  accessToken: string,
  projectRef: string,
): Promise<{ anonKey: string; serviceRoleKey: string }> {
  const data = (await apiRequest(
    accessToken,
    "GET",
    `/projects/${projectRef}/api-keys?reveal=true`,
  )) as Array<{ name: string; api_key: string }>;

  const anonKey =
    data.find(
      (k) => k.name === "anon" || k.name === "publishable",
    )?.api_key ?? "";
  const serviceRoleKey =
    data.find(
      (k) => k.name === "service_role" || k.name === "secret",
    )?.api_key ?? "";

  return { anonKey, serviceRoleKey };
}

async function getProjectCredentials(
  accessToken: string,
  projectRef: string,
  dbPassword: string,
): Promise<ProjectCredentials> {
  const { anonKey, serviceRoleKey } = await getProjectApiKeys(
    accessToken,
    projectRef,
  );

  const supabaseUrl = `https://${projectRef}.supabase.co`;
  const databaseUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

  return {
    projectRef,
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    databaseUrl,
  };
}

async function quickSetup(
  accessToken: string,
  options: CreateProjectOptions,
): Promise<QuickSetupResult> {
  logger.info("Starting quick setup for Supabase project...");

  const { ref: projectRef, name } = await createProject(accessToken, options);
  logger.info(`Project created: ${name} (${projectRef})`);

  logger.info("Waiting for project to become ready...");
  await waitForProjectReady(accessToken, projectRef);
  logger.info("Project is ready");

  const credentials = await getProjectCredentials(
    accessToken,
    projectRef,
    options.dbPassword,
  );
  logger.info("Project credentials retrieved");

  await appSettingsService.updateSetting("database_config", {
    url: credentials.supabaseUrl,
    anonKey: credentials.anonKey,
    serviceRoleKey: credentials.serviceRoleKey,
    databaseUrl: credentials.databaseUrl,
  });
  logger.info("Database config saved");

  reinitializeSupabaseClients({
    url: credentials.supabaseUrl,
    serviceKey: credentials.serviceRoleKey,
    anonKey: credentials.anonKey,
  });
  logger.info("Supabase clients reinitialized");

  process.env.DATABASE_URL = credentials.databaseUrl;
  migrationService.setDatabaseUrl(credentials.databaseUrl);
  logger.info("Migration service configured");

  const migrationResults = await migrationService.executeMigrations();
  logger.info(`Migrations executed: ${migrationResults.length}`);

  await migrationService.close();
  logger.info("Migration service pool closed");

  return {
    projectRef: credentials.projectRef,
    supabaseUrl: credentials.supabaseUrl,
    anonKey: credentials.anonKey,
    serviceRoleKey: credentials.serviceRoleKey,
    databaseUrl: credentials.databaseUrl,
    migrationResults,
  };
}

export const supabaseManagementApi = {
  listOrganizations,
  listRegions,
  createProject,
  waitForProjectReady,
  getProjectApiKeys,
  getProjectCredentials,
  quickSetup,
};

export type {
  Organization,
  Region,
  CreateProjectOptions,
  ProjectCredentials,
  QuickSetupResult,
};
