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

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    updateActiveFormats();
    if (editorRef.current) {
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
      onChange(editorRef.current.innerHTML);
    }
    updateActiveFormats();
  };

  const handleLink = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    const url = window.prompt('Enter URL (https://...):', 'https://');
    if (url) {
      exec('createLink', url);
      if (selectedText) {
        const links = editorRef.current?.querySelectorAll('a');
        links?.forEach((link) => {
          if (link.getAttribute('href') === url) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        });
      }
    }
  };

  const handleUnlink = () => {
    exec('unlink');
  };

  const handleImage = () => {
    const url = window.prompt('Enter image URL (https://...):', 'https://');
    if (url) {
      exec('insertImage', url);
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

        <button type="button" onClick={handleLink} className={btnClass(false)} title="Insert Link">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleUnlink} className={btnClass(false)} title="Remove Link">
          <Unlink className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleImage} className={btnClass(false)} title="Insert Image">
          <ImageIcon className="w-4 h-4" />
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
        onMouseUp={updateActiveFormats}
        onKeyUp={updateActiveFormats}
        className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 outline-none prose prose-sm max-w-none focus:outline-none"
        style={{ lineHeight: '1.6' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}
