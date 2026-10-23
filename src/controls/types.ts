import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ControlDefinition, ControlType } from '@/types/report';
import type { EvalContext } from '@/compiler/evaluator';

export type ControlCategory = 'basic' | 'data' | 'code' | 'shape';

export interface ReportControlPlugin {
  type: ControlType;
  displayName: string;
  category: ControlCategory;
  categoryName: string;
  description: string;
  icon: LucideIcon;
  defaultWidth: number;
  defaultHeight: number;
  createDefault: (overrides?: Partial<ControlDefinition>) => Partial<ControlDefinition>;
  DesignerComponent: React.ComponentType<{
    control: ControlDefinition;
    isSelected: boolean;
  }>;
  renderInspector?: (props: {
    control: ControlDefinition;
    updateControl: (patch: Partial<ControlDefinition>) => void;
    sampleFields: string[];
  }) => React.ReactNode;
}

export type PdfControlRenderer = (props: {
  control: ControlDefinition;
  context: EvalContext;
}) => React.ReactNode;
