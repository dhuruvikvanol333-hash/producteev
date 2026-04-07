import { prisma } from '../config/database';
import { getIO } from '../socket/index';
import { OrgRole } from '@prisma/client';

export class NotificationService {
  static async create(userId: string, title: string, message: string, link?: string, organizationId?: string, senderAvatarUrl?: string) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        organizationId,
        title,
        message,
        link,
        senderAvatarUrl,
      } as any,
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
  /**
   * Notifies organization owners, admins, and task assignees about a task activity.
   */
  static async notifyTaskActivity(taskId: string, actorId: string, actorRole: OrgRole, title: string, message: string) {
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

      // Look up actor's avatar
      let actorAvatarUrl: string | undefined;
      if (actorId) {
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { avatarUrl: true } });
        actorAvatarUrl = actor?.avatarUrl ?? undefined;
      }

      // 2. Collect all unique recipient IDs
      const recipientIds = new Set<string>();

      // Rule: Owners and Admins always get notified
      const orgRoleBearers = await prisma.organizationMember.findMany({
        where: {
          organizationId: orgId,
          role: { in: [OrgRole.ADMIN] }
        },
        select: { userId: true }
      });
      orgRoleBearers.forEach(m => recipientIds.add(m.userId));

      // Rule: If actor is LIMITED_MEMBER, notify all standard Members too
      if (actorRole === OrgRole.LIMITED_MEMBER) {
        const orgMembers = await prisma.organizationMember.findMany({
          where: { organizationId: orgId, role: OrgRole.MEMBER },
          select: { userId: true }
        });
        orgMembers.forEach(m => recipientIds.add(m.userId));
      }

      // Rule: Assignees get notified for their specific tasks
      task.assignees.forEach(a => recipientIds.add(a.id));

      // Rule: Task Creator getting notified? Usually yes for visibility
      if (task.createdById) {
        recipientIds.add(task.createdById);
      }

      // Rule: Any explicitly assigned Leaders/Members of the task's List get notified
      if (task.listId) {
        const listMembers = await prisma.listMember.findMany({
          where: { listId: task.listId },
          select: { userId: true }
        });
        listMembers.forEach(m => recipientIds.add(m.userId));
      }

      // Important: Never notify the actor themself to avoid double-counting in their own view
      recipientIds.delete(actorId);

      // 3. Dispatch notifications
      const link = `/tasks/${taskId}`;
      const results = await Promise.all(
        Array.from(recipientIds).map(userId => 
          this.create(userId, title, message, link, orgId, actorAvatarUrl)
        )
      );

      return results;
    } catch (error) {
      console.error('Failed to send task activity notifications:', error);
      return [];
    }
  }
  /**
   * Notifies all admins of an organization.
   */
  static async notifyAdmins(orgId: string, actorId: string, title: string, message: string, link?: string) {
    try {
      const admins = await prisma.organizationMember.findMany({
        where: { organizationId: orgId, role: OrgRole.ADMIN },
        select: { userId: true }
      });

      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { avatarUrl: true } });
      const actorAvatarUrl = actor?.avatarUrl ?? undefined;

      return Promise.all(
        admins.filter(a => a.userId !== actorId).map(admin => 
          this.create(admin.userId, title, message, link, orgId, actorAvatarUrl)
        )
      );
    } catch (error) {
      console.error('Failed to notify admins:', error);
      return [];
    }
  }

  /**
   * Notifies all members (and admins) of an organization, excluding Limited Members.
   */
  static async notifyMembers(orgId: string, actorId: string, title: string, message: string, link?: string) {
    try {
      const members = await prisma.organizationMember.findMany({
        where: { 
          organizationId: orgId, 
          role: { in: [OrgRole.ADMIN, OrgRole.MEMBER] } 
        },
        select: { userId: true }
      });

      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { avatarUrl: true } });
      const actorAvatarUrl = actor?.avatarUrl ?? undefined;

      return Promise.all(
        members.filter(m => m.userId !== actorId).map(member => 
          this.create(member.userId, title, message, link, orgId, actorAvatarUrl)
        )
      );
    } catch (error) {
      console.error('Failed to notify members:', error);
      return [];
    }
  }

  /**
   * Notifies a specific user.
   */
  static async notifyUser(targetUserId: string, actorId: string, title: string, message: string, link?: string, orgId?: string) {
    try {
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { avatarUrl: true } });
      const actorAvatarUrl = actor?.avatarUrl ?? undefined;

      return this.create(targetUserId, title, message, link, orgId, actorAvatarUrl);
    } catch (error) {
      console.error('Failed to notify specific user:', error);
      return null;
    }
  }
}
