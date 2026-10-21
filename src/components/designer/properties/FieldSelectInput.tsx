import React from 'react';
import { Input } from '@/components/ui/input';

interface FieldSelectInputProps {
  value: string;
  onChange: (val: string) => void;
  sampleFields: string[];
  placeholder?: string;
  selectPlaceholder?: string;
  title?: string;
  className?: string;
}

export const FieldSelectInput: React.FC<FieldSelectInputProps> = ({
  value,
  onChange,
  sampleFields,
  placeholder,
  selectPlaceholder = '選擇欄位▾',
  title = '快速套用欄位',
  className = '',
}) => {
  return (
    <div className={`flex space-x-1 ${className}`}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 font-mono text-xs bg-white dark:bg-slate-950"
      />
      {sampleFields.length > 0 && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          title={title}
        >
          <option value="">{selectPlaceholder}</option>
          {sampleFields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
