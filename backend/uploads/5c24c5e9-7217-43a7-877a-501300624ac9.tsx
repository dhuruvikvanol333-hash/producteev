import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { useOrgRole } from '../../hooks/useOrgRole';
import { TimeTracker } from '../../components/time-tracking/TimeTracker';
import { TimeEntryList } from '../../components/time-tracking/TimeEntryList';
import { ActivityTimeline } from '../../components/activity/ActivityTimeline';
import { AttachmentSection } from '../../components/attachments/AttachmentSection';
import { TagPicker } from '../../components/tasks/TagPicker';
import type { Task, TaskStatus, TaskPriority, Tag } from '../../types';

import { AvatarStack } from '../../components/ui/AvatarStack';

/* ── Configs ── */
// 8 display statuses shown in UI
const DISPLAY_STATUSES = [
    { key: 'OPEN', label: 'OPEN', color: '#9ca3af', dotStyle: 'border-2 border-dashed', bg: '#f3f4f6', textColor: '#6b7280', backendStatus: 'OPEN' as TaskStatus, section: 'open' },
    { key: 'PENDING', label: 'PENDING', color: '#f59e0b', dotStyle: 'border-2', bg: '#fffbeb', textColor: '#d97706', backendStatus: 'PENDING' as TaskStatus, section: 'open' },
    { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: '#ef4444', dotStyle: 'solid', bg: '#fef2f2', textColor: '#dc2626', backendStatus: 'IN_PROGRESS' as TaskStatus, section: 'open' },
    { key: 'COMPLETED', label: 'COMPLETED', color: '#1d1d1d', dotStyle: 'solid', bg: '#f9fafb', textColor: '#111827', backendStatus: 'COMPLETED' as TaskStatus, section: 'open' },
    { key: 'IN_REVIEW', label: 'IN REVIEW', color: '#f97316', dotStyle: 'solid', bg: '#fff7ed', textColor: '#ea580c', backendStatus: 'IN_REVIEW' as TaskStatus, section: 'open' },
    { key: 'ACCEPTED', label: 'ACCEPTED', color: '#ef4444', dotStyle: 'solid', bg: '#fef2f2', textColor: '#dc2626', backendStatus: 'ACCEPTED' as TaskStatus, section: 'open' },
    { key: 'REJECTED', label: 'REJECTED', color: '#8b5cf6', dotStyle: 'solid', bg: '#f5f3ff', textColor: '#7c3aed', backendStatus: 'REJECTED' as TaskStatus, section: 'open' },
    { key: 'CLOSED', label: 'CLOSED', color: '#22c55e', dotStyle: 'solid', bg: '#f0fdf4', textColor: '#16a34a', backendStatus: 'CLOSED' as TaskStatus, section: 'closed' },
];

// Map backend TaskStatus -> default display status key
function backendToDisplay(s: TaskStatus): string {
    return s;
}

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
    URGENT: { label: 'Urgent', color: '#ef4444' },
    HIGH: { label: 'High', color: '#f97316' },
    MEDIUM: { label: 'Medium', color: '#eab308' },
    LOW: { label: 'Low', color: '#6b7280' },
};

/* ── Helpers ── */
function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function relativeDueDate(dateStr: string | null): { text: string; overdue: boolean } {
    if (!dateStr) return { text: 'No date', overdue: false };
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
    const diff = Math.round((now.getTime() - due.getTime()) / 86400000);
    if (diff < 0) return { text: formatDate(dateStr), overdue: false };
    if (diff === 0) return { text: 'Today', overdue: false };
    if (diff === 1) return { text: 'Yesterday', overdue: true };
    return { text: `${diff} days ago`, overdue: true };
}



