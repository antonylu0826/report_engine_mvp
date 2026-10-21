import React from 'react';
import { Input } from '@/components/ui/input';

interface ColorPickerFieldProps {
  value?: string;
  defaultValue?: string;
  onChange: (val: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  clearText?: string;
  className?: string;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  value,
  defaultValue = '#000000',
  onChange,
  placeholder,
  allowClear = false,
  clearText = '清除',
  className = '',
}) => {
  const displayColor = value || defaultValue;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <input
        type="color"
        value={displayColor.startsWith('#') && displayColor.length === 7 ? displayColor : defaultValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
      />
      <Input
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="text-[11px] font-mono h-7 flex-1 bg-white dark:bg-slate-950"
      />
      {allowClear && value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline px-1 shrink-0 cursor-pointer"
        >
          {clearText}
        </button>
      )}
    </div>
  );
};
