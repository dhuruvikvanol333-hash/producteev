import { Request, Response } from 'express';
import { TaskService } from '../services/task.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';

export class DashboardController {
  getStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();

    // 1. Resolve organization context
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.user.id }
    });
    if (!membership) throw ApiError.notFound('No active organization found');
    
    const orgId = membership.organizationId;
    const role = membership.role;
    const isOwner = role === 'OWNER';
    const isAdmin = role === 'ADMIN';

    // ── RBAC Logic ──

    // Folder Count Filter
    // OWNER sees all folders; ADMIN sees folders in assigned spaces
    const folderWhere: any = isOwner 
      ? { space: { organizationId: orgId } }
      : { space: { organizationId: orgId, members: { some: { userId: req.user.id } } } };

    // Task Count Filter
    // OWNER sees all assigned tasks; ADMIN sees assigned tasks in assigned spaces; MEMBER sees only their tasks
    let taskWhere: any = { project: { organizationId: orgId } };
    if (isOwner) {
      taskWhere.assignees = { some: {} }; // Count any task with an assignee
    } else if (isAdmin) {
      taskWhere.assignees = { some: {} };
      taskWhere.list = { space: { members: { some: { userId: req.user.id } } } };
    } else {
      // Regular Member sees ONLY their assigned tasks
      taskWhere.assignees = { some: { id: req.user.id } };
    }

    const [folderCount, assignedTaskCount, memberCount, recentTasks, members, unreadNotifCount] = await Promise.all([
      // Show Folders based on assignment
      prisma.folder.count({ where: folderWhere }),
      
      // Tasks Assigned: Filtered by assignment scope
      prisma.task.count({ where: taskWhere }),

      // Team Members: Filtered by org (Same for everyone)
      prisma.organizationMember.count({ where: { organizationId: orgId } }),

      // Feed
      TaskService.getAllTasks(req.user.id, role as any),

      // Recent Members (Avatars)
      prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Inbox Notification count
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
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
