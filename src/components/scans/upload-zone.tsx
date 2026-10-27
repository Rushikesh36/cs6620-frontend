'use client';

import { FileArchive, Upload, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/utils/format';
import { MAX_ZIP_LABEL, validateZipFile, ZIP_ACCEPT } from '@/lib/validation/zip-file';

/**
 * Pick a .zip by dragging it in or by browsing. It is a real file input underneath, so it also
 * works with the keyboard (Tab to it, Enter or Space to open the file dialog).
 */
export function UploadZone({
  file,
  onFileChange,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (files: FileList | File[] | null | undefined) => {
    const list = files ? Array.from(files) : [];
    const first = list[0];
    if (!first) return;
    if (list.length > 1) {
      setError('Choose one .zip file at a time.');
      return;
    }
    const problem = validateZipFile(first);
    setError(problem);
    // A rejected file never replaces one that was already accepted.
    if (!problem) onFileChange(first);
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        data-dragging={dragging || undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) choose(event.dataTransfer.files);
        }}
        className={cn(
          'border-border has-[input:focus-visible]:ring-ring flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition has-[input:focus-visible]:ring-2',
          dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <Upload className="text-primary size-8" aria-hidden />
        <span className="font-medium">Drag and drop your .zip here, or choose a file</span>
        <span id={`${id}-help`} className="text-muted-foreground text-sm">
          Only .zip files, up to {MAX_ZIP_LABEL}.
        </span>
        <input
          id={id}
          type="file"
          accept={ZIP_ACCEPT}
          disabled={disabled}
          aria-describedby={`${id}-help`}
          className="sr-only"
          onChange={(event) => {
            choose(event.target.files);
            // So choosing the same file again still counts as a change.
            event.target.value = '';
          }}
        />
      </label>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {file && (
        <div className="border-border flex items-center gap-3 rounded-xl border p-3">
          <FileArchive className="text-primary size-6 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
            onClick={() => {
              setError(null);
              onFileChange(null);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
