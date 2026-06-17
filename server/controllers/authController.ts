import type { Request, Response } from "express";
import { successResponse, errorResponse } from "../response";
import {
  loginUser,
  logoutUser,
  logoutAllDevices,
  requestPasswordReset,
  resetPasswordWithToken,
  changePassword,
  getCurrentUser,
} from "../services/authService";
import { getClientIp, getUserAgent } from "../helpers/requestMeta";
import { AppError } from "../middleware/errors";

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password, rememberMe } = req.body ?? {};
      const result = await loginUser({
        email,
        password,
        rememberMe: !!rememberMe,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      return successResponse(res, result, "Login successful");
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(res, err.message, err.status, err.errors);
      }
      return errorResponse(res, (err as Error).message, 500);
    }
  },

  async me(req: Request, res: Response) {
    try {
      const sessionId = (req as any).sessionId as string;
      const user = await getCurrentUser(sessionId);
      if (!user) return errorResponse(res, "User not found", 404);
      return successResponse(res, user);
    } catch (err) {
      return errorResponse(res, (err as Error).message, 500);
    }
  },

  async logout(req: Request, res: Response) {
    const sessionId = (req as any).sessionId as string;
    await logoutUser(sessionId);
    return successResponse(res, null, "Logged out successfully");
  },

  async logoutAll(req: Request, res: Response) {
    const user = (req as any).user;
    await logoutAllDevices(user.staffId);
    return successResponse(res, null, "Logged out from all devices");
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body ?? {};
    const result = await requestPasswordReset(email);
    return successResponse(res, result, result.message);
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body ?? {};
      if (!token || !password) return errorResponse(res, "Token and password required", 400);
      await resetPasswordWithToken(token, password);
      return successResponse(res, null, "Password reset successful");
    } catch (err) {
      if (err instanceof AppError) return errorResponse(res, err.message, err.status, err.errors);
      return errorResponse(res, (err as Error).message, 400);
    }
  },

  async changePassword(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body ?? {};
      await changePassword(user.staffId, currentPassword, newPassword);
      return successResponse(res, null, "Password updated");
    } catch (err) {
      if (err instanceof AppError) return errorResponse(res, err.message, err.status, err.errors);
      return errorResponse(res, (err as Error).message, 400);
    }
  },
};
