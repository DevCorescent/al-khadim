'use client';
import { useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Brush, Code2, Eye, EyeOff, Lock, MousePointer2, Settings2, Sparkles, Type, Unlock,
} from 'lucide-react';
import { ANIMATIONS, ELEMENT_BY_TYPE, LAYOUTS } from '@/lib/pageBuilder/elements';
import { SHADOWS } from '@/lib/pageBuilder/css';
import { applyLayout, levelOf } from '@/lib/pageBuilder/doc';
import type { Device, HoverProps, PBNode, StyleKey, StyleProps } from '@/lib/pageBuilder/types';
import {
  ColorIn, DEVICE_ICON, FontIn, Grid2, Group, Row, Segmented, SelectIn, SidesIn, TextIn, Toggle, UnitIn, inputCls,
} from './controls';
import { FieldControl, FieldsForm } from './PBFields';

type Tab = 'content' | 'style' | 'advanced';

const SHADOW_OPTS: [string, string][] = [['', 'Inherit'], ...Object.keys(SHADOWS).map(k => [k, k === 'none' ? 'None' : k.toUpperCase()] as [string, string]), ['custom', 'Custom…']];

export interface InspectorProps {
  node: PBNode;
  device: Device;
  setDevice: (d: Device) => void;
  /** `key` lets rapid edits of the same control merge into one undo step. */
  onChange: (next: PBNode, key?: string) => void;
}

export default function Inspector({ node, device, setDevice, onChange }: InspectorProps) {
  const [tab, setTab] = useState<Tab>('content');
  const def = ELEMENT_BY_TYPE[node.type];
  const level = levelOf(node);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: level === 'element' ? 'Content' : 'Layout', icon: <Type size={13} /> },
    { id: 'style', label: 'Style', icon: <Brush size={13} /> },
    { id: 'advanced', label: 'Advanced', icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">{level}</p>
        <p className="text-[14px] font-bold text-gray-900 truncate">{node.adv?.label || def?.label || node.type}</p>
        <div className="mt-2.5 flex p-0.5 rounded-lg bg-gray-100">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-[11.5px] font-semibold transition ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain" key={`${node.id}-${tab}`}>
        {tab === 'content' && (
          <div className="p-4 space-y-4">
            {node.type === 'section' && <LayoutPicker node={node} onChange={onChange} />}
            {def && <FieldsForm fields={def.fields} value={node.props} onChange={props => onChange({ ...node, props }, `props:${node.id}`)} />}
          </div>
        )}
        {tab === 'style' && <StylePanel node={node} device={device} setDevice={setDevice} onChange={onChange} />}
        {tab === 'advanced' && <AdvancedPanel node={node} onChange={onChange} />}
      </div>
    </div>
  );
}

