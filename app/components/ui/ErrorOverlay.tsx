import { useGraphStore } from '@/store/graph';
import { AlertCircle, X, ChevronDown, ChevronRight, FileCode } from 'lucide-react';
import { useState } from 'react';

export function ErrorOverlay() {
  const { error, setError } = useGraphStore();
  const [isStackOpen, setIsStackOpen] = useState(false);

  if (!error) return null;

  const handleDismiss = () => {
    setError(null);
  };

  const hasLocation = error.location && (error.location.file || error.location.line);
  const locationString = error.location
    ? `${error.location.file ? error.location.file.split('/').pop() : 'Unknown file'}:${error.location.line || '?'}:${error.location.column || '?'}`
    : '';

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-lg bg-danger/10 shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.18)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 shadow-[inset_0_-1px_0_rgb(var(--color-danger)/0.16)]">
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-semibold text-lg">
              {error.type || 'Error'}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1 text-danger transition-colors hover:bg-danger/12"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Main Message */}
          <div className="font-mono text-sm whitespace-pre-wrap break-words text-danger">
            {error.message}
          </div>

          {/* Location Info */}
          {hasLocation && (
            <div className="flex items-center gap-2 rounded bg-card p-2 text-sm font-mono text-foreground/62 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]">
              <FileCode className="w-4 h-4 text-foreground/38" />
              <span className="font-semibold text-foreground">{locationString}</span>
              {error.location?.lineText && (
                <span className="ml-2 border-l border-border/20 pl-2 italic text-foreground/48">
                  "{error.location.lineText.trim()}"
                </span>
              )}
            </div>
          )}

          {/* Stack Trace / Details Toggle */}
          {error.details && (
            <div className="mt-2">
              <button
                onClick={() => setIsStackOpen(!isStackOpen)}
                className="flex items-center gap-1 text-xs font-semibold text-danger transition-colors hover:text-danger/80"
              >
                {isStackOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {isStackOpen ? 'Hide Details' : 'Show Details'}
              </button>

              {isStackOpen && (
                <div className="custom-scrollbar mt-2 max-h-48 overflow-auto whitespace-pre rounded bg-card p-3 text-xs font-mono text-foreground shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]">
                  {typeof error.details === 'string'
                    ? error.details
                    : JSON.stringify(error.details, null, 2)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
