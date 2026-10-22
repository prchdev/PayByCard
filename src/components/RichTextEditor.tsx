import { useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Undo2,
  Redo2,
  Unlink,
  X,
  Upload,
  Loader2,
  Pencil,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const FONT_SIZES = [
  { label: '12px', value: '2' },
  { label: '14px', value: '3' },
  { label: '16px', value: '4' },
  { label: '18px', value: '5' },
  { label: '24px', value: '6' },
  { label: '32px', value: '7' },
];

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [linkModal, setLinkModal] = useState<{ url: string; text: string; isNew: boolean } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const savedRangeRef = useRef<Range | null>(null);

  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedRangeRef.current && editorRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  };

  const exec = (command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    updateActiveFormats();
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('ul');
    if (document.queryCommandState('insertOrderedList')) formats.add('ol');
    if (document.queryCommandState('justifyLeft')) formats.add('left');
    if (document.queryCommandState('justifyCenter')) formats.add('center');
    if (document.queryCommandState('justifyRight')) formats.add('right');
    setActiveFormats(formats);
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
    updateActiveFormats();
  };

  // --- Link handling ---

  const getSelectedLink = (): HTMLAnchorElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
        return node as HTMLAnchorElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const openLinkModal = () => {
    saveSelection();
    const sel = window.getSelection();
    const selectedText = sel?.toString() || '';
    const existingLink = getSelectedLink();

    if (existingLink) {
      setLinkModal({
        url: existingLink.getAttribute('href') || 'https://',
        text: existingLink.textContent || selectedText,
        isNew: false,
      });
    } else {
      setLinkModal({
        url: 'https://',
        text: selectedText,
        isNew: true,
      });
    }
  };

  const applyLink = () => {
    if (!linkModal) return;
    restoreSelection();
    editorRef.current?.focus();

    const url = linkModal.url.trim();
    if (!url) {
      setLinkModal(null);
      return;
    }

    const sel = window.getSelection();
    const existingLink = getSelectedLink();

    if (existingLink) {
      existingLink.setAttribute('href', url);
      existingLink.setAttribute('target', '_blank');
      existingLink.setAttribute('rel', 'noopener noreferrer');
      if (linkModal.text && linkModal.text !== existingLink.textContent) {
        existingLink.textContent = linkModal.text;
      }
    } else if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (linkModal.text && linkModal.text !== sel.toString()) {
        range.deleteContents();
        const anchor = document.createElement('a');
        anchor.setAttribute('href', url);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
        anchor.textContent = linkModal.text;
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.setEndAfter(anchor);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        exec('createLink', url);
        const links = editorRef.current?.querySelectorAll('a');
        links?.forEach((link) => {
          if (link.getAttribute('href') === url) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        });
      }
    }

    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
    setLinkModal(null);
  };

  const handleUnlink = () => {
    exec('unlink');
  };

  // --- Image handling (base64 upload + paste) ---

  const insertImageAtCursor = (dataUrl: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    let inserted = false;

    try {
      const sel = window.getSelection();
      if (savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)) {
        const range = savedRangeRef.current.cloneRange();
        sel?.removeAllRanges();
        sel?.addRange(range);

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';

        range.insertNode(img);

        const afterRange = document.createRange();
        afterRange.setStartAfter(img);
        afterRange.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(afterRange);
        savedRangeRef.current = afterRange.cloneRange();
        inserted = true;
      }
    } catch {
      inserted = false;
    }

    if (!inserted) {
      const imgHtml = `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`;
      const breakHtml = '<p><br></p>';
      const current = editor.innerHTML;
      editor.innerHTML = current + imgHtml + breakHtml;
    }

    isInternalChange.current = true;
    onChange(editor.innerHTML);
  };

  const openImagePicker = () => {
    saveSelection();
    fileInputRef.current?.click();
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setImageUploading(false);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageUploading(false);
      return;
    }

    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setTimeout(() => {
        insertImageAtCursor(dataUrl);
        setImageUploading(false);
      }, 0);
    };
    reader.onerror = () => setImageUploading(false);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file || file.size > MAX_IMAGE_SIZE) return;
        saveSelection();
        setImageUploading(true);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          insertImageAtCursor(dataUrl);
          setImageUploading(false);
        };
        reader.onerror = () => setImageUploading(false);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      exec('fontSize', val);
    }
  };

  const btnClass = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${
      active
        ? 'bg-[#8c76f0] text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="border-2 border-gray-300 rounded-xl overflow-hidden focus-within:border-[#8c76f0] focus-within:ring-4 focus-within:ring-purple-50 transition-all">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFile}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec('undo')} className={btnClass(false)} title="Undo">
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('redo')} className={btnClass(false)} title="Redo">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={() => exec('bold')} className={btnClass(activeFormats.has('bold'))} title="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('italic')} className={btnClass(activeFormats.has('italic'))} title="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('underline')} className={btnClass(activeFormats.has('underline'))} title="Underline">
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('strikeThrough')} className={btnClass(activeFormats.has('strikeThrough'))} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={() => exec('formatBlock', '<h1>')} className={btnClass(false)} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('formatBlock', '<h2>')} className={btnClass(false)} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('formatBlock', '<h3>')} className={btnClass(false)} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('formatBlock', '<p>')} className={btnClass(false)} title="Paragraph">
          <Type className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <select
          onChange={handleFontSize}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-[#8c76f0] cursor-pointer"
          defaultValue=""
          title="Font Size"
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnClass(activeFormats.has('ul'))} title="Bullet List">
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btnClass(activeFormats.has('ol'))} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={() => exec('justifyLeft')} className={btnClass(activeFormats.has('left'))} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('justifyCenter')} className={btnClass(activeFormats.has('center'))} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('justifyRight')} className={btnClass(activeFormats.has('right'))} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={openLinkModal} className={btnClass(false)} title="Insert / Edit Link">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleUnlink} className={btnClass(false)} title="Remove Link">
          <Unlink className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={openImagePicker}
          disabled={imageUploading}
          className={btnClass(false) + ' disabled:opacity-50'}
          title="Upload Image (embedded as base64)"
        >
          {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button type="button" onClick={() => exec('removeFormat')} className={btnClass(false)} title="Clear Formatting">
          <span className="text-xs font-medium">Clear</span>
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onMouseUp={updateActiveFormats}
        onKeyUp={updateActiveFormats}
        className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 outline-none prose prose-sm max-w-none focus:outline-none"
        style={{ lineHeight: '1.6' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Link modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setLinkModal(null)}
          />
          <div className="relative bg-white rounded-2xl border-2 border-gray-300 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                {linkModal.isNew ? <LinkIcon className="w-5 h-5 text-blue-600" /> : <Pencil className="w-5 h-5 text-blue-600" />}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {linkModal.isNew ? 'Insert Link' : 'Edit Link'}
              </h3>
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link Text</label>
                <input
                  type="text"
                  value={linkModal.text}
                  onChange={(e) => setLinkModal({ ...linkModal, text: e.target.value })}
                  placeholder="Text to display"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                <input
                  type="url"
                  value={linkModal.url}
                  onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                {linkModal.isNew ? 'Insert' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
