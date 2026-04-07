import { useState } from 'react';
import { ImagePreview } from './ImagePreview';

export interface AttachmentData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
}

interface Props {
  attachment: AttachmentData;
  onDelete: (id: string) => void;
  baseUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return (
      <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M10 13l4 4M14 13l-4 4" strokeWidth="2" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return (
      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h2v2H8zM12 13h2v2h-2zM8 17h2v2H8z" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('zip') || mimeType.includes('rar')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M10 12h4M10 15h4M10 18h4" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
        <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  );
}

export function AttachmentItem({ attachment, onDelete, baseUrl }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const downloadUrl = `${baseUrl}/attachments/${attachment.id}/download`;
  const imageUrl = `/uploads/${attachment.filename}`;

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors">
        {/* Thumbnail or Icon */}
        {attachment.isImage && attachment.thumbnailUrl && !thumbError ? (
          <button
            onClick={() => setPreviewOpen(true)}
            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 hover:ring-2 hover:ring-indigo-400 transition-all"
          >
            <img
              src={attachment.thumbnailUrl}
              alt={attachment.originalName}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
          </button>
        ) : (
          <FileTypeIcon mimeType={attachment.mimeType} />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => attachment.isImage ? setPreviewOpen(true) : window.open(downloadUrl, '_blank')}
            className="text-sm text-gray-700 dark:text-gray-300 font-medium hover:text-indigo-600 dark:hover:text-indigo-400 truncate block text-left w-full"
          >
            {attachment.originalName}
          </button>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            <span>{formatSize(attachment.size)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{formatDate(attachment.createdAt)}</span>
            {attachment.uploadedBy && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span>{attachment.uploadedBy.firstName}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Download */}
          <a
            href={downloadUrl}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Download"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </a>

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(attachment.id); setConfirmDelete(false); }}
                className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Image preview modal */}
      {previewOpen && attachment.isImage && (
        <ImagePreview
          src={imageUrl}
          alt={attachment.originalName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
