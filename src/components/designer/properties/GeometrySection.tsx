import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ControlDefinition } from '@/types/report';
import { useTranslations } from '@/i18n';

interface GeometrySectionProps {
  control: ControlDefinition;
  onUpdate: (patch: Partial<ControlDefinition>) => void;
}

export const GeometrySection: React.FC<GeometrySectionProps> = ({ control, onUpdate }) => {
  const tProps = useTranslations('propertyGrid');

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
        {tProps('geometry')}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('positionX')}</Label>
          <Input
            type="number"
            value={control.x}
            onChange={(e) => onUpdate({ x: Number(e.target.value) || 0 })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('positionY')}</Label>
          <Input
            type="number"
            value={control.y}
            onChange={(e) => onUpdate({ y: Number(e.target.value) || 0 })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('width')}</Label>
          <Input
            type="number"
            value={control.width}
            onChange={(e) => onUpdate({ width: Number(e.target.value) || 0 })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('height')}</Label>
          <Input
            type="number"
            value={control.height}
            onChange={(e) => onUpdate({ height: Number(e.target.value) || 0 })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
      </div>
    </div>
  );
};
