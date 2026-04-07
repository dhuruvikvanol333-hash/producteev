import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { AttachmentItem, type AttachmentData } from './AttachmentItem';

interface Props {
  taskId: string;
}

interface UploadProgress {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

function ProgressBar({ progress }: { progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.width = `${progress}%`;
  }, [progress]);
  
  return (
    <div
      ref={ref}
      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
    />
  );
}

export function AttachmentSection({ taskId }: Props) {
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: AttachmentData[] }>(`/attachments/task/${taskId}`);
      setAttachments(res.data.data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const uploadFile = async (file: File, customPath?: string) => {
    const uploadId = crypto.randomUUID();
    // Use custom path or webkitRelativePath or just name
    const fileName = customPath || (file as any).webkitRelativePath || file.name;

    // Add to progress list
    setUploads((prev) => [...prev, { id: uploadId, name: fileName, progress: 0 }]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', fileName);

    try {
      await api.post(`/attachments/task/${taskId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u))
          );
        },
      });

      // Remove from progress and reload
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      await loadAttachments();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Upload failed';
      setUploads((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, error: msg, progress: 100 } : u))
      );

      // Remove error after 4 seconds
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      }, 4000);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => uploadFile(file));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/attachments/${id}`);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  // Recursively read items from DataTransferItem (Folder upload support)
  const traverseDirectory = async (entry: FileSystemEntry, pathPrefix: string = '') => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve));
      uploadFile(file, `${pathPrefix}${file.name}`);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
      for (const subEntry of entries) {
        await traverseDirectory(subEntry, `${pathPrefix}${entry.name}/`);
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const items = e.dataTransfer.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          if (item.isFile) {
            const file = items[i].getAsFile();
            if (file) uploadFile(file);
          } else if (item.isDirectory) {
            await traverseDirectory(item);
          }
        }
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Fallback for older browsers
      handleFiles(e.dataTransfer.files);
    }
  };

  const imageAttachments = attachments.filter((a) => a.isImage);
  const fileAttachments = attachments.filter((a) => !a.isImage);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
          Attachments
          {attachments.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
              ({attachments.length})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            File
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-700 font-medium"
            title="Upload Folder"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Folder
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        title="Upload files"
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "true", directory: "true" } as any)}
        className="hidden"
        onChange={handleFileSelect}
        title="Upload folder"
      />

      {/* Upload progress bars */}
      {uploads.length > 0 && (
        <div className="mb-3 space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className={`rounded-lg border px-3 py-2 ${u.error
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{u.name}</span>
                {u.error ? (
                  <span className="text-[10px] text-red-500 ml-2 shrink-0">{u.error}</span>
                ) : (
                  <span className="text-[10px] text-indigo-500 ml-2 shrink-0">{u.progress}%</span>
                )}
              </div>
              {!u.error && (
                <div className="w-full h-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                  <ProgressBar progress={u.progress} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image grid preview */}
      {imageAttachments.length > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-4 gap-2">
            {imageAttachments.slice(0, 4).map((att) => (
              <AttachmentItem
                key={att.id}
                attachment={att}
                onDelete={handleDelete}
                baseUrl="/api/v1"
              />
            ))}
          </div>
          {imageAttachments.length > 4 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              +{imageAttachments.length - 4} more images
            </p>
          )}
        </div>
      )}

      {/* File list */}
      {fileAttachments.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {fileAttachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              onDelete={handleDelete}
              baseUrl="/api/v1"
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && attachments.length === 0 && (
        <div className="text-center py-4">
          <svg className="animate-spin w-4 h-4 text-gray-400 mx-auto" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
          </svg>
        </div>
      )}

      {/* Drag and drop zone */}
      <div
        ref={dropRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg py-5 text-center cursor-pointer transition-all ${isDragging
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
      >
        {isDragging ? (
          <div className="flex flex-col items-center gap-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="text-sm text-indigo-500 font-medium">Drop files here</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Drop files here or{' '}
              <span className="text-indigo-500 hover:underline">browse</span>
            </span>
            <span className="text-[10px] text-gray-300 dark:text-gray-600">
              Max 50MB - Images, PDFs, Docs, PPT, Excel, ZIP & more
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
