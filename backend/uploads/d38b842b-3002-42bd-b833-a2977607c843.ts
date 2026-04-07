import { useAppSelector } from '../store';

export function useOrgRole() {
  const { orgRole } = useAppSelector((state) => state.organization);

  return {
    orgRole,
    isOwner: orgRole === 'OWNER',
    isAdmin: orgRole === 'ADMIN',
    isMember: orgRole === 'MEMBER',
    isLimitedMember: orgRole === 'LIMITED_MEMBER',
    isGuest: orgRole === 'GUEST',
    // Helpers
    canManageOrg: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canSeeFullSidebar: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canCreateProject: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canDeleteProject: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canEditProjectDescription: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canCreateTask: orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MEMBER',
    canDeleteTask: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canUpdateTaskStatus: orgRole !== 'GUEST',
    canUpdateTaskDetails: orgRole === 'OWNER' || orgRole === 'ADMIN',
    canAddComments: orgRole !== 'GUEST',
    isReadOnly: orgRole === 'GUEST',
  };
}
