import type { Style } from '@react-pdf/types';
import type { ControlDefinition } from '@/types/report';

/**
 * Maps ControlStyle to react-pdf compatible styles
 */
export function mapControlStyle(control: ControlDefinition): Style {
  const s = control.style || {};
  return {
    position: 'absolute',
    left: control.x,
    top: control.y,
    width: control.width,
    height: control.height,
    fontFamily: 'AppChineseFont',
    fontSize: s.fontSize ?? 9,
    fontWeight: s.fontWeight ?? 'normal',
    color: s.color || '#1e293b',
    backgroundColor: s.backgroundColor || 'transparent',
    textAlign: s.textAlign || 'left',
    borderTopWidth: s.borderTopWidth ?? (s.borderWidth ?? 0),
    borderBottomWidth: s.borderBottomWidth ?? (s.borderWidth ?? 0),
    borderLeftWidth: s.borderLeftWidth ?? (s.borderWidth ?? 0),
    borderRightWidth: s.borderRightWidth ?? (s.borderWidth ?? 0),
    borderColor: s.borderColor || '#cbd5e1',
    borderStyle: s.borderStyle || 'solid',
    padding: s.padding ?? 0,
    paddingHorizontal: s.paddingHorizontal,
    paddingVertical: s.paddingVertical,
  };
}

/**
 * Maps ControlStyle to HTML CSSProperties for web designer
 */
export function mapDesignerControlStyle(control: ControlDefinition): React.CSSProperties {
  const s = control.style || {};
  return {
    left: `${control.x}pt`,
    top: `${control.y}pt`,
    width: `${control.width}pt`,
    height: `${control.height}pt`,
    fontSize: `${s.fontSize ?? 9}pt`,
    fontWeight: s.fontWeight ?? 'normal',
    color: s.color ?? '#0f172a',
    backgroundColor: s.backgroundColor ?? 'transparent',
    textAlign: s.textAlign ?? 'left',
    borderTopWidth: `${s.borderTopWidth ?? (s.borderWidth ?? 0)}pt`,
    borderBottomWidth: `${s.borderBottomWidth ?? (s.borderWidth ?? 0)}pt`,
    borderLeftWidth: `${s.borderLeftWidth ?? (s.borderWidth ?? 0)}pt`,
    borderRightWidth: `${s.borderRightWidth ?? (s.borderWidth ?? 0)}pt`,
    borderColor: s.borderColor ?? '#cbd5e1',
    borderStyle: s.borderStyle ?? 'solid',
    padding: s.padding ? `${s.padding}pt` : '0 2pt',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      s.textAlign === 'center'
        ? 'center'
        : s.textAlign === 'right'
        ? 'flex-end'
        : 'flex-start',
  };
}
