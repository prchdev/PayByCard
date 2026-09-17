import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, FileText, Maximize2, ExternalLink } from 'lucide-react';

interface FileUploadFieldProps {
  label: string;
  accept: string;
  existingUrl: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  required?: boolean;
}

export default function FileUploadField({
  label,
  accept,
  existingUrl,
  file,
  onChange,
  disabled,
  required,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [removedExisting, setRemovedExisting] = useState(false);

  const localPreview = file ? URL.createObjectURL(file) : null;
  const displayUrl = (localPreview ?? (removedExisting ? null : existingUrl));
  const isExistingFile = !localPreview && !!existingUrl && !removedExisting;

  const isImage = (() => {
    if (file) return file.type.startsWith('image/');
    if (displayUrl) {
      const ext = displayUrl.split('?')[0].split('.').pop()?.toLowerCase();
      return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
    }
    return accept.includes('image') || accept.includes('png') || accept.includes('jpg');
  })();

  const isPdf = (() => {
    if (file) return file.type === 'application/pdf';
    if (displayUrl) {
      const ext = displayUrl.split('?')[0].split('.').pop()?.toLowerCase();
      return ext === 'pdf';
    }
    return accept.includes('pdf');
  })();

  useEffect(() => {
    if (file) {
      setRemovedExisting(false);
    }
  }, [file]);

  useEffect(() => {
    setRemovedExisting(false);
  }, [existingUrl]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>

      {displayUrl ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {isImage ? (
            <div className="relative group">
              <img
                src={displayUrl}
                alt={label}
                className="w-full max-h-52 object-contain p-3 cursor-zoom-in"
                onClick={() => setLightbox(true)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 flex items-center gap-1.5 shadow"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  View Full Size
                </button>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setRemovedExisting(true);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors z-10"
                  title="Replace image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : isPdf ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {file ? file.name : 'Uploaded PDF'}
                  </p>
                  {isExistingFile && (
                    <p className="text-xs text-gray-400">Previously uploaded</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isExistingFile && (
                  <a
                    href={existingUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center text-blue-500 hover:text-blue-700 transition-colors"
                    title="Open PDF"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      setRemovedExisting(true);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {isExistingFile && isImage && (
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Previously uploaded</span>
              <a
                href={existingUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open original
              </a>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center gap-2 transition-colors ${
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : 'border-gray-300 hover:border-[#8c76f0] hover:bg-purple-50 cursor-pointer'
          }`}
        >
          <Upload className={`w-6 h-6 ${disabled ? 'text-gray-400' : 'text-[#8c76f0]'}`} />
          <span className="text-sm text-gray-500">
            {disabled ? 'Upload disabled' : `Click to upload`}
          </span>
          <span className="text-xs text-gray-400">{accept.replace(/\./g, '').replace(/,/g, ' / ').toUpperCase()} &bull; Max 1 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          if (selected && selected.size > 1024 * 1024) {
            setSizeError(`File is ${(selected.size / (1024 * 1024)).toFixed(2)} MB — must be less than 1 MB.`);
            e.target.value = '';
            return;
          }
          setSizeError(null);
          onChange(selected);
        }}
      />

      {sizeError && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-100 text-red-600 text-center leading-3.5 font-bold flex-shrink-0">!</span>
          {sizeError}
        </p>
      )}

      {lightbox && displayUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={displayUrl}
              alt={label}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-4 py-1.5 text-xs font-medium text-gray-700 flex items-center gap-1.5 hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