/* ── Inline SVG icons ── */
function IconStatus() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
    );
}
function IconCalendar() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    );
}
function IconFlag({ color }: { color: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill={color}>
            <path d="M4 3a1 1 0 00-1 1v13a1 1 0 102 0v-5h4.586l.707.707A1 1 0 0011 13h5a1 1 0 001-1V5a1 1 0 00-1-1h-4.586l-.707-.707A1 1 0 0010 3H4z" />
        </svg>
    );
}
function IconTag() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1" />
        </svg>
    );
}
function IconUsers() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}
function IconLink() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
    );
}
function IconHourglass() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 017 17.828V22M17 2v4.172a2 2 0 01-.586 1.414L12 12l-4.414-4.414A2 2 0 017 6.172V2" />
        </svg>
    );
}
function AvatarPill({ firstName, lastName, avatarUrl }: { firstName: string; lastName: string; avatarUrl?: string | null }) {
    const letters = `${firstName ? firstName.charAt(0) : '?'}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[(firstName ? firstName.charCodeAt(0) : 0 + (lastName ? lastName.charCodeAt(0) : 0)) % colors.length];

    if (avatarUrl) return (
        <img
            src={avatarUrl}
            alt=""
            className="w-5 h-5 rounded-full object-cover shrink-0"
            onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const parent = img.parentElement;
                if (parent && !parent.querySelector('.avatar-placeholder')) {
                    const div = document.createElement('div');
                    div.className = 'avatar-placeholder w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0';
                    div.style.backgroundColor = color;
                    div.innerText = letters;
                    parent.appendChild(div);
                }
            }}
        />
    );
    const placeholderStyle = { backgroundColor: color };
    return (
        <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0" {...{ style: placeholderStyle }}>
            {letters}
        </div>
    );
}

function IconTrackTime() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6" /><path d="M16.24 16.24l-4.24-4.24" />
        </svg>
    );
}

/* ── Comment toolbar icons ── */
function IconPlus() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>;
}
function IconSend() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>;
}

/* ── Checklist item type ── */
interface ChecklistItem {
    id: string;
    text: string;
    checked: boolean;
}
interface Checklist {
    id: string;
    name: string;
    items: ChecklistItem[];
}

/* ── Subtask type (local) ── */
interface Subtask {
    id: string;
    title: string;
    status: TaskStatus;
}

/* ── Comment type (from backend) ── */
interface Comment {
    id: string;
    text: string;
    taskId: string;
    userId: string;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    };
}

export function TaskDetailPage({ isModal = false }: { isModal?: boolean }) {

    const { id } = useParams();
    const navigate = useNavigate();
    const { 
        canUpdateTaskStatus, 
        canAddComments, 
        canDeleteTask, 
        canUpdateTaskDetails,
    } = useOrgRole();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [statusDropdown, setStatusDropdown] = useState(false);
    const [priorityDropdown, setPriorityDropdown] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editingDesc, setEditingDesc] = useState(false);
    const [editDesc, setEditDesc] = useState('');
    const [showMore, setShowMore] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);
    const priorityRef = useRef<HTMLDivElement>(null);

    /* ── Date editing ── */
    const [editingDueDate, setEditingDueDate] = useState(false);
    const [editingStartDate, setEditingStartDate] = useState(false);
    const [startDate, setStartDate] = useState<string>('');

    /* ── Time estimate ── */
    const [editingTimeEstimate, setEditingTimeEstimate] = useState(false);
    const [timeEstimate, setTimeEstimate] = useState('');

    /* ── Time tracking ── */
    const [timeRefreshKey, setTimeRefreshKey] = useState(0);

    /* ── Activity timeline ── */
    const [activityRefreshKey, setActivityRefreshKey] = useState(0);
    const [activityTab, setActivityTab] = useState<'activity' | 'comments'>('activity');

    /* ── Tags ── */
    const [tags, setTags] = useState<Tag[]>([]);
    const [editingTags, setEditingTags] = useState(false);
    const tagRef = useRef<HTMLDivElement>(null);

    /* ── Assignee dropdown (multi) ── */
    const [assigneeDropdown, setAssigneeDropdown] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [assignees, setAssignees] = useState<{ id: string; email: string; firstName: string; lastName: string; avatarUrl: string | null }[]>([]);
    const [teamUsers, setTeamUsers] = useState<{ id: string; email: string; firstName: string; lastName: string; avatarUrl: string | null }[]>([]);
    const assigneeRef = useRef<HTMLDivElement>(null);

    /* ── Display status (8-item) ── */
    const [displayStatusKey, setDisplayStatusKey] = useState<string>('OPEN');
    const [statusSearch, setStatusSearch] = useState('');

    /* ── Relationships ── */
    const [relationships, setRelationships] = useState<string[]>([]);
    const [editingRelationships, setEditingRelationships] = useState(false);
    const [newRelationship, setNewRelationship] = useState('');

    /* ── Subtasks ── */
    const [subtasks, setSubtasks] = useState<Subtask[]>([]);
    const [addingSubtask, setAddingSubtask] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const subtaskInputRef = useRef<HTMLInputElement>(null);

    /* ── Checklists ── */
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');
    const [addingChecklistItem, setAddingChecklistItem] = useState<string | null>(null);
    const [newChecklistItemText, setNewChecklistItemText] = useState('');

    /* ── Comments (from backend) ── */
    const [comments, setComments] = useState<Comment[]>([]);

    useEffect(() => {
        loadTask();
        loadComments();
    }, [id]);

    const loadComments = async () => {
        if (!id) return;
        try {
            const res = await api.get<{ success: boolean; data: Comment[] }>(`/tasks/${id}/comments`);
            setComments(res.data.data);
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusDropdown(false);
            if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityDropdown(false);
            if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeDropdown(false);
            if (tagRef.current && !tagRef.current.contains(e.target as Node)) setEditingTags(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (addingSubtask && subtaskInputRef.current) subtaskInputRef.current.focus();
    }, [addingSubtask]);

    /* ── Time tracking refresh handler ── */
    const handleTimeEntryChange = useCallback(() => {
        setTimeRefreshKey((k) => k + 1);
        setActivityRefreshKey((k) => k + 1);
        window.dispatchEvent(new Event('timer-update'));
    }, []);

    const loadTask = async () => {
        try {
            const res = await api.get<{ success: boolean; data: Task }>(`/tasks/${id}`);
            setTask(res.data.data);
            // Init display status from backend status
            setDisplayStatusKey(backendToDisplay(res.data.data.status));
            // Init assignees from plural assignees
            setAssignees(res.data.data.assignees || []);
            // Init tags
            setTags(res.data.data.tags || []);

            // Load team users for this task's organization
            const orgId = res.data.data.project?.organizationId || res.data.data.list?.space?.organizationId;
            if (orgId) {
                loadTeamUsers(orgId);
            } else {
                loadTeamUsers(); // fallback
            }
        } catch (err) {
            console.error('Failed to load task:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadTeamUsers = async (orgId?: string) => {
        try {
            const [membersRes, allUsersRes] = await Promise.all([
                orgId ? api.get<{ success: boolean; data: { user: any }[] }>(`/organizations/${orgId}/members`).catch(() => null) : Promise.resolve(null),
                api.get<{ success: boolean; data: any[] }>('/users/all').catch(() => null)
            ]);

            const userMap = new Map<string, any>();

            if (membersRes && membersRes.data.success) {
                membersRes.data.data.forEach(m => { if (m.user) userMap.set(m.user.id, m.user); });
            }
            if (allUsersRes && allUsersRes.data.success) {
                allUsersRes.data.data.forEach(u => { if (u) userMap.set(u.id, u); });
            }

            setTeamUsers(Array.from(userMap.values()));
        } catch (err) {
            console.error('Failed to load team users:', err);
        }
    };


    const updateTask = async (updates: Record<string, unknown>) => {
        try {
            const res = await api.patch<{ success: boolean; data: Task }>(`/tasks/${id}`, updates);
            setTask(res.data.data);
            setActivityRefreshKey((k) => k + 1);
        } catch (err) {
            console.error('Failed to update task:', err);
        }
    };

    const deleteTask = async () => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await api.delete(`/tasks/${id}`);
            navigate(`/projects/${task?.projectId}`);
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    };

    const saveTitleEdit = () => {
        if (editTitle.trim() && editTitle !== task?.title) {
            updateTask({ title: editTitle.trim() });
        }
        setEditingTitle(false);
    };

    const saveDescEdit = () => {
        if (editDesc !== (task?.description || '')) {
            updateTask({ description: editDesc });
        }
        setEditingDesc(false);
    };

    /* (formatTrackedTime removed — handled by TimeTracker component) */

    /* ── Subtask handlers ── */
    const handleAddSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const newSub: Subtask = {
            id: crypto.randomUUID(),
            title: newSubtaskTitle.trim(),
            status: 'OPEN',
        };
        setSubtasks((prev) => [...prev, newSub]);
        setNewSubtaskTitle('');
        setAddingSubtask(false);
    };

    const toggleSubtaskStatus = (subId: string) => {
        setSubtasks((prev) =>
            prev.map((s) =>
                s.id === subId ? { ...s, status: s.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED' } : s
            )
        );
    };

    const deleteSubtask = (subId: string) => {
        setSubtasks((prev) => prev.filter((s) => s.id !== subId));
    };

    /* ── Checklist handlers ── */
    const handleCreateChecklist = () => {
        if (!newChecklistName.trim()) return;
        const cl: Checklist = {
            id: crypto.randomUUID(),
            name: newChecklistName.trim(),
            items: [],
        };
        setChecklists((prev) => [...prev, cl]);
        setNewChecklistName('');
        setAddingChecklist(false);
    };

    const handleAddChecklistItem = (checklistId: string) => {
        if (!newChecklistItemText.trim()) return;
        const item: ChecklistItem = {
            id: crypto.randomUUID(),
            text: newChecklistItemText.trim(),
            checked: false,
        };
        setChecklists((prev) =>
            prev.map((cl) =>
                cl.id === checklistId ? { ...cl, items: [...cl.items, item] } : cl
            )
        );
        setNewChecklistItemText('');
        setAddingChecklistItem(null);
    };

    const toggleChecklistItem = (checklistId: string, itemId: string) => {
        setChecklists((prev) =>
            prev.map((cl) =>
                cl.id === checklistId
                    ? {
                        ...cl,
                        items: cl.items.map((it) =>
                            it.id === itemId ? { ...it, checked: !it.checked } : it
                        ),
                    }
                    : cl
            )
        );
    };

    const deleteChecklistItem = (checklistId: string, itemId: string) => {
        setChecklists((prev) =>
            prev.map((cl) =>
                cl.id === checklistId
                    ? { ...cl, items: cl.items.filter((it) => it.id !== itemId) }
                    : cl
            )
        );
    };

    const deleteChecklist = (checklistId: string) => {
        setChecklists((prev) => prev.filter((cl) => cl.id !== checklistId));
    };

    /* ── Comment handler ── */
    const handlePostComment = async () => {
        if (!comment.trim() || !id) return;
        try {
            const res = await api.post<{ success: boolean; data: Comment }>(`/tasks/${id}/comments`, {
                text: comment.trim(),
            });
            setComments((prev) => [...prev, res.data.data]);
            setComment('');
            setActivityRefreshKey((k) => k + 1);
        } catch {
            alert('Failed to post comment');
        }
    };

    /* ── Tag handlers ── */
    const handleToggleTag = async (tagId: string) => {
        if (!task) return;
        const isSelected = tags.some(t => t.id === tagId);
        let newTagIds: string[];

        if (isSelected) {
            newTagIds = tags.filter(t => t.id !== tagId).map(t => t.id);
        } else {
            newTagIds = [...tags.map(t => t.id), tagId];
        }

        try {
            const res = await api.patch<{ success: boolean; data: Task }>(`/tasks/${id}`, { tagIds: newTagIds });
            setTask(res.data.data);
            setTags(res.data.data.tags || []);
            setActivityRefreshKey((k) => k + 1);
        } catch (err) {
            console.error('Failed to update tags:', err);
        }
    };

    /* ── Relationship handlers ── */
    const handleAddRelationship = () => {
        if (!newRelationship.trim()) return;
        setRelationships((prev) => [...prev, newRelationship.trim()]);
        setNewRelationship('');
        setEditingRelationships(false);
    };

    const removeRelationship = (rel: string) => {
        setRelationships((prev) => prev.filter((r) => r !== rel));
    };


    if (loading) return <Loading size="lg" />;
    if (!task) return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">Task not found</div>;

    const priorityMeta = PRIORITY_META[task.priority];
    const dueInfo = relativeDueDate(task.dueDate);
    const createdDate = formatDate(task.createdAt);

    const content = (
        <div className={`min-h-full bg-white dark:bg-gray-900 flex ${isModal ? 'rounded-xl overflow-hidden shadow-2xl h-[90vh]' : ''}`}>
            {/* ══════════ Main Content ══════════ */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
                    <div className="flex items-center gap-2 text-[13px] min-w-0">
                        <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">T</span>
                        </div>
                        <Link to={`/projects/${task.projectId}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 truncate">
                            {task.project?.name || 'Project'}
                        </Link>
                        <span className="text-gray-300 dark:text-gray-600">/</span>
                        <span className="flex items-center gap-1 text-gray-800 dark:text-gray-200 font-medium truncate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 6h16M4 12h16M4 18h10" />
                            </svg>
                            {task.title}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        <span>Created {createdDate}</span>
                        <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-medium" title="Ask Brain">Ask</button>
                        <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-medium" title="Share Task">Share</button>
                        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="More options">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                        </button>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <button
                            onClick={() => isModal ? navigate(-1) : navigate('/')}
                            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                            title="Close (Esc)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>



                {/* ── Scrollable content ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-[900px] mx-auto px-6 py-5">
                        {/* Task type & ID row */}
                        <div className="flex items-center gap-3 mb-4">
                            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700" title="Task type">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                Task
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                            </button>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{task.id.slice(0, 8)}</span>
                            <button className="flex items-center gap-1 px-2.5 py-1 rounded border border-purple-200 bg-purple-50 dark:bg-purple-900/20 text-xs text-purple-600 hover:bg-purple-100" title="Ask AI">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                                Ask AI
                            </button>
                        </div>

                        {/* ── Title ── */}
                        {editingTitle ? (
                            <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={saveTitleEdit}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveTitleEdit(); if (e.key === 'Escape') setEditingTitle(false); }}
                                autoFocus
                                className="text-2xl font-bold text-gray-900 dark:text-white w-full border-b-2 border-indigo-500 outline-none pb-1 mb-2 bg-transparent"
                                title="Task title"
                                placeholder="Enter task title..."
                            />
                        ) : (
                            <div className="flex items-center gap-3">
                                <h1
                                    className={`text-2xl font-bold mb-2 rounded px-1 -mx-1 py-0.5 ${canUpdateTaskDetails ? 'text-gray-900 dark:text-white cursor-text hover:bg-gray-50 dark:hover:bg-gray-700' : 'text-gray-700 dark:text-gray-300'}`}
                                    onClick={() => { if (canUpdateTaskDetails) { setEditTitle(task.title); setEditingTitle(true); } }}
                                >
                                    {task.title}
                                </h1>
                                <button
                                    onClick={() => updateTask({ isFavorite: !task.isFavorite })}
                                    className={`mb-2 p-1 rounded-md transition-colors ${task.isFavorite ? 'text-amber-400' : 'text-gray-300 hover:text-gray-400'}`}
                                    title={task.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <svg width="20" height="20" fill={task.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* ── AI suggestion bar ── */}
                        <div className="flex items-center gap-2 px-3 py-2 mb-5 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                            Ask Brain to{' '}
                            <button className="text-indigo-500 hover:underline" title="Improve description">improve the description</button>,{' '}
                            <button className="text-indigo-500 hover:underline" title="Generate subtasks">generate subtasks</button>{' '}or{' '}
                            <button className="text-indigo-500 hover:underline" title="Find similar tasks">find similar tasks</button>
                        </div>

                        {/* ── Properties grid ── */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6 text-sm">
                            {/* Status */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconStatus />
                                    <span className="text-[13px] font-medium">Status</span>
                                </div>
                                <div className="relative" ref={statusRef}>
                                    {/* Status Button */}
                                    {(() => {
                                        const ds = DISPLAY_STATUSES.find(s => s.key === displayStatusKey) || DISPLAY_STATUSES[0];
                                        return (
                                            <button
                                                onClick={() => { if (canUpdateTaskStatus) { setStatusDropdown(!statusDropdown); setStatusSearch(''); } }}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${!canUpdateTaskStatus ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                {...{ style: { color: ds.textColor, backgroundColor: ds.bg, borderColor: ds.color + '40' } }}
                                                disabled={!canUpdateTaskStatus}
                                                title="Change status"
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    {...{ style: { backgroundColor: ds.dotStyle === 'solid' ? ds.color : 'transparent', border: `2px ${ds.dotStyle === 'border-2 border-dashed' ? 'dashed' : 'solid'} ${ds.color}` } }}
                                                />
                                                {ds.label}
                                                {canUpdateTaskStatus && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 5l7 7-7 7" /></svg>}
                                            </button>
                                        );
                                    })()}

                                    {/* Status Dropdown */}
                                    {statusDropdown && (
                                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl dark:shadow-gray-900 z-50 w-[220px] overflow-hidden">
                                            {/* Search */}
                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                                <input
                                                    value={statusSearch}
                                                    onChange={e => setStatusSearch(e.target.value)}
                                                    autoFocus
                                                    className="w-full text-xs bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
                                                    title="Search statuses"
                                                    placeholder="Search..."
                                                />
                                            </div>
                                            {/* Open statuses */}
                                            <div className="py-1">
                                                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Statuses</div>
                                                {DISPLAY_STATUSES.filter(s => s.section === 'open' && s.label.toLowerCase().includes(statusSearch.toLowerCase())).map(s => (
                                                    <button
                                                        key={s.key}
                                                        onClick={() => {
                                                            setDisplayStatusKey(s.key);
                                                            updateTask({ status: s.backendStatus });
                                                            setStatusDropdown(false);
                                                            setStatusSearch('');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${displayStatusKey === s.key ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                                                {...{ style: { backgroundColor: s.dotStyle === 'solid' ? s.color : 'transparent', border: `2px ${s.dotStyle === 'border-2 border-dashed' ? 'dashed' : 'solid'} ${s.color}` } }}
                                                            />
                                                            <span {...{ style: { color: s.textColor } }} className="font-medium">{s.label}</span>
                                                        </div>
                                                        {displayStatusKey === s.key && (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Closed section */}
                                            <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                                                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Closed</div>
                                                {DISPLAY_STATUSES.filter(s => s.section === 'closed' && s.label.toLowerCase().includes(statusSearch.toLowerCase())).map(s => (
                                                    <button
                                                        key={s.key}
                                                        onClick={() => {
                                                            setDisplayStatusKey(s.key);
                                                            updateTask({ status: s.backendStatus });
                                                            setStatusDropdown(false);
                                                            setStatusSearch('');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${displayStatusKey === s.key ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" {...{ style: { backgroundColor: s.color } }}>
                                                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                            <span {...{ style: { color: s.textColor } }} className="font-medium">{s.label}</span>
                                                        </div>
                                                        {displayStatusKey === s.key && (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assignees */}
                            <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400 pt-1">
                                    <IconUsers />
                                    <span className="text-[13px] font-medium">Assignees</span>
                                </div>
                                <div className="relative" ref={assigneeRef}>
                                    {/* Pill row */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <AvatarStack
                                            users={assignees}
                                            size="md"
                                            showPlaceholder
                                            max={5}
                                            onRemove={canUpdateTaskDetails ? (userId) => {
                                                const next = assignees.filter(a => a.id !== userId);
                                                setAssignees(next);
                                                updateTask({ assigneeIds: next.map(a => a.id) });
                                            } : undefined}
                                        />
                                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                                        {assignees.map(u => (
                                            <span
                                                key={u.id}
                                                className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-200 dark:hover:bg-gray-600"
                                            >
                                                <AvatarPill firstName={u.firstName} lastName={u.lastName} avatarUrl={u.avatarUrl} />
                                                <span className="font-medium">{u.firstName} {u.lastName}</span>
                                                {canUpdateTaskDetails && (
                                                    <button
                                                        onClick={() => {
                                                            const next = assignees.filter(a => a.id !== u.id);
                                                            setAssignees(next);
                                                            updateTask({ assigneeIds: next.map(a => a.id) });
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 ml-0.5 transition-colors"
                                                        title="Remove assignee"
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </span>
                                        ))}

                                        {/* Add assignee trigger */}
                                        {canUpdateTaskDetails && (
                                            <button
                                                onClick={() => { setAssigneeDropdown(!assigneeDropdown); setAssigneeSearch(''); }}
                                                className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                                                title="Add assignee"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 4v16m8-8H4" /></svg>
                                            </button>
                                        )}

                                        {/* Clear all button */}
                                        {canUpdateTaskDetails && assignees.length > 0 && (
                                            <button
                                                onClick={() => { setAssignees([]); updateTask({ assigneeIds: [] }); }}
                                                className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                                                title="Clear all assignees"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M23 4v6h-6" />
                                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Assignee Dropdown */}
                                    {assigneeDropdown && (
                                        <div className="absolute left-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl dark:shadow-gray-900 z-50 w-[260px] overflow-hidden">
                                            {/* Assignee pills preview */}
                                            {assignees.length > 0 && (
                                                <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap">
                                                    {assignees.map(u => (
                                                        u.avatarUrl ? (
                                                            <img key={u.id} src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" title={u.firstName} />
                                                        ) : (
                                                            <div key={u.id} className="w-6 h-6 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center" title={u.firstName}>
                                                                {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                                                            </div>
                                                        )
                                                    ))}
                                                    <span className="text-[11px] text-gray-400 dark:text-gray-500">—</span>
                                                </div>
                                            )}

                                            {/* Search */}
                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                                                    <input
                                                        type="text"
                                                        value={assigneeSearch}
                                                        onChange={e => setAssigneeSearch(e.target.value)}
                                                        placeholder="Search or enter email..."
                                                        autoFocus
                                                        className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400"
                                                        title="Search members"
                                                    />
                                                </div>
                                            </div>

                                            {/* Member list */}
                                            <div className="py-1 max-h-[220px] overflow-y-auto">
                                                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Assignees</div>
                                                {teamUsers
                                                    .filter(u => {
                                                        const q = assigneeSearch.toLowerCase();
                                                        return `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
                                                    })
                                                    .map(u => {
                                                        const isAssigned = assignees.some(a => a.id === u.id);
                                                        return (
                                                            <button
                                                                key={u.id}
                                                                onClick={() => {
                                                                    let next;
                                                                    if (isAssigned) {
                                                                        next = assignees.filter(a => a.id !== u.id);
                                                                    } else {
                                                                        next = [...assignees, u];
                                                                    }
                                                                    setAssignees(next);
                                                                    updateTask({ assigneeIds: next.map(a => a.id) });
                                                                }}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${isAssigned ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                                                title={`${isAssigned ? 'Remove' : 'Assign'} ${u.firstName} ${u.lastName}`}
                                                            >
                                                                {u.avatarUrl ? (
                                                                    <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                                                ) : (
                                                                    <div className="w-7 h-7 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <span className="text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">{u.firstName} {u.lastName}</span>
                                                                {isAssigned && (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                                                                )}
                                                            </button>
                                                        );
                                                    })
                                                }
                                            </div>

                                            {/* Footer */}
                                            <div className="border-t border-gray-100 dark:border-gray-700 p-2 space-y-1.5 bg-gray-50/30">
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setAssignees([]);
                                                            updateTask({ assigneeIds: [] });
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-100"
                                                        title="Remove all assignees"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        REMOVE ALL
                                                    </button>
                                                    <button
                                                        onClick={() => loadTeamUsers(task?.project?.organizationId)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all border border-transparent hover:border-emerald-100"
                                                        title="Refresh team members"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        REFRESH
                                                    </button>
                                                </div>
                                                <button className="w-full flex items-center justify-center gap-2 py-1.5 text-[11px] text-indigo-500 hover:text-indigo-700 font-medium" title="Fill with AI">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42" /></svg>
                                                    Set up fill with AI
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconCalendar />
                                    <span className="text-[13px] font-medium">Dates</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    {editingStartDate ? (
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            onBlur={() => setEditingStartDate(false)}
                                            autoFocus
                                            className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 outline-none bg-transparent dark:text-gray-300"
                                            title="Start date"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingStartDate(true)}
                                            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                            title="Edit start date"
                                        >
                                            <IconCalendar />
                                            <span>{startDate ? formatDate(startDate) : 'Start'}</span>
                                        </button>
                                    )}
                                    <span className="text-gray-400 dark:text-gray-500 mx-0.5">→</span>
                                    {editingDueDate ? (
                                        <input
                                            type="date"
                                            value={task.dueDate?.split('T')[0] || ''}
                                            onChange={(e) => {
                                                updateTask({ dueDate: e.target.value || null });
                                                setEditingDueDate(false);
                                            }}
                                            onBlur={() => setEditingDueDate(false)}
                                            autoFocus
                                            className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 outline-none bg-transparent dark:text-gray-300"
                                            title="Due date"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingDueDate(true)}
                                            className={`flex items-center gap-1 font-medium ${dueInfo.overdue ? 'text-red-500' : task.dueDate ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}
                                            title="Edit due date"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dueInfo.overdue ? '#ef4444' : '#9ca3af'} strokeWidth="2">
                                                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                                            </svg>
                                            {dueInfo.text}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconFlag color="#9ca3af" />
                                    <span className="text-[13px] font-medium">Priority</span>
                                </div>
                                <div className="relative" ref={priorityRef}>
                                    <button
                                        onClick={() => setPriorityDropdown(!priorityDropdown)}
                                        className="flex items-center gap-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-1.5 py-0.5"
                                        title="Change priority"
                                    >
                                        <IconFlag color={priorityMeta.color} />
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{priorityMeta.label}</span>
                                    </button>
                                    {priorityDropdown && (
                                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900 py-1 z-50 min-w-[120px]">
                                            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => { updateTask({ priority: p }); setPriorityDropdown(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${task.priority === p ? 'font-bold' : ''}`}
                                                    title={`Set priority to ${p}`}
                                                >
                                                    <IconFlag color={PRIORITY_META[p].color} />
                                                    {PRIORITY_META[p].label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Time Estimate */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconHourglass />
                                    <span className="text-[13px] font-medium">Time Estimate</span>
                                </div>
                                {editingTimeEstimate ? (
                                    <input
                                        type="text"
                                        value={timeEstimate}
                                        onChange={(e) => setTimeEstimate(e.target.value)}
                                        onBlur={() => setEditingTimeEstimate(false)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingTimeEstimate(false); if (e.key === 'Escape') setEditingTimeEstimate(false); }}
                                        placeholder="e.g. 2h 30m"
                                        autoFocus
                                        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none w-24 bg-transparent dark:text-gray-300"
                                        title="Time estimate"
                                    />
                                ) : (
                                    <button
                                        onClick={() => setEditingTimeEstimate(true)}
                                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                        title="Edit time estimate"
                                    >
                                        {timeEstimate || 'Empty'}
                                    </button>
                                )}
                            </div>

                            {/* Track Time */}
                            <div className="flex items-start gap-3 col-span-2">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400 pt-1">
                                    <IconTrackTime />
                                    <span className="text-[13px] font-medium">Track Time</span>
                                </div>
                                <div className="flex-1">
                                    <TimeTracker taskId={id!} onEntryChange={handleTimeEntryChange} />
                                    <TimeEntryList taskId={id!} refreshKey={timeRefreshKey} />
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconTag />
                                    <span className="text-[13px] font-medium">Tags</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap relative" ref={tagRef}>
                                    {tags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all"
                                            {...{ style: {
                                                backgroundColor: `${tag.color}15`,
                                                color: tag.color,
                                                borderColor: `${tag.color}30`
                                            } }}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" {...{ style: { backgroundColor: tag.color } }} />
                                            {tag.name}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleTag(tag.id); }}
                                                className="hover:opacity-70 ml-0.5"
                                                title="Remove tag"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                            </button>
                                        </span>
                                    ))}

                                    <div className="relative">
                                        <button
                                            onClick={() => setEditingTags(!editingTags)}
                                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                                            title="Edit tags"
                                        >
                                            {tags.length === 0 ? 'Empty' : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                                            )}
                                        </button>

                                        {editingTags && task && (
                                            <div className="absolute left-0 top-full mt-2 z-50">
                                                <TagPicker
                                                    organizationId={task.project?.organizationId || task.list?.space?.organizationId || ''}
                                                    selectedTagIds={tags.map(t => t.id)}
                                                    onToggleTag={handleToggleTag}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Relationships */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-[130px] shrink-0 text-gray-500 dark:text-gray-400">
                                    <IconLink />
                                    <span className="text-[13px] font-medium">Relationships</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {relationships.map((rel) => (
                                        <span key={rel} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[11px] font-medium">
                                            {rel}
                                            <button onClick={() => removeRelationship(rel)} className="hover:text-gray-800" title="Remove relationship">
                                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                            </button>
                                        </span>
                                    ))}
                                    {editingRelationships ? (
                                        <input
                                            type="text"
                                            value={newRelationship}
                                            onChange={(e) => setNewRelationship(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddRelationship(); if (e.key === 'Escape') setEditingRelationships(false); }}
                                            onBlur={() => { if (newRelationship.trim()) handleAddRelationship(); else setEditingRelationships(false); }}
                                            placeholder="Link name"
                                            autoFocus
                                            className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5 outline-none w-24 bg-transparent dark:text-gray-300"
                                            title="Relationship name"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingRelationships(true)}
                                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                            title="Add relationship"
                                        >
                                            {relationships.length === 0 ? 'Empty' : '+'}
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* ── Description content ── */}
                        <div className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-5">
                            {editingDesc ? (
                                <div>
                                    <textarea
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        onBlur={saveDescEdit}
                                        autoFocus
                                        className="w-full min-h-[200px] text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-indigo-300 rounded-md p-3 outline-none resize-y bg-transparent"
                                        title="Task description"
                                        placeholder="Add a description..."
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={saveDescEdit} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Save</button>
                                        <button onClick={() => setEditingDesc(false)} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded hover:bg-gray-200">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={`prose prose-sm max-w-none text-gray-700 dark:text-gray-300 min-h-[60px] ${canUpdateTaskDetails ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
                                    onClick={() => { if (canUpdateTaskDetails) { setEditDesc(task.description || ''); setEditingDesc(true); } }}
                                >
                                    {task.description ? (
                                        <div className="space-y-4">
                                            {(showMore ? task.description : task.description.slice(0, 500)).split('\n\n').map((para, i) => (
                                                <p key={i} className="leading-relaxed">{para}</p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 dark:text-gray-500 italic">Click to add a description...</p>
                                    )}
                                </div>
                            )}
                            {task.description && task.description.length > 500 && !editingDesc && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); }}
                                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mt-2"
                                    title={showMore ? "Show less" : "Show more"}
                                >
                                    <svg
                                        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                        className={`transition-transform ${showMore ? 'rotate-180' : ''}`}
                                    >
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                    {showMore ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </div>

                        {/* ── Subtasks ── */}
                        <div className="mb-8 overflow-visible">
                            <div className="flex items-center justify-between mb-3 border-b border-gray-50 dark:border-gray-800 pb-1">
                                <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Subtasks</h3>
                                {canUpdateTaskDetails && (
                                    <button
                                        onClick={() => setAddingSubtask(true)}
                                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-bold"
                                        title="Add subtask"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                        Add
                                    </button>
                                )}
                            </div>

                            {/* Subtask list */}
                            {subtasks.length > 0 && (
                                <div className="mb-3 border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                                    {subtasks.map((sub) => (
                                        <div key={sub.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 group hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <button
                                                onClick={() => toggleSubtaskStatus(sub.id)}
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sub.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                                                    }`}
                                                title={sub.status === 'COMPLETED' ? "Mark as incomplete" : "Mark as complete"}
                                            >
                                                {sub.status === 'COMPLETED' && (
                                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </button>
                                            <span className={`text-sm flex-1 ${sub.status === 'COMPLETED' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {sub.title}
                                            </span>
                                            {canUpdateTaskDetails && (
                                                <button
                                                    onClick={() => deleteSubtask(sub.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                                                    title="Delete subtask"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add subtask input */}
                            {canUpdateTaskDetails && (addingSubtask ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={subtaskInputRef}
                                        type="text"
                                        value={newSubtaskTitle}
                                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') setAddingSubtask(false); }}
                                        placeholder="Subtask name"
                                        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
                                        title="Subtask name"
                                    />
                                    <button
                                        onClick={handleAddSubtask}
                                        disabled={!newSubtaskTitle.trim()}
                                        className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setAddingSubtask(false)}
                                        className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : null)}
                        </div>

                        {/* ── Status Change Log at Bottom ── */}
                        <div className="mt-auto pt-10 pb-4 text-[11px] text-gray-400 dark:text-gray-500">
                            {canDeleteTask && (
                                <button onClick={deleteTask} className="hover:text-red-500 transition-colors" title="Delete task">Delete Task</button>
                            )}
                        </div>


                        {/* ── Checklists ── */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3 border-b border-gray-50 dark:border-gray-800 pb-1">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Checklists</h3>
                                <button
                                    onClick={() => setAddingChecklist(true)}
                                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-bold"
                                    title="Add checklist"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                    Add
                                </button>
                            </div>

                            {/* Existing checklists */}
                            {checklists.map((cl) => {
                                const doneCount = cl.items.filter((it) => it.checked).length;
                                const totalCount = cl.items.length;
                                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                                return (
                                    <div key={cl.id} className="mb-4 border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{cl.name}</h4>
                                            <div className="flex items-center gap-2">
                                                {totalCount > 0 && (
                                                    <span className="text-[11px] text-gray-400 dark:text-gray-500">{doneCount}/{totalCount} ({pct}%)</span>
                                                )}
                                                <button
                                                    onClick={() => deleteChecklist(cl.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                    title="Delete checklist"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        {totalCount > 0 && (
                                            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all"
                                                    {...{ style: pct ? { width: `${pct}%` } : {} }}
                                                />
                                            </div>
                                        )}

                                        {/* Checklist items */}
                                        {cl.items.map((item) => (
                                            <div key={item.id} className="flex items-center gap-2.5 py-1.5 group">
                                                <button
                                                    onClick={() => toggleChecklistItem(cl.id, item.id)}
                                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                                                        }`}
                                                    title={item.checked ? "Uncheck" : "Check"}
                                                >
                                                    {item.checked && (
                                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                </button>
                                                <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {item.text}
                                                </span>
                                                <button
                                                    onClick={() => deleteChecklistItem(cl.id, item.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                                                    title="Delete checklist item"
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}

                                        {/* Add item to checklist */}
                                        {addingChecklistItem === cl.id ? (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input
                                                    type="text"
                                                    value={newChecklistItemText}
                                                    onChange={(e) => setNewChecklistItemText(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklistItem(cl.id); if (e.key === 'Escape') setAddingChecklistItem(null); }}
                                                    placeholder="Item name"
                                                    autoFocus
                                                    className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
                                                    title="Item name"
                                                />
                                                <button onClick={() => handleAddChecklistItem(cl.id)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Add</button>
                                                <button onClick={() => setAddingChecklistItem(null)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setAddingChecklistItem(cl.id); setNewChecklistItemText(''); }}
                                                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-2"
                                                title="Add item"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                                Add item
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Create checklist */}
                            {canUpdateTaskDetails && (addingChecklist ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newChecklistName}
                                        onChange={(e) => setNewChecklistName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChecklist(); if (e.key === 'Escape') setAddingChecklist(false); }}
                                        placeholder="Checklist name"
                                        autoFocus
                                        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
                                        title="Checklist name"
                                    />
                                    <button
                                        onClick={handleCreateChecklist}
                                        disabled={!newChecklistName.trim()}
                                        className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 disabled:opacity-50"
                                    >
                                        Create
                                    </button>
                                    <button onClick={() => setAddingChecklist(false)} className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setAddingChecklist(true); setNewChecklistName(''); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                                    title="Create checklist"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                    Create checklist
                                </button>
                            ))}
                        </div>

                        {/* ── Attachments ── */}
                        <AttachmentSection taskId={id!} />
                    </div>
                </div>
            </div>

            {/* ══════════ Right Sidebar: Activity ══════════ */}
            <div className="w-[360px] shrink-0 flex flex-col bg-white dark:bg-gray-900 hidden lg:flex">
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Activity</h2>
                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                        <button className="hover:text-gray-600 dark:hover:text-gray-300" title="Search activity">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                        </button>
                        <div className="flex items-center gap-0.5 text-xs">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
                            <span>{comments.length}</span>
                        </div>
                        <button className="hover:text-gray-600 dark:hover:text-gray-300" title="Filter activity">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </button>
                    </div>
                </div>

                {/* Tab strip */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setActivityTab('activity')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${activityTab === 'activity'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        title="Activity Feed"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                        Activity
                    </button>
                    <button
                        onClick={() => setActivityTab('comments')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${activityTab === 'comments'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        title="Comments Feed"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                        Comments
                        {comments.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px]">
                                {comments.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Activity/Comments feed */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {activityTab === 'activity' ? (
                        <ActivityTimeline taskId={id!} refreshKey={activityRefreshKey} />
                    ) : (
                        <>
                            {comments.length === 0 && (
                                <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
                                    No comments yet
                                </div>
                            )}
                            {comments.map((c) => (
                                <div key={c.id} className="flex items-start gap-3">
                                    {c.user.avatarUrl ? (
                                        <img src={c.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 shadow-sm" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                            {c.user.firstName.charAt(0).toUpperCase()}{c.user.lastName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] text-gray-700 dark:text-gray-300 font-medium">{c.user.firstName} {c.user.lastName}</span>
                                            <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(c.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Comment input - bottom */}
                {canAddComments ? (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-3 mt-auto">
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handlePostComment();
                                    }
                                }}
                                placeholder="Write a comment..."
                                className="w-full px-3 pt-3 pb-2 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none resize-none"
                                rows={2}
                                title="Write a comment"
                            />
                            <div className="flex items-center justify-between px-3 pb-2">
                                <div className="flex items-center gap-1.5">
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Attach"><IconPlus /></button>
                                    <div className="flex items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5">
                                        Comment
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                    </div>
                                    <button className="text-purple-400 hover:text-purple-600" title="Add reaction">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>
                                    </button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-[11px] font-bold" title="Insert GIF">GIF</button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Attach file"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg></button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-medium" title="Mention someone">@</button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Format emoji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" /></svg></button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Format code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg></button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Insert table"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="15" height="16" rx="2" /><path d="M17 10l5-3v10l-5-3" /></svg></button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Record video"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg></button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Format options"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 22L17 2" /></svg></button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="More options"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></button>
                                    <button
                                        onClick={handlePostComment}
                                        className={`${comment.trim() ? 'text-indigo-500 hover:text-indigo-600' : 'text-gray-300 dark:text-gray-600'}`}
                                        title="Send message"
                                    >
                                        <IconSend />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
                        View-only mode. You cannot post comments.
                    </div>
                )}
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-[2px]"
                    onClick={() => navigate(-1)}
                />
                {/* Modal Window */}
                <div className="relative w-full max-w-[1200px] bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="-m-4 sm:-m-6 h-full overflow-hidden">
            {content}
        </div>
    );
}

