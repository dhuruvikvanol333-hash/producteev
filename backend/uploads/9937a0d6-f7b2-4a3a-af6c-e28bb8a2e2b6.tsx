import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import api from '../../services/api';
import { StatusSettings } from '../../components/status';
import { Loading } from '../../components/ui/Loading';

interface ListData {
  id: string;
  name: string;
  color: string | null;
  spaceId: string;
}

export function ListSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadList = async () => {
      try {
        const res = await api.get<{ success: boolean; data: ListData }>(`/lists/${id}`);
        setList(res.data.data);
      } catch (err) {
        console.error('Failed to load list:', err);
      } finally {
        setLoading(false);
      }
    };
    loadList();
  }, [id]);

  if (loading) return <Loading size="lg" />;

  if (!list) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-12">
        List not found
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-white font-medium">{list.name}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-500 dark:text-gray-400">Settings</span>
      </div>

      {/* Status Settings */}
      <StatusSettings listId={list.id} listName={list.name} />
    </div>
  );
}
