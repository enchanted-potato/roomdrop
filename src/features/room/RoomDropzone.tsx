import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';

export interface RoomDropzoneProps {
  onFile: (file: File) => void;
  /** "Try with a sample room" secondary entry (ONB-02). */
  onSample?: () => void;
}

/**
 * Empty-state dropzone. Owns the hidden <input type=file> and drag/drop
 * handlers. Plan 04 will pass a pipeline-running `onFile` handler.
 *
 * T-01-02-03 mitigation: never renders `file.name` (or any user-supplied
 * string from the File object). Filename XSS surface stays absent by design.
 */
export function RoomDropzone({ onFile, onSample }: RoomDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragover, setIsDragover] = useState(false);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragover(true);
  };
  const onDragLeave = () => {
    setIsDragover(false);
  };
  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        'border-2 border-dashed rounded-2xl bg-surface p-6 md:p-12 text-center cursor-pointer transition-colors ' +
        (isDragover ? 'border-accent bg-accent/5' : 'border-border-d')
      }
    >
      <div className="flex justify-center">
        <ImagePlus aria-hidden="true" size={32} style={{ color: 'var(--ink-mut)' }} />
      </div>
      <h2
        className="mt-3"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(20px, 5vw, 22px)',
          lineHeight: 1.2,
        }}
      >
        Upload a photo of your room
      </h2>
      <p className="text-ink-mut mt-2" style={{ fontSize: '16px', lineHeight: 1.5 }}>
        A clear shot in good light works best. Your photo stays on this device — nothing is
        uploaded.
      </p>
      <p className="text-ink-fnt mt-1" style={{ fontSize: '14px', lineHeight: 1.4 }}>
        Tap to open camera or photo library.
      </p>
      <button
        type="button"
        className="mt-4 min-h-[44px] px-6 bg-accent text-white font-bold rounded-md"
        style={{ fontSize: '14px' }}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
      >
        Choose photo
      </button>
      {onSample && (
        <div className="mt-2">
          <button
            type="button"
            className="min-h-[44px] px-4 text-ink-mut font-bold underline underline-offset-4"
            style={{ fontSize: '14px' }}
            onClick={(e) => {
              e.stopPropagation();
              onSample();
            }}
          >
            Try with a sample room
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFile(file);
            // Reset so selecting the same file twice re-fires onChange.
            e.target.value = '';
          }
        }}
      />
    </section>
  );
}
