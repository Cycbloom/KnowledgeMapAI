import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { supabaseManagementApi } from "../../services/supabase/managementApi";
import { logger } from "../../utils/logger";
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

router.get(
  "/organizations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const accessToken = req.query.accessToken as string;

      if (!accessToken) {
        throw new AppError("accessToken is required", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const organizations = await supabaseManagementApi.listOrganizations(accessToken);
      res.json({ organizations });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized")) {
        throw new AppError("Personal Access Token is invalid or expired", 401, ErrorCodes.AUTH_UNAUTHORIZED);
      }

      logger.error("Failed to list organizations:", error);
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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
        throw new AppError("accessToken is required", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const regions = await supabaseManagementApi.listRegions(accessToken);
      res.json({ regions });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized")) {
        throw new AppError("Personal Access Token is invalid or expired", 401, ErrorCodes.AUTH_UNAUTHORIZED);
      }

      logger.error("Failed to list regions:", error);
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/create-project",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { accessToken, organizationSlug, projectName, dbPassword, region } = req.body as {
      accessToken?: string;
      organizationSlug?: string;
      projectName?: string;
      dbPassword?: string;
      region?: string;
    };

    if (!accessToken || !organizationSlug || !projectName || !dbPassword || !region) {
      throw new AppError(
        "Missing required fields: accessToken, organizationSlug, projectName, dbPassword, region",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
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
      throw new AppError("Project creation timed out", 408, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const credentials = await supabaseManagementApi.getProjectCredentials(
      accessToken,
      project.ref,
      dbPassword,
    );

    res.json(credentials);
  }),
);

router.post(
  "/quick-setup",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { accessToken, organizationSlug, projectName, dbPassword, region } = req.body as {
      accessToken?: string;
      organizationSlug?: string;
      projectName?: string;
      dbPassword?: string;
      region?: string;
    };

    if (!accessToken || !organizationSlug || !projectName || !dbPassword || !region) {
      throw new AppError(
        "Missing required fields: accessToken, organizationSlug, projectName, dbPassword, region",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const result = await supabaseManagementApi.quickSetup(accessToken, {
      organizationSlug,
      projectName,
      dbPassword,
      region,
    });

    res.json(result);
  }),
);

export default router;
