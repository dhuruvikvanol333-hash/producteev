import { Request, Response } from 'express';
import { TaskService } from '../services/task.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';

export class DashboardController {
  getStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();

    // 1. Resolve organization context
    const { orgId: queryOrgId } = req.query;
    let orgId = queryOrgId as string;
    let role: any;

    if (orgId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: req.user.id } }
      });
      if (!membership) throw ApiError.notFound('Organization membership not found');
      role = membership.role;
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: req.user.id }
      });
      if (!membership) throw ApiError.notFound('No active organization found');
      orgId = membership.organizationId;
      role = membership.role;
    }

    const isOwner = role === 'OWNER';
    const isAdmin = role === 'ADMIN';

    // ── RBAC Logic ──

    // Folder Count Filter
    const folderWhere: any = isOwner 
      ? { space: { organizationId: orgId } }
      : { space: { organizationId: orgId, members: { some: { userId: req.user.id } } } };

    // Task Count Filter
    let taskWhere: any = { 
      OR: [
        { project: { organizationId: orgId } },
        { list: { space: { organizationId: orgId } } }
      ]
    };
    
    if (isOwner) {
      // Owners see all tasks in org
    } else if (isAdmin) {
      // Admins see all tasks in org for now (or scope by space if needed)
    } else {
      // Members only see their own assigned tasks
      taskWhere.assignees = { some: { id: req.user.id } };
    }

    const [folderCount, assignedTaskCount, memberCount, recentTasks, members, unreadNotifCount] = await Promise.all([
      prisma.folder.count({ where: folderWhere }),
      prisma.task.count({ where: taskWhere }),
      prisma.organizationMember.count({ where: { organizationId: orgId } }),

      // Feed - passing orgId to get scoped tasks
      TaskService.getAllTasks(req.user.id, role as any, orgId, 10),

      prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Inbox Notification count - scoped to org
      prisma.notification.count({
        where: {
          userId: req.user.id,
          isRead: false,
          organizationId: orgId || null,
        } as any,
      })
    ]);

    res.json({
      success: true,
      data: {
        projectCount: folderCount, // Folders Scoped
        taskCount: assignedTaskCount, // Tasks Scoped
        memberCount, // Global Org Count
        unreadNotifCount, // Inbox Feed Count
        recentTasks: recentTasks.slice(0, 5),
        members: members.map(m => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          avatarUrl: m.user.avatarUrl
        }))
      },
    });
  });
}
