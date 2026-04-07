import { useAppSelector } from '../store';

export function useOrgRole() {
  const { orgRole } = useAppSelector((state) => state.organization);

  return {
    orgRole,
    isOwner: orgRole === 'OWNER',
    isAdmin: orgRole === 'ADMIN' || orgRole === 'OWNER',
    isMember: orgRole === 'MEMBER',
    isLimitedMember: orgRole === 'LIMITED_MEMBER',
    isGuest: orgRole === 'GUEST',
    // Helpers
    canManageOrg: orgRole === 'ADMIN' || orgRole === 'OWNER',
    canSeeFullSidebar: orgRole === 'ADMIN' || orgRole === 'OWNER' || orgRole === 'MEMBER' || orgRole === 'LIMITED_MEMBER' || orgRole === 'GUEST', // Allow all valid roles
    canCreateProject: orgRole === 'ADMIN' || orgRole === 'OWNER',
    canDeleteProject: orgRole === 'ADMIN' || orgRole === 'OWNER',
    canEditProjectDescription: orgRole === 'ADMIN' || orgRole === 'OWNER',
    canCreateTask: orgRole === 'ADMIN' || orgRole === 'OWNER' || orgRole === 'MEMBER',
    canDeleteTask: orgRole === 'ADMIN' || orgRole === 'OWNER' || orgRole === 'MEMBER',
    canUpdateTaskStatus: orgRole !== 'GUEST',
    canUpdateTaskDetails: orgRole === 'ADMIN' || orgRole === 'OWNER' || orgRole === 'MEMBER',
    canAddComments: orgRole !== 'GUEST',
    isReadOnly: orgRole === 'GUEST',
  };
}