function LayoutPicker({ node, onChange }: { node: PBNode; onChange: InspectorProps['onChange'] }) {
  const current = (node.children || []).map(c => parseFloat(c.style?.desktop?.width || '0'));
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-600 mb-1.5">Column structure</p>
      <div className="grid grid-cols-4 gap-1.5">
        {LAYOUTS.map((l, i) => {
          const active = l.length === current.length && l.every((w, k) => Math.abs(w - current[k]) < 1);
          return (
            <button key={i} type="button" onClick={() => onChange(applyLayout(node, l))} title={l.map(w => `${Math.round(w)}%`).join(' / ')}
              className={`flex gap-[3px] h-8 p-1 rounded-md border transition ${active ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:border-gray-400'}`}>
              {l.map((w, k) => <span key={k} className={`rounded-[2px] ${active ? 'bg-teal-600' : 'bg-gray-300'}`} style={{ width: `${w}%` }} />)}
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] text-gray-400 mt-1.5">Elements in removed columns move into the last remaining one. Drag a column edge on the canvas to fine-tune widths.</p>
    </div>
  );
}

/* ─── Style ─────────────────────────────────────────────────────────────── */

function StylePanel({ node, device, setDevice, onChange }: InspectorProps) {
  const level = levelOf(node);
  const cur: StyleProps = node.style?.[device] || {};
  const inherited: StyleProps = device === 'desktop' ? {} : device === 'tablet' ? (node.style?.desktop || {}) : { ...(node.style?.desktop || {}), ...(node.style?.tablet || {}) };
  const get = (k: StyleKey) => cur[k];
  const ph = (k: StyleKey, fallback = '') => inherited[k] || fallback;
  const set = (patch: StyleProps) => {
    const next: StyleProps = { ...cur };
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v == null) delete (next as any)[k]; else (next as any)[k] = String(v);
    }
    const style = { ...(node.style || {}), [device]: next };
    if (!Object.keys(next).length) delete style[device];
    onChange({ ...node, style }, `style:${node.id}:${device}:${Object.keys(patch).join(',')}`);
  };
  const isSet = (...keys: StyleKey[]) => keys.some(k => cur[k] !== undefined);
  const reset = (...keys: StyleKey[]) => () => set(Object.fromEntries(keys.map(k => [k, ''])) as StyleProps);
  // Row props for a style control: device badge, "is set" highlight and reset button.
  const rp = (k: StyleKey | StyleKey[]) => {
    const keys = Array.isArray(k) ? k : [k];
    return { device, set: isSet(...keys), onReset: reset(...keys) };
  };

  const hover = node.hover || {};
  const setHover = (patch: HoverProps) => {
    const next: HoverProps = { ...hover };
    for (const [k, v] of Object.entries(patch)) { if (v === '' || v == null) delete (next as any)[k]; else (next as any)[k] = String(v); }
    onChange({ ...node, hover: Object.keys(next).length ? next : undefined }, `hover:${node.id}:${Object.keys(patch).join(',')}`);
  };

  const bgType = get('bgType') || ph('bgType') || '';
  const DI = DEVICE_ICON[device];
  const deviceCount = (['tablet', 'mobile'] as Device[]).filter(d => node.style?.[d] && Object.keys(node.style[d]!).length).length;

  return (
    <div>
      <div className="px-4 py-2.5 bg-gradient-to-r from-teal-50 to-white border-b border-teal-100/70">
        <div className="flex items-center gap-2">
          <DI size={14} className="text-teal-700" />
          <p className="text-[11.5px] text-teal-900 font-semibold flex-1">Editing <span className="capitalize">{device}</span> styles</p>
        </div>
        <div className="mt-2">
          <Segmented size="sm" value={device} onChange={setDevice} options={(['desktop', 'tablet', 'mobile'] as Device[]).map(d => {
            const I = DEVICE_ICON[d];
            const has = d !== 'desktop' && node.style?.[d] && Object.keys(node.style[d]!).length;
            return { value: d, icon: <I size={12} />, label: has ? '•' : undefined, title: d };
          })} />
        </div>
        <p className="text-[10.5px] text-teal-800/70 mt-1.5 leading-snug">
          {device === 'desktop' ? 'Desktop values apply everywhere unless a tablet or mobile value overrides them.' : `Only what you set here changes on ${device}; empty fields inherit (shown greyed).`}
          {deviceCount > 0 && device === 'desktop' ? ` ${deviceCount} device override${deviceCount > 1 ? 's' : ''} exist.` : ''}
        </p>
      </div>

      <Group title="Spacing">
        <Row label="Margin" {...rp(['mt', 'mr', 'mb', 'ml'])}>
          <SidesIn label="Margin" value={{ t: get('mt'), r: get('mr'), b: get('mb'), l: get('ml') }} placeholders={{ t: ph('mt'), r: ph('mr'), b: ph('mb'), l: ph('ml') }}
            onChange={v => set({ mt: v.t, mr: v.r, mb: v.b, ml: v.l })} />
        </Row>
        <Row label="Padding" {...rp(['pt', 'pr', 'pb', 'pl'])}>
          <SidesIn label="Padding" value={{ t: get('pt'), r: get('pr'), b: get('pb'), l: get('pl') }} placeholders={{ t: ph('pt'), r: ph('pr'), b: ph('pb'), l: ph('pl') }}
            onChange={v => set({ pt: v.t, pr: v.r, pb: v.b, pl: v.l })} />
        </Row>
        <p className="text-[10.5px] text-gray-400">Numbers are pixels; you can also type 2rem, 5%, auto (centre with left/right auto).</p>
      </Group>

      <Group title="Size & layout">
        <Grid2>
          <Row label={level === 'column' ? 'Column width' : 'Width'} {...rp('width')}><UnitIn value={get('width')} placeholder={ph('width', level === 'column' ? 'auto' : '')} onChange={v => set({ width: v })} /></Row>
          <Row label="Max width" {...rp('maxWidth')}><UnitIn value={get('maxWidth')} placeholder={ph('maxWidth')} onChange={v => set({ maxWidth: v })} /></Row>
          <Row label="Min height" {...rp('minHeight')}><UnitIn value={get('minHeight')} placeholder={ph('minHeight')} onChange={v => set({ minHeight: v })} /></Row>
          <Row label="Height" {...rp('height')}><UnitIn value={get('height')} placeholder={ph('height')} onChange={v => set({ height: v })} /></Row>
          {level !== 'element' && <Row label={level === 'section' ? 'Column gap' : 'Element gap'} {...rp('gap')}><UnitIn value={get('gap')} placeholder={ph('gap', level === 'section' ? '32' : '20')} units={['px', 'rem', '%']} onChange={v => set({ gap: v })} /></Row>}
          {level === 'element' && <Row label="Align self" {...rp('alignSelf')}><SelectIn value={get('alignSelf')} placeholder="Default" onChange={v => set({ alignSelf: v })} options={[['flex-start', 'Start'], ['center', 'Centre'], ['flex-end', 'End'], ['stretch', 'Stretch']]} /></Row>}
          <Row label="Overflow" {...rp('overflow')}><SelectIn value={get('overflow')} placeholder="Visible" onChange={v => set({ overflow: v })} options={[['hidden', 'Hidden'], ['auto', 'Scroll'], ['visible', 'Visible']]} /></Row>
        </Grid2>
        {level === 'section' && <p className="text-[10.5px] text-gray-400">Tip: min height 100vh makes a full-screen section.</p>}
      </Group>

      <Group title="Typography" defaultOpen={level === 'element'}>
        <Row label="Font family" {...rp('fontFamily')}><FontIn value={get('fontFamily')} onChange={v => set({ fontFamily: v })} /></Row>
        <Grid2>
          <Row label="Size" {...rp('fontSize')}><UnitIn value={get('fontSize')} placeholder={ph('fontSize')} units={['px', 'rem', 'em', 'vw']} onChange={v => set({ fontSize: v })} /></Row>
          <Row label="Weight" {...rp('fontWeight')}><SelectIn value={get('fontWeight')} placeholder={ph('fontWeight') || 'Default'} onChange={v => set({ fontWeight: v })} options={[['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']]} /></Row>
          <Row label="Line height" {...rp('lineHeight')}><UnitIn value={get('lineHeight')} placeholder={ph('lineHeight')} units={['', 'px', 'em']} onChange={v => set({ lineHeight: v })} /></Row>
          <Row label="Letter spacing" {...rp('letterSpacing')}><UnitIn value={get('letterSpacing')} placeholder={ph('letterSpacing')} units={['px', 'em']} onChange={v => set({ letterSpacing: v })} /></Row>
        </Grid2>
        <Row label="Text align" {...rp('textAlign')}>
          <Segmented value={get('textAlign') || ph('textAlign') || ''} onChange={v => set({ textAlign: v === get('textAlign') ? '' : v })} options={[
            { value: 'left', icon: <AlignLeft size={13} /> }, { value: 'center', icon: <AlignCenter size={13} /> },
            { value: 'right', icon: <AlignRight size={13} /> }, { value: 'justify', icon: <AlignJustify size={13} /> },
          ]} />
        </Row>
        <Row label="Text colour" {...rp('color')}><ColorIn value={get('color')} placeholder={ph('color') || 'Inherit'} onChange={v => set({ color: v })} /></Row>
        <Grid2>
          <Row label="Transform" {...rp('textTransform')}><SelectIn value={get('textTransform')} placeholder="None" onChange={v => set({ textTransform: v })} options={[['uppercase', 'UPPERCASE'], ['capitalize', 'Capitalise'], ['lowercase', 'lowercase'], ['none', 'None']]} /></Row>
          <Row label="Style" {...rp('fontStyle')}><SelectIn value={get('fontStyle')} placeholder="Normal" onChange={v => set({ fontStyle: v })} options={[['italic', 'Italic'], ['normal', 'Normal']]} /></Row>
          <Row label="Decoration" {...rp('textDecoration')}><SelectIn value={get('textDecoration')} placeholder="None" onChange={v => set({ textDecoration: v })} options={[['underline', 'Underline'], ['line-through', 'Strike'], ['none', 'None']]} /></Row>
          <Row label="Text shadow" {...rp('textShadow')}><SelectIn value={get('textShadow')} placeholder="None" onChange={v => set({ textShadow: v })} options={[['0 1px 2px rgba(0,0,0,.25)', 'Subtle'], ['0 4px 16px rgba(0,0,0,.45)', 'Strong'], ['0 0 24px rgba(198,161,91,.6)', 'Gold glow'], ['none', 'None']]} /></Row>
        </Grid2>
      </Group>

      <Group title="Background" defaultOpen={level === 'section'}>
        <Row label="Type" {...rp(['bgType'])}>
          <Segmented size="sm" value={bgType} onChange={v => set({ bgType: v })} options={[
            { value: '', label: 'None' }, { value: 'color', label: 'Colour' }, { value: 'gradient', label: 'Gradient' }, { value: 'image', label: 'Image' },
          ]} />
        </Row>
        {bgType === 'color' && <Row label="Colour" {...rp('bgColor')}><ColorIn value={get('bgColor')} placeholder={ph('bgColor')} onChange={v => set({ bgColor: v })} /></Row>}
        {bgType === 'gradient' && <>
          <Grid2>
            <Row label="From" {...rp('gradFrom')}><ColorIn value={get('gradFrom')} placeholder={ph('gradFrom') || 'primary'} onChange={v => set({ gradFrom: v })} /></Row>
            <Row label="To" {...rp('gradTo')}><ColorIn value={get('gradTo')} placeholder={ph('gradTo') || 'ink'} onChange={v => set({ gradTo: v })} /></Row>
          </Grid2>
          <Row label="Middle stop (optional)" {...rp('gradMid')}><ColorIn value={get('gradMid')} placeholder={ph('gradMid') || 'None'} onChange={v => set({ gradMid: v })} /></Row>
          <Grid2>
            <Row label="Kind" {...rp('gradKind')}><SelectIn value={get('gradKind')} placeholder="Linear" onChange={v => set({ gradKind: v })} options={[['linear', 'Linear'], ['radial', 'Radial']]} /></Row>
            <Row label="Angle (°)" {...rp('gradAngle')}><TextIn type="number" value={get('gradAngle')} placeholder={ph('gradAngle', '135')} onChange={v => set({ gradAngle: v })} /></Row>
          </Grid2>
        </>}
        {bgType === 'image' && <>
          <Row label="Image" {...rp('bgImage')}><ImageField value={get('bgImage') || ''} placeholder={ph('bgImage')} onChange={v => set({ bgImage: v })} /></Row>
          <Grid2>
            <Row label="Size" {...rp('bgSize')}><SelectIn value={get('bgSize')} placeholder="Cover" onChange={v => set({ bgSize: v })} options={[['cover', 'Cover'], ['contain', 'Contain'], ['auto', 'Original'], ['100% auto', 'Full width']]} /></Row>
            <Row label="Position" {...rp('bgPos')}><SelectIn value={get('bgPos')} placeholder="Centre" onChange={v => set({ bgPos: v })} options={[['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['top left', 'Top left'], ['top right', 'Top right'], ['bottom left', 'Bottom left'], ['bottom right', 'Bottom right']]} /></Row>
            <Row label="Repeat" {...rp('bgRepeat')}><SelectIn value={get('bgRepeat')} placeholder="No repeat" onChange={v => set({ bgRepeat: v })} options={[['no-repeat', 'No repeat'], ['repeat', 'Tile'], ['repeat-x', 'Horizontal'], ['repeat-y', 'Vertical']]} /></Row>
            <Row label="Attachment" {...rp('bgAttach')}><SelectIn value={get('bgAttach')} placeholder="Scroll" onChange={v => set({ bgAttach: v })} options={[['scroll', 'Scroll'], ['fixed', 'Fixed (parallax)']]} /></Row>
          </Grid2>
          <Row label="Fallback colour" {...rp('bgColor')}><ColorIn value={get('bgColor')} placeholder={ph('bgColor')} onChange={v => set({ bgColor: v })} /></Row>
        </>}
        {level === 'section' && <>
          <Row label="Overlay" {...rp(['overlay'])}>
            <Segmented size="sm" value={get('overlay') || ph('overlay') || 'none'} onChange={v => set({ overlay: v === 'none' ? '' : v })} options={[{ value: 'none', label: 'None' }, { value: 'color', label: 'Colour' }, { value: 'gradient', label: 'Gradient' }]} />
          </Row>
          {(get('overlay') || ph('overlay')) && (get('overlay') || ph('overlay')) !== 'none' && <>
            <Grid2>
              <Row label={(get('overlay') || ph('overlay')) === 'gradient' ? 'From' : 'Colour'} {...rp('overlayFrom')}><ColorIn value={get('overlayFrom')} placeholder={ph('overlayFrom') || 'ink'} onChange={v => set({ overlayFrom: v })} /></Row>
              {(get('overlay') || ph('overlay')) === 'gradient' && <Row label="To" {...rp('overlayTo')}><ColorIn value={get('overlayTo')} placeholder={ph('overlayTo') || 'primary'} onChange={v => set({ overlayTo: v })} /></Row>}
            </Grid2>
            <Grid2>
              <Row label="Opacity (0–1)" {...rp('overlayOpacity')}><TextIn value={get('overlayOpacity')} placeholder={ph('overlayOpacity', '0.6')} onChange={v => set({ overlayOpacity: v })} /></Row>
              {(get('overlay') || ph('overlay')) === 'gradient' && <Row label="Angle (°)" {...rp('overlayAngle')}><TextIn type="number" value={get('overlayAngle')} placeholder={ph('overlayAngle', '135')} onChange={v => set({ overlayAngle: v })} /></Row>}
            </Grid2>
          </>}
        </>}
      </Group>

      <Group title="Border & corners" defaultOpen={false}>
        <Grid2>
          <Row label="Style" {...rp('borderStyle')}><SelectIn value={get('borderStyle')} placeholder={ph('borderStyle') || 'None'} onChange={v => set({ borderStyle: v })} options={[['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double'], ['none', 'None']]} /></Row>
          <Row label="Width" {...rp('borderWidth')}><UnitIn value={get('borderWidth')} placeholder={ph('borderWidth', '1')} units={['px']} onChange={v => set({ borderWidth: v })} /></Row>
        </Grid2>
        <Row label="Colour" {...rp('borderColor')}><ColorIn value={get('borderColor')} placeholder={ph('borderColor') || 'Subtle line'} onChange={v => set({ borderColor: v })} /></Row>
        <Row label="Sides" {...rp('borderSides')}><SelectIn value={get('borderSides')} placeholder="All sides" onChange={v => set({ borderSides: v })} options={[['all', 'All sides'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['top,bottom', 'Top & bottom'], ['left,right', 'Left & right']]} /></Row>
        <Row label="Corner radius" {...rp('radius')} hint="One value, or four (top-left top-right bottom-right bottom-left), e.g. 24 24 0 0">
          <TextIn value={get('radius')} placeholder={ph('radius', '0')} onChange={v => set({ radius: v })} />
        </Row>
        <div className="flex gap-1">
          {['0', '8', '16', '24', '40', '9999'].map(r => <button key={r} type="button" onClick={() => set({ radius: r })} className="flex-1 h-6 rounded border border-gray-200 text-[10.5px] text-gray-600 hover:border-teal-600">{r === '9999' ? 'Pill' : r}</button>)}
        </div>
      </Group>

      <Group title="Effects" defaultOpen={false}>
        <Row label="Shadow" {...rp(['shadow', 'shadowCustom'])}><SelectIn value={get('shadow')} onChange={v => set({ shadow: v })} options={SHADOW_OPTS.slice(1)} placeholder={ph('shadow') || 'None'} /></Row>
        {(get('shadow') || ph('shadow')) === 'custom' && <Row label="Custom shadow" {...rp('shadowCustom')}><TextIn mono value={get('shadowCustom')} placeholder="0 10px 30px rgba(0,0,0,.2)" onChange={v => set({ shadowCustom: v })} /></Row>}
        <Grid2>
          <Row label="Opacity" {...rp('opacity')}><TextIn value={get('opacity')} placeholder={ph('opacity', '1')} onChange={v => set({ opacity: v })} /></Row>
          <Row label="Rotate (°)" {...rp('rotate')}><TextIn type="number" value={get('rotate')} placeholder={ph('rotate', '0')} onChange={v => set({ rotate: v })} /></Row>
          <Row label="Scale" {...rp('scale')}><TextIn value={get('scale')} placeholder={ph('scale', '1')} onChange={v => set({ scale: v })} /></Row>
          <Row label="Blur" {...rp('blur')}><UnitIn value={get('blur')} placeholder={ph('blur')} units={['px']} onChange={v => set({ blur: v })} /></Row>
          <Row label="Move X" {...rp('translateX')}><UnitIn value={get('translateX')} placeholder={ph('translateX')} onChange={v => set({ translateX: v })} /></Row>
          <Row label="Move Y" {...rp('translateY')}><UnitIn value={get('translateY')} placeholder={ph('translateY')} onChange={v => set({ translateY: v })} /></Row>
          <Row label="Glass blur" {...rp('backdropBlur')}><UnitIn value={get('backdropBlur')} placeholder={ph('backdropBlur')} units={['px']} onChange={v => set({ backdropBlur: v })} /></Row>
          <Row label="Blend mode" {...rp('mixBlend')}><SelectIn value={get('mixBlend')} placeholder="Normal" onChange={v => set({ mixBlend: v })} options={[['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['luminosity', 'Luminosity'], ['difference', 'Difference']]} /></Row>
        </Grid2>
        <Row label="Filter" {...rp('filter')}><SelectIn value={get('filter')} placeholder="None" onChange={v => set({ filter: v })} options={[['grayscale(1)', 'Greyscale'], ['sepia(.6)', 'Sepia'], ['saturate(1.6)', 'Vivid'], ['brightness(.85)', 'Darker'], ['brightness(1.15)', 'Brighter'], ['contrast(1.2)', 'Contrast']]} /></Row>
        <Grid2>
          <Row label="Position" {...rp(['position', 'top'])}><SelectIn value={get('position')} placeholder="Default" onChange={v => set({ position: v })} options={[['relative', 'Relative'], ['sticky', 'Sticky']]} /></Row>
          {(get('position') || ph('position')) && <Row label={(get('position') || ph('position')) === 'sticky' ? 'Stick at top' : 'Offset top'} {...rp('top')}><UnitIn value={get('top')} placeholder={ph('top', '0')} onChange={v => set({ top: v })} /></Row>}
          <Row label="Layer (z-index)" {...rp('zIndex')}><TextIn type="number" value={get('zIndex')} placeholder={ph('zIndex')} onChange={v => set({ zIndex: v })} /></Row>
          <Row label="Cursor" {...rp('cursor')}><SelectIn value={get('cursor')} placeholder="Default" onChange={v => set({ cursor: v })} options={[['pointer', 'Pointer'], ['zoom-in', 'Zoom'], ['help', 'Help']]} /></Row>
        </Grid2>
      </Group>

      <Group title="Hover" defaultOpen={false} badge={Object.keys(hover).length ? <span className="text-[10px] font-bold text-teal-700 bg-teal-50 rounded px-1.5">{Object.keys(hover).length}</span> : null}>
        <p className="text-[10.5px] text-gray-400 -mt-1">Applied when the pointer is over this {level} (all devices).</p>
        <Grid2>
          <Row label="Text colour"><ColorIn value={hover.color} placeholder="—" onChange={v => setHover({ color: v })} /></Row>
          <Row label="Background"><ColorIn value={hover.bgColor} placeholder="—" onChange={v => setHover({ bgColor: v })} /></Row>
          <Row label="Border colour"><ColorIn value={hover.borderColor} placeholder="—" onChange={v => setHover({ borderColor: v })} /></Row>
          <Row label="Shadow"><SelectIn value={hover.shadow} placeholder="—" onChange={v => setHover({ shadow: v })} options={SHADOW_OPTS.slice(1).filter(([k]) => k !== 'custom')} /></Row>
          <Row label="Lift (Y)"><UnitIn value={hover.translateY} placeholder="e.g. -6" onChange={v => setHover({ translateY: v })} /></Row>
          <Row label="Scale"><TextIn value={hover.scale} placeholder="e.g. 1.03" onChange={v => setHover({ scale: v })} /></Row>
          <Row label="Opacity"><TextIn value={hover.opacity} placeholder="—" onChange={v => setHover({ opacity: v })} /></Row>
          <Row label="Rotate (°)"><TextIn value={hover.rotate} placeholder="—" onChange={v => setHover({ rotate: v })} /></Row>
        </Grid2>
        <Row label="Transition (ms)" {...rp('transition')}><TextIn type="number" value={get('transition')} placeholder={ph('transition', '300')} onChange={v => set({ transition: v })} /></Row>
      </Group>
    </div>
  );
}

function ImageField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldControl f={{ key: 'bg', type: 'image', label: '' }} value={value} onChange={onChange} />
      {!value && placeholder && <p className="text-[10.5px] text-gray-400 mt-1 truncate">Inherited: {placeholder}</p>}
    </div>
  );
}

/* ─── Advanced ──────────────────────────────────────────────────────────── */

function AdvancedPanel({ node, onChange }: { node: PBNode; onChange: InspectorProps['onChange'] }) {
  const a = node.adv || {};
  const set = (patch: Partial<NonNullable<PBNode['adv']>>, key?: string) => onChange({ ...node, adv: { ...a, ...patch } }, key ?? `adv:${node.id}:${Object.keys(patch).join(',')}`);
  return (
    <div>
      <Group title="Entrance animation">
        <Row label="Animation"><SelectIn value={a.anim || ''} onChange={v => set({ anim: v })} options={ANIMATIONS.filter(([v]) => v)} placeholder="None" /></Row>
        {a.anim && <>
          <Grid2>
            <Row label="Duration (ms)"><TextIn type="number" value={a.animDuration} placeholder="800" onChange={v => set({ animDuration: v })} /></Row>
            <Row label="Delay (ms)"><TextIn type="number" value={a.animDelay} placeholder="0" onChange={v => set({ animDelay: v })} /></Row>
          </Grid2>
          <Row label="Easing"><SelectIn value={a.animEasing || ''} onChange={v => set({ animEasing: v })} placeholder="Smooth (default)" options={[['ease', 'Ease'], ['linear', 'Linear'], ['ease-out', 'Ease out'], ['ease-in-out', 'Ease in-out'], ['spring', 'Spring'], ['snappy', 'Snappy']]} /></Row>
          <Toggle label="Replay each time it scrolls into view" checked={a.animRepeat} onChange={v => set({ animRepeat: v })} />
          <p className="text-[10.5px] text-gray-400 flex items-center gap-1"><Sparkles size={11} /> Animations play on the live site and in Preview, not on the canvas.</p>
        </>}
      </Group>
      <Group title="Visibility">
        <Toggle label="Hide on desktop" checked={a.hideDesktop} onChange={v => set({ hideDesktop: v })} />
        <Toggle label="Hide on tablet" checked={a.hideTablet} onChange={v => set({ hideTablet: v })} />
        <Toggle label="Hide on mobile" checked={a.hideMobile} onChange={v => set({ hideMobile: v })} />
        <div className="h-px bg-gray-100" />
        <button type="button" onClick={() => set({ hidden: !a.hidden })} className={`w-full flex items-center gap-2 h-8 px-3 rounded-md border text-[12px] font-semibold ${a.hidden ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          {a.hidden ? <EyeOff size={13} /> : <Eye size={13} />}{a.hidden ? 'Disabled — not shown on the site' : 'Disable (keep but don’t show)'}
        </button>
        <button type="button" onClick={() => set({ locked: !a.locked })} className={`w-full flex items-center gap-2 h-8 px-3 rounded-md border text-[12px] font-semibold ${a.locked ? 'border-gray-800 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          {a.locked ? <Lock size={13} /> : <Unlock size={13} />}{a.locked ? 'Locked — can’t be moved or deleted' : 'Lock position'}
        </button>
      </Group>
      <Group title="Identity">
        <Row label="Name in layers"><TextIn value={a.label} placeholder={ELEMENT_BY_TYPE[node.type]?.label} onChange={v => set({ label: v })} /></Row>
        <Row label="Anchor / CSS ID" hint={a.cssId ? `Link to it with #${a.cssId}` : 'Lets buttons link to this spot, e.g. #pricing'}>
          <TextIn mono value={a.cssId} placeholder="pricing" onChange={v => set({ cssId: v.replace(/[^\w-]/g, '') })} />
        </Row>
        <Row label="CSS classes"><TextIn mono value={a.cssClass} placeholder="my-class another" onChange={v => set({ cssClass: v })} /></Row>
        <Row label="Accessible label (aria-label)"><TextIn value={a.ariaLabel} onChange={v => set({ ariaLabel: v })} /></Row>
      </Group>
      <Group title="Custom CSS" defaultOpen={!!a.customCss}>
        <p className="text-[10.5px] text-gray-500 leading-snug">Write CSS for this {levelOf(node)} using <code className="px-1 rounded bg-gray-100 text-teal-700">selector</code>, e.g.<br /><code className="text-[10px] text-gray-600">selector:hover h2 {'{'} color: gold; {'}'}</code></p>
        <textarea rows={8} spellCheck={false} value={a.customCss || ''} onChange={e => set({ customCss: e.target.value }, `css:${node.id}`)}
          placeholder={'selector {\n  \n}'} className={`${inputCls} h-auto py-2 font-mono text-[11px] leading-relaxed resize-y bg-gray-950 text-emerald-200 border-gray-800`} />
      </Group>
      <div className="px-4 py-3 text-[10.5px] text-gray-400 flex items-center gap-1.5"><MousePointer2 size={11} /> ID <code className="font-mono">{node.id}</code> · <Code2 size={11} /> class <code className="font-mono">pb-n-{node.id}</code></div>
    </div>
  );
}
