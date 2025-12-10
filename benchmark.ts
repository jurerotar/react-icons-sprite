import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { performance } from 'node:perf_hooks';
import type { IconType } from 'react-icons';
import { FiActivity } from 'react-icons/fi';
import { MdAccessibility } from 'react-icons/md';
import { FaBeer } from 'react-icons/fa';
import { IoAccessibility } from 'react-icons/io5';
import { BiBell } from 'react-icons/bi';
import { AiOutlineAlert } from 'react-icons/ai';
import { BsAlarm } from 'react-icons/bs';
import { RiAiGenerate2 } from 'react-icons/ri';
import { CgAbstract } from 'react-icons/cg';
import { HiAcademicCap } from 'react-icons/hi';
import { SiTypescript } from 'react-icons/si';
import { TiAdjustBrightness } from 'react-icons/ti';

type LoadedPack = { pack: string; iconComp: IconType; exportName: string };

const WARMUP_ITERS = 8;
const RERENDER_ITERS = 400;
const ICON_SIZE = 64;

const LOADED_PACKS: LoadedPack[] = [
  { pack: 'react-icons/fi', iconComp: FiActivity, exportName: 'FiActivity' },
  { pack: 'react-icons/md', iconComp: MdAccessibility, exportName: 'MdAccessibility' },
  { pack: 'react-icons/fa', iconComp: FaBeer, exportName: 'FaBeer' },
  { pack: 'react-icons/io5', iconComp: IoAccessibility, exportName: 'IoAccessibility' },
  { pack: 'react-icons/bi', iconComp: BiBell, exportName: 'BiBell' },
  { pack: 'react-icons/ai', iconComp: AiOutlineAlert, exportName: 'AiOutlineAlert' },
  { pack: 'react-icons/bs', iconComp: BsAlarm, exportName: 'BsAlarm' },
  { pack: 'react-icons/ri', iconComp: RiAiGenerate2, exportName: 'RiAiGenerate2' },
  { pack: 'react-icons/cg', iconComp: CgAbstract, exportName: 'CgAbstract' },
  { pack: 'react-icons/hi', iconComp: HiAcademicCap, exportName: 'HiAcademicCap' },
  { pack: 'react-icons/si', iconComp: SiTypescript, exportName: 'SiTypescript' },
  { pack: 'react-icons/ti', iconComp: TiAdjustBrightness, exportName: 'TiAdjustBrightness' },
];

const median = (nums: number[]) => {
  const a = nums.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const perIterationTimes = (fn: () => void, iters = RERENDER_ITERS) => {
  const out = new Array<number>(iters);
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    out[i] = performance.now() - t0;
  }
  return out;
};

const computeSymbolId = (pack: string, exportName: string) => {
  const p = pack.replace(/^@/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  const n = exportName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `sprite-${p}-${n}`;
};

const renderComponentToString = (Comp: IconType, size = ICON_SIZE) => {
  return renderToStaticMarkup(React.createElement('div', null,
    React.createElement(Comp, { size, width: size, height: size, color: 'currentColor' })
  ));
};

const renderUseOnly = (id: string, count = 1, size = ICON_SIZE) => {
  const children = Array.from({ length: count }, (_, i) =>
    React.createElement('svg', { key: i, width: size, height: size, preserveAspectRatio: 'xMidYMid meet', style: { color: 'currentColor' } },
      React.createElement('use', { href: `#${id}` })
    )
  );
  return renderToStaticMarkup(React.createElement('div', null, ...children));
};

/** reduction relative to native baseline, clamped to [-100, 100] */
const reductionPercentClamped = (nativeVal: number, spriteVal: number) => {
  if (!Number.isFinite(nativeVal) || !Number.isFinite(spriteVal) || nativeVal === 0) {
    return Number.NaN;
  }
  const raw = ((nativeVal - spriteVal) / nativeVal) * 100; // positive => sprite faster
  return Math.max(-100, Math.min(100, raw));
};

const formatMs = (n: number) => {
  return Number.isFinite(n) ? n.toFixed(3) : '–';
};

const formatReductionLabel = (pct: number) => {
  if (!Number.isFinite(pct)) {
    return '–';
  }
  return pct >= 0 ? `${pct.toFixed(1)}% reduction` : `${Math.abs(pct).toFixed(1)}% slower`;
};

const runBenchmark = async () => {
  const loaded = LOADED_PACKS;
  const rows = [];

  for (const { pack, iconComp, exportName } of loaded) {
    const id = computeSymbolId(pack, exportName);

    for (let i = 0; i < WARMUP_ITERS; i++) {
      renderComponentToString(iconComp);
      renderUseOnly(id);
    }

    const nativeTimes = perIterationTimes(() => renderComponentToString(iconComp));
    const spriteTimes = perIterationTimes(() => renderUseOnly(id));
    const nativeMedian = median(nativeTimes);
    const spriteMedian = median(spriteTimes);
    const pct = reductionPercentClamped(nativeMedian, spriteMedian);

    rows.push({
      pack,
      'react-icons icon render mean time [ms]': formatMs(nativeMedian),
      'react-icons-sprite icon render mean time [ms]': formatMs(spriteMedian),
      'Relative difference': formatReductionLabel(pct),
    });
  }

  // biome-ignore lint/suspicious/noConsole: This is fine
  console.table(rows);
};

await runBenchmark();
