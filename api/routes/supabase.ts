import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { supabaseManagementApi } from "../services/supabase/managementApi";
import { logger } from "../utils/logger";

const router = Router();

router.get(
  "/organizations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const accessToken = req.query.accessToken as string;

      if (!accessToken) {
        res.status(400).json({ error: "accessToken is required" });
        return;
      }

      const organizations = await supabaseManagementApi.listOrganizations(accessToken);
      res.json({ organizations });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized")) {
        res.status(401).json({ error: "Personal Access Token is invalid or expired" });
        return;
      }

      logger.error("Failed to list organizations:", error);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/regions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const accessToken = req.query.accessToken as string;

      if (!accessToken) {
        res.status(400).json({ error: "accessToken is required" });
        return;
      }

      const regions = await supabaseManagementApi.listRegions(accessToken);
      res.json({ regions });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized")) {
        res.status(401).json({ error: "Personal Access Token is invalid or expired" });
        return;
      }

      logger.error("Failed to list regions:", error);
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/create-project",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken, organizationSlug, projectName, dbPassword, region } = req.body as {
        accessToken?: string;
        organizationSlug?: string;
        projectName?: string;
        dbPassword?: string;
        region?: string;
      };

      if (!accessToken || !organizationSlug || !projectName || !dbPassword || !region) {
        res.status(400).json({
          error: "Missing required fields: accessToken, organizationSlug, projectName, dbPassword, region",
        });
        return;
      }

      const project = await supabaseManagementApi.createProject(accessToken, {
        organizationSlug,
        projectName,
        dbPassword,
        region,
      });

      try {
        await supabaseManagementApi.waitForProjectReady(accessToken, project.ref);
      } catch {
        res.status(408).json({ error: "Project creation timed out", projectRef: project.ref });
        return;
      }

      const credentials = await supabaseManagementApi.getProjectCredentials(
        accessToken,
        project.ref,
        dbPassword,
      );

      res.json(credentials);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to create project:", error);
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/quick-setup",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken, organizationSlug, projectName, dbPassword, region } = req.body as {
        accessToken?: string;
        organizationSlug?: string;
        projectName?: string;
        dbPassword?: string;
        region?: string;
      };

      if (!accessToken || !organizationSlug || !projectName || !dbPassword || !region) {
        res.status(400).json({
          error: "Missing required fields: accessToken, organizationSlug, projectName, dbPassword, region",
        });
        return;
      }

      const result = await supabaseManagementApi.quickSetup(accessToken, {
        organizationSlug,
        projectName,
        dbPassword,
        region,
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to quick setup:", error);

      const errorResponse: { error: string; projectRef?: string } = { error: message };

      if (error instanceof Error && "projectRef" in error) {
        errorResponse.projectRef = (error as Error & { projectRef: string }).projectRef;
      }

      res.status(500).json(errorResponse);
    }
  },
);

export default router;
