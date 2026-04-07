import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { JwtPayload } from '../types/common';
import { InvitationService } from './invitation.service';
import { OrganizationService } from './organization.service';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteToken?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }


    let invitationDetails = null;

    // Check if this is the very first user in the system
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      if (!input.inviteToken) {
        throw ApiError.forbidden('Registration is currently by invitation only.');
      }
      
      // Validate invite token and ensure it matches the email
      invitationDetails = await InvitationService.validateInvite(input.inviteToken);
      if (invitationDetails.email.toLowerCase() !== input.email.toLowerCase()) {
         throw ApiError.forbidden('This invite token is for a different email address.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    // If this is the first user, create a default organization for them
    if (userCount === 0) {
      await OrganizationService.create({
        name: 'My Workspace',
        slug: 'my-workspace',
        ownerId: user.id
      });
    }

    // If there is an invitation to accept, automatically accept it
    if (invitationDetails && input.inviteToken) {
        await InvitationService.acceptInvite(input.inviteToken, user.id);
    }

    const tokens = AuthService.generateTokens({ userId: user.id, email: user.email });
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  static async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = AuthService.generateTokens({ userId: user.id, email: user.email });
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  static async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
    
    let stored: string | null = null;
    try {
      stored = await redis.get(`refresh:${payload.userId}`);
    } catch (err) {
      console.warn('Redis unavailable during refresh, trusting JWT signature only');
      stored = refreshToken; // Trust token if Redis is down
    }

    if (stored !== refreshToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const tokens = AuthService.generateTokens({ userId: payload.userId, email: payload.email });
    await AuthService.storeRefreshToken(payload.userId, tokens.refreshToken);

    return tokens;
  }

  static async logout(userId: string): Promise<void> {
    try {
      await redis.del(`refresh:${userId}`);
    } catch {
      // ignore Redis error
    }
  }

  static async checkEmail(email: string): Promise<{ exists: boolean }> {
    const user = await prisma.user.findUnique({ where: { email } });
    return { exists: !!user };
  }

  static async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token in Redis with 1 hour expiry
    try {
      await redis.set(`reset:${hashedToken}`, user.id, 'EX', 3600);
    } catch {
      // If Redis is not available, store token anyway
    }

    // Return the token directly so the frontend can use it for password reset
    return { message: 'Password reset token generated.', resetToken };
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    let userId: string | null = null;
    try {
      userId = await redis.get(`reset:${hashedToken}`);
    } catch {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    if (!userId) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete the used token
    try {
      await redis.del(`reset:${hashedToken}`);
    } catch {
      // ignore
    }

    return { message: 'Password has been reset successfully' };
  }

  private static generateTokens(payload: JwtPayload): AuthTokens {
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }

  private static async storeRefreshToken(userId: string, token: string): Promise<void> {
    try {
      await redis.set(`refresh:${userId}`, token, 'EX', 7 * 24 * 60 * 60); // 7 days
    } catch (err) {
      console.error('Failed to store refresh token in Redis:', err);
    }
  }
}
