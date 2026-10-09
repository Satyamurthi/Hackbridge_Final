import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCheck2,
  AlertCircle,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import {
  StorageBucket,
  BUCKET_CONSTRAINTS,
  validateStorageFile,
  uploadFileToBucket,
} from '../../lib/storage';

export interface FileUploadDropzoneProps {
  bucket: StorageBucket;
  pathPrefix: string;
  label?: string;
  helperText?: string;
  currentUrl?: string | null;
  onUploadComplete: (result: { path: string; url: string; file: File }) => void;
  onUploadError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  bucket,
  pathPrefix,
  label,
  helperText,
  currentUrl,
  onUploadComplete,
  onUploadError,
  onRemove,
  disabled = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(currentUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const constraints = BUCKET_CONSTRAINTS[bucket];

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    // 1. Validation
    const validation = validateStorageFile(file, bucket);
    if (!validation.valid) {
      const err = validation.error || 'Invalid file format or size.';
      setErrorMessage(err);
      onUploadError?.(err);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(20);

    // Simulate progressive upload
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 150);

    try {
      const cleanPrefix = pathPrefix.replace(/\/+$/, '');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = `${cleanPrefix}/${Date.now()}_${safeName}`;

      const { path, url, error } = await uploadFileToBucket(bucket, targetPath, file);

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (error || !url) {
        throw new Error(error || 'Upload failed');
      }

      setActiveUrl(url);
      onUploadComplete({ path: path || targetPath, url, file });
    } catch (err) {
      clearInterval(progressTimer);
      const errText = err instanceof Error ? err.message : 'Upload failed.';
      setErrorMessage(errText);
      onUploadError?.(errText);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setActiveUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const isImage =
    constraints.allowedExtensions.some((ext) => ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) ||
    selectedFile?.type.startsWith('image/');

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
            {label}
          </label>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
            Max {constraints.maxSizeLabel}
          </span>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 scale-[0.99]'
            : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={constraints.allowedExtensions.join(',')}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {/* Uploading State */}
        {isUploading ? (
          <div className="py-3 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Uploading file to secure storage...
            </p>
            <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
              {uploadProgress}%
            </p>
          </div>
        ) : activeUrl ? (
          /* File Attached / Uploaded Preview */
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 min-w-0">
              {isImage && activeUrl ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-100 dark:bg-gray-900">
                  <img
                    src={activeUrl}
                    alt="Uploaded asset"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {selectedFile ? selectedFile.name : activeUrl.split('/').pop()}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Securely attached</span>
                  {selectedFile && (
                    <span className="text-gray-400 dark:text-gray-500">
                      • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-xs px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                title="Remove file"
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Prompt State */
          <div className="py-3 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
              {isImage ? (
                <ImageIcon className="w-6 h-6" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">
              Drag & drop file here, or{' '}
              <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Supports {constraints.allowedExtensions.join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Helper Text or Error Banner */}
      {errorMessage ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
};
