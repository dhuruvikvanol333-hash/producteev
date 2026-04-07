import { prisma } from '../config/database';
import { getIO } from '../socket/index';
import { OrgRole } from '@prisma/client';

export class NotificationService {
  static async create(userId: string, title: string, message: string, link?: string) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        link,
      },
    });

    // Send real-time notification
    try {
      getIO().to(`user:${userId}`).emit('notification:new', notification);
    } catch (e) {
      console.warn('Socket not initialized, skipping realtime notification');
    }

    return notification;
  }

  /**
   * Notifies organization owners, admins, and task assignees about a task activity.
   */
  static async notifyTaskActivity(taskId: string, actorId: string, title: string, message: string) {
    try {
      // 1. Get task details to find Organization and Assignees
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignees: { select: { id: true } },
          project: { select: { organizationId: true } },
          list: {
            select: {
              space: { select: { organizationId: true } }
            }
          }
        }
      });

      if (!task) return [];

      const orgId = task.project?.organizationId || task.list?.space?.organizationId;
      if (!orgId) return [];

      // 2. Collect all unique recipient IDs
      const recipientIds = new Set<string>();

      // Rule: Owners and Admins always get notified
      const orgRoleBearers = await prisma.organizationMember.findMany({
        where: {
          organizationId: orgId,
          role: { in: [OrgRole.OWNER, OrgRole.ADMIN] }
        },
        select: { userId: true }
      });
      orgRoleBearers.forEach(m => recipientIds.add(m.userId));

      // Rule: Assignees get notified for their specific tasks
      task.assignees.forEach(a => recipientIds.add(a.id));

      // Filter: Don't notify the person who triggered the action
      recipientIds.delete(actorId);

      // 3. Dispatch notifications
      const link = `/tasks/${taskId}`;
      const results = await Promise.all(
        Array.from(recipientIds).map(userId => 
          this.create(userId, title, message, link)
        )
      );

      return results;
    } catch (error) {
      console.error('Failed to send task activity notifications:', error);
      return [];
    }
  }
}
