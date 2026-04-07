import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

interface Props {
  initialValue: string;
  onSave: (html: string) => void;
  onCancel: () => void;
  taskId: string;
}

export function TaskDescriptionEditor({ initialValue, onSave, onCancel, taskId }: Props) {
  const [html, setHtml] = useState(initialValue || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!initialValue);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialValue) {
      editorRef.current.innerHTML = initialValue || '';
      setIsEmpty(!initialValue);
    }
  }, [initialValue]);

  const handleInput = () => {
    if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        const text = editorRef.current.innerText.trim();
        setIsEmpty(!text && !currentHtml.includes('<img'));
        setHtml(currentHtml);
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textContent = range.startContainer.textContent || '';
            const caretPos = range.startOffset;
            
            if (caretPos > 0 && textContent[caretPos - 1] === '/') {
                const rect = range.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                setMenuOpen(true);
            } else {
                setMenuOpen(false);
            }
        }
    }
  };

  const handleCommand = async (command: string) => {
    setMenuOpen(false);
    if (!editorRef.current) return;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.setStart(range.startContainer, range.startOffset - 1);
        range.deleteContents();
    }

    if (command === 'img') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                setIsUploading(true);
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await api.post(`/attachments/task/${taskId}`, formData);
                    const fileName = res.data.data.filename;
                    
                    const imgHtml = `<img src="/uploads/${fileName}" style="max-width: 100%; border-radius: 8px; margin: 10px 0; display: block;" />`;
                    document.execCommand('insertHTML', false, imgHtml);
                    setHtml(editorRef.current?.innerHTML || '');
                    setIsEmpty(false);
                } catch (err) {
                    console.error('Upload failed', err);
                } finally {
                    setIsUploading(false);
                }
            }
        };
        input.click();
    } else if (command === 'h1' || command === 'h2' || command === 'h3' || command === 'h4') {
        document.execCommand('formatBlock', false, command.toUpperCase());
    } else if (command === 'bulletList') {
        document.execCommand('insertUnorderedList', false);
    } else if (command === 'numberList') {
        document.execCommand('insertOrderedList', false);
    } else if (command === 'quote') {
        document.execCommand('formatBlock', false, 'BLOCKQUOTE');
    } else if (command === 'code') {
        const codeHtml = `<pre style="background: #f3f4f6; padding: 10px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; margin: 10px 0;"><code>Code goes here...</code></pre><p><br></p>`;
        document.execCommand('insertHTML', false, codeHtml);
    } else if (command === 'checklist') {
        const taskHtml = `<div class="editor-checklist-item" style="display: flex; align-items: start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 4px;" disabled /> <div contenteditable="true" style="flex: 1;">Checklist item...</div></div><p><br></p>`;
        document.execCommand('insertHTML', false, taskHtml);
    }
    
    editorRef.current.focus();
  };

  return (
    <div className="relative group">
      <div className="relative flex items-start gap-2">
        <button 
          onClick={(e) => {
            const rect = (e.currentTarget).getBoundingClientRect();
            setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
            setMenuOpen(!menuOpen);
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="mt-4 w-5 h-5 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 font-bold text-xs text-gray-300 hover:text-indigo-500 hover:border-indigo-200 transition-colors shrink-0"
          title="Open commands"
        >
          +
        </button>

        <div className="relative flex-1">
          <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              className="w-full min-h-[300px] text-sm text-gray-700 dark:text-gray-300 leading-relaxed outline-none py-4 bg-transparent transition-all overflow-y-auto z-10"
              style={{ whiteSpace: 'pre-wrap' }}
          />
          
          {isEmpty && (
              <div className="absolute top-4 left-0 text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                  Write or type '/' for commands and AI actions
              </div>
          )}
        </div>
      </div>
      
      {menuOpen && (
        <div 
          className="fixed z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 w-[240px] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: menuPos.top + 5, left: menuPos.left }}
        >
          <div className="p-2 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">TEXT COMMANDS</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin">
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('h1'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">H1</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Heading 1</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('h2'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">H2</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Heading 2</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('h3'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">H3</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Heading 3</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('h4'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">H4</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Heading 4</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('checklist'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">&#9745;</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Checklist</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('bulletList'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">&#8226;</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Bulleted list</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('numberList'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">1.</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Numbered list</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('quote'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold">"</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Block quote</span>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('code'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold">&lt;&gt;</div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Code block</span>
            </button>
            
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
            <div className="px-2 py-1 flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">MEDIA</span>
            </div>
            <button onMouseDown={(e) => { e.preventDefault(); handleCommand('img'); }} className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left outline-none">
              <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold">&#128247;</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Image</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-lg backdrop-blur-[1px] z-10">
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
            </svg>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Uploading...</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button 
          onClick={() => onSave(html)} 
          className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Save Changes
        </button>
        <button 
          onClick={onCancel} 
          className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
