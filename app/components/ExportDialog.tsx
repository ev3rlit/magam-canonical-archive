import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Download } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useExportImage, type ExportOptions } from '@/hooks/useExportImage';
import { useGraphStore } from '@/store/graph';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultArea: 'selection' | 'full';
  selectedNodeIds?: string[];
}

interface SelectFieldOption {
  value: string;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Array<SelectFieldOption & { value: T }>;
  onChange: (value: T) => void;
}

function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-foreground/62">{label}</span>
      <Select
        className="h-10 rounded-lg px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

interface FormatSelectorProps {
  value: ExportOptions['format'];
  onChange: (format: ExportOptions['format']) => void;
}

function FormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground/62">파일 유형</p>
      <div className="grid grid-cols-4 gap-2">
        {(['png', 'jpg', 'svg', 'pdf'] as const).map((format) => (
          <button
            type="button"
            key={format}
            onClick={() => onChange(format)}
            className={cn(
              'h-10 rounded-lg border text-sm font-medium',
              value === format
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border/16 bg-card text-foreground/62',
            )}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExportDialog({
  isOpen,
  onClose,
  defaultArea,
  selectedNodeIds: selectedNodeIdsFromContext = [],
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('png');
  const [background, setBackground] = useState<ExportOptions['background']>('grid');
  const [area, setArea] = useState<ExportOptions['area']>(defaultArea);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentSelectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const effectiveSelectionNodeIds = selectedNodeIdsFromContext.length > 0
    ? selectedNodeIdsFromContext
    : currentSelectedNodeIds;
  const { downloadImage, copyImageToClipboard, isExporting } = useExportImage();

  const canCopy =
    typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.clipboard !== 'undefined'
    && typeof navigator.clipboard.write === 'function'
    && typeof (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem !== 'undefined';

  useEffect(() => {
    if (isOpen) {
      setArea(defaultArea);
      setErrorMessage(null);
    }
  }, [isOpen, defaultArea]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setErrorMessage(null);
    const exportNodeIds = area === 'selection' && effectiveSelectionNodeIds.length > 0
      ? effectiveSelectionNodeIds
      : undefined;

    try {
      await downloadImage({ format, background, area }, undefined, exportNodeIds);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleCopy = async () => {
    setErrorMessage(null);

    try {
      if (area === 'selection' && effectiveSelectionNodeIds.length > 0) {
        await copyImageToClipboard(effectiveSelectionNodeIds, {
          background,
          area,
        });
      } else {
        await copyImageToClipboard(undefined, {
          background,
          area,
        });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '클립보드 복사 중 오류가 발생했습니다.');
    }
  };

  const previewText =
    area === 'selection' ? '선택 항목' : '전체 캔버스';

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgb(var(--overlay-scrim)/0.5)] backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'relative w-[440px] max-w-[calc(100vw-2rem)] bg-card/92',
          'rounded-2xl shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
          <h2 className="text-lg font-semibold text-foreground">Export Image</h2>
          <Button onClick={onClose} className="rounded-md" size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex h-40 w-full items-center justify-center rounded-lg bg-muted text-center shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]">
            <span className="text-sm text-foreground/46">미리보기: {previewText} ({format.toUpperCase()}/{background})</span>
          </div>

          <FormatSelector value={format} onChange={setFormat} />

          <SelectField
            label="배경"
            value={background}
            onChange={setBackground}
            options={[
              { value: 'grid', label: '그리드' },
              { value: 'transparent', label: '투명' },
              { value: 'solid', label: '단색 (흰색)' },
            ]}
          />

          <SelectField
            label="내보내기 영역"
            value={area}
            onChange={setArea}
            options={[
              { value: 'selection', label: '선택 항목만' },
              { value: 'full', label: '전체 영역' },
            ]}
          />
        </div>

        {errorMessage && (
          <div className="bg-danger/12 px-6 py-3 text-sm text-danger shadow-[inset_0_1px_0_rgb(var(--color-danger)/0.16)]">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3 px-6 py-4 shadow-[inset_0_1px_0_rgb(var(--color-border)/0.08)]">
          <Button
            onClick={handleCopy}
            disabled={isExporting || !canCopy}
            title={canCopy ? 'PNG로 복사' : '클립보드 복사를 지원하지 않는 브라우저입니다.'}
            className="flex-1 justify-center rounded-lg"
            variant="secondary"
          >
            <Copy className="w-4 h-4" />
            클립보드 복사
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 justify-center rounded-lg"
            variant="primary"
          >
            <Download className="w-4 h-4" />
            다운로드
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
