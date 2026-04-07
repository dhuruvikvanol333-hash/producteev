import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  inviteToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const checkEmailSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const result = await AuthService.register(data);
    res.status(201).json({ success: true, data: result });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data.email, data.password);
    res.json({ success: true, data: result });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const tokens = await AuthService.refresh(refreshToken);
    res.json({ success: true, data: tokens });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await AuthService.logout(req.user.id);
    }
    res.json({ success: true, message: 'Logged out' });
  });

  checkEmail = asyncHandler(async (req: Request, res: Response) => {
    const { email } = checkEmailSchema.parse(req.body);
    const result = await AuthService.checkEmail(email);
    res.json({ success: true, data: result });
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await AuthService.forgotPassword(email);
    res.json({ success: true, data: result });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const data = resetPasswordSchema.parse(req.body);
    const result = await AuthService.resetPassword(data.token, data.password);
    res.json({ success: true, data: result });
  });
}
