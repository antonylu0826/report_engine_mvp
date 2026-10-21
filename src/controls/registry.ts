import type { ControlType } from '@/types/report';
import type { ReportControlPlugin } from './types';
import { LabelControl } from './plugins/LabelControl';
import { FieldControl } from './plugins/FieldControl';
import { ExpressionControl } from './plugins/ExpressionControl';
import { LineControl } from './plugins/LineControl';
import { BarcodeControl } from './plugins/BarcodeControl';
import { QRCodeControl } from './plugins/QRCodeControl';
import { ImageControl } from './plugins/ImageControl';
import { CheckBoxControl } from './plugins/CheckBoxControl';
import { PanelControl } from './plugins/PanelControl';
import { SubReportControl } from './plugins/SubReportControl';

class ControlRegistry {
  private plugins = new Map<ControlType, ReportControlPlugin>();

  constructor() {
    this.register(LabelControl);
    this.register(FieldControl);
    this.register(ExpressionControl);
    this.register(LineControl);
    this.register(BarcodeControl);
    this.register(QRCodeControl);
    this.register(ImageControl);
    this.register(CheckBoxControl);
    this.register(PanelControl);
    this.register(SubReportControl);
  }

  public register(plugin: ReportControlPlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  public get(type: ControlType): ReportControlPlugin | undefined {
    return this.plugins.get(type);
  }

  public getAll(): ReportControlPlugin[] {
    return Array.from(this.plugins.values());
  }

  public getCategories(): { id: string; name: string; controls: ReportControlPlugin[] }[] {
    const categories: Record<string, { id: string; name: string; controls: ReportControlPlugin[] }> = {
      basic: { id: 'basic', name: '基本文字與標籤', controls: [] },
      data: { id: 'data', name: '動態資料與運算', controls: [] },
      code: { id: 'code', name: '條碼與二維碼', controls: [] },
      shape: { id: 'shape', name: '圖形與版面裝飾', controls: [] },
    };

    for (const plugin of this.plugins.values()) {
      if (categories[plugin.category]) {
        categories[plugin.category].controls.push(plugin);
      } else {
        categories[plugin.category] = {
          id: plugin.category,
          name: plugin.categoryName,
          controls: [plugin],
        };
      }
    }

    return Object.values(categories);
  }
}

export const controlRegistry = new ControlRegistry();
