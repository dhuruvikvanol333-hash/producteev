import { prisma } from '../config/database';

export class SearchService {
  static async search(userId: string, query: string) {
    const q = query.trim();
    if (!q) return this.getRecent(userId);

    const [tasks, projects, organizations] = await Promise.all([
      prisma.task.findMany({
        where: {
          title: { contains: q, mode: 'insensitive' },
          project: {
            organization: {
              members: { some: { userId } },
            },
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.project.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          organization: {
            members: { some: { userId } },
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          description: true,
          updatedAt: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.organization.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          members: { some: { userId } },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return { tasks, projects, organizations };
  }

  static async getRecent(userId: string) {
    const [tasks, projects, organizations] = await Promise.all([
      prisma.task.findMany({
        where: {
          project: {
            organization: {
              members: { some: { userId } },
            },
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.project.findMany({
        where: {
          organization: {
            members: { some: { userId } },
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          description: true,
          updatedAt: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      }),
      prisma.organization.findMany({
        where: {
          members: { some: { userId } },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    return { tasks, projects, organizations };
  }
}
