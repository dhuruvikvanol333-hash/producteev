import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { cacheAside, cacheSet, cacheDel, CacheKeys } from '../utils/cache';

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  mobileNo?: string | null;
  technology?: string | null;
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  mobileNo: true,
  technology: true,
  createdAt: true,
} as const;

export class UserService {
  static async getAll() {
    return prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { firstName: 'asc' },
    });
  }

  static async getById(id: string) {
    return cacheAside(
      CacheKeys.user(id),
      async () => {
        const user = await prisma.user.findUnique({
          where: { id },
          select: USER_SELECT,
        });
        if (!user) throw ApiError.notFound('User not found');
        return user;
      },
      600 // 10 minutes
    );
  }

  static async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    // Invalidate user cache after update
    await cacheDel(CacheKeys.user(id));
    // Re-populate cache with fresh data
    await cacheSet(CacheKeys.user(id), user, 600);

    return user;
  }

  static async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    // Invalidate cache
    await cacheDel(CacheKeys.user(id));
  }

  static async deleteAccount(id: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.badRequest('Password is incorrect');

    await prisma.user.delete({ where: { id } });

    // Invalidate all caches for this user
    await cacheDel(
      CacheKeys.user(id),
      CacheKeys.userNotifications(id),
      CacheKeys.dashboardStats(id)
    );
  }
}
