import React from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import { Trash2, SlidersHorizontal, Layers } from 'lucide-react';
import { controlRegistry } from '@/controls/registry';
import type { BandType, ControlDefinition } from '@/types/report';
import { getBandName, getControlName } from '@/constants/labels';
import { useTranslations, useCurrentLocale } from '@/i18n';
import { GlobalReportSettings } from './properties/GlobalReportSettings';
import { GeometrySection } from './properties/GeometrySection';
import { ControlSpecificInspector } from './properties/ControlSpecificInspector';
import { TypographySection } from './properties/TypographySection';
import { BandPropertiesSection } from './properties/BandPropertiesSection';

export const PropertyPanel: React.FC = () => {
  const { locale } = useCurrentLocale();
  const tProps = useTranslations('propertyGrid');

  const {
    getActiveData,
    selectedBandId,
    selectedControlId,
    updateControl,
    removeControl,
    updateBandHeight,
    updateActiveReport,
    updateBand,
    getActiveReport,
  } = useReportStore();

  const activeReport = getActiveReport();
  const selectedBand = activeReport.bands.find((b) => b.id === selectedBandId);
  const selectedControl = selectedBand?.controls.find((c) => c.id === selectedControlId);

  // Sample dataset fields for auto-suggest
  const sampleFields = Object.keys(getActiveData()[0] ?? {});

  // Update Band properties (e.g. groupBy, pageBreakAfter)
  const updateBandProp = (patch: Record<string, unknown>) => {
    if (!selectedBand) return;
    updateBand(selectedBand.id, patch);
  };

  // Remove Grouping Bands
  const removeGroupingStructure = () => {
    const updated = activeReport.bands.filter(
      (b) => b.type !== 'GroupHeader' && b.type !== 'GroupFooter'
    );
    updateActiveReport(active => ({ ...active, bands: updated }));
  };

  // Active Control Plugin & Metadata
  const controlPlugin = selectedControl ? controlRegistry.get(selectedControl.type) : null;
  const ControlIcon = controlPlugin?.icon || SlidersHorizontal;

  // Determine capabilities
  const isTextCapable = selectedControl
    ? ['Label', 'Field', 'Expression', 'CheckBox'].includes(selectedControl.type)
    : false;
  const isBackgroundCapable = selectedControl
    ? ['Label', 'Field', 'Expression', 'Panel'].includes(selectedControl.type)
    : false;

  // 1. GLOBAL REPORT SETTINGS VIEW (When nothing is selected)
  if (!selectedBand && !selectedControl) {
    return <GlobalReportSettings />;
  }

  // 2. CONTROL OR BAND INSPECTOR VIEW
  return (
    <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950 shadow-2xs overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider dark:text-slate-300">
            {tProps('title')}
          </span>
        </div>

        {selectedControl && selectedBand && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeControl(selectedBand.id, selectedControl.id)}
            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
            title={tProps('deleteControl')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Selected Object Tag with Dynamic Plugin Info */}
        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">{tProps('currentSelected')}</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 mt-0.5">
            {selectedControl ? (
              <>
                <ControlIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>{getControlName(selectedControl.type, locale)}</span>
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>{getBandName(selectedBand?.type as BandType, locale)}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
            ID: {selectedControl?.id || selectedBand?.id}
          </div>
        </div>

        {/* Control Specific Properties */}
        {selectedControl && selectedBand && (
          <>
            {/* Geometry (Position & Size) */}
            <GeometrySection
              control={selectedControl}
              onUpdate={(patch: Partial<ControlDefinition>) =>
                updateControl(selectedBand.id, selectedControl.id, patch)
              }
            />

            {/* Data & Content Binding */}
            <ControlSpecificInspector
              control={selectedControl}
              bandId={selectedBand.id}
              sampleFields={sampleFields}
              onUpdate={(patch: Partial<ControlDefinition>) =>
                updateControl(selectedBand.id, selectedControl.id, patch)
              }
            />

            {/* Typography & Styling */}
            {isTextCapable && (
              <TypographySection
                control={selectedControl}
                isBackgroundCapable={isBackgroundCapable}
                onUpdate={(patch: Partial<ControlDefinition>) =>
                  updateControl(selectedBand.id, selectedControl.id, patch)
                }
              />
            )}
          </>
        )}

        {/* Band Specific Properties */}
        {!selectedControl && selectedBand && (
          <BandPropertiesSection
            band={selectedBand}
            sampleFields={sampleFields}
            onUpdateHeight={(height) => updateBandHeight(selectedBand.id, height)}
            onUpdateProp={updateBandProp}
            onRemoveGroup={removeGroupingStructure}
          />
        )}
      </div>
    </aside>
  );
};
