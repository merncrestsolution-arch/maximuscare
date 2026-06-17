import type { Express } from "express";
import { requireAuth } from "../auth";
import { authController } from "../controllers/authController";
import { asyncHandler } from "../middleware/errorHandler";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", asyncHandler(authController.login));
  app.get("/api/auth/me", requireAuth, asyncHandler(authController.me));
  app.post("/api/auth/logout", requireAuth, asyncHandler(authController.logout));
  app.post("/api/auth/logout-all", requireAuth, asyncHandler(authController.logoutAll));
  app.post("/api/auth/forgot-password", asyncHandler(authController.forgotPassword));
  app.post("/api/auth/reset-password", asyncHandler(authController.resetPassword));
  app.post("/api/auth/change-password", requireAuth, asyncHandler(authController.changePassword));
}
