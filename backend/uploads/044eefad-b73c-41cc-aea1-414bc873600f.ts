export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'LIMITED_MEMBER' | 'GUEST';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
}

export interface List {
  id: string;
  name: string;
  color?: string;
  position: number;
  spaceId: string;
  folderId?: string | null;
  _count?: {
    tasks: number;
  };
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  position: number;
  spaceId: string;
  lists: List[];
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  organizationId: string;
  folders: Folder[];
  lists: List[]; // standalone lists
  _count?: {
    projects: number;
    folders: number;
    lists: number;
  };
}
