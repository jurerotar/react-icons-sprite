import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIconLoader, type IconLoadOptions } from './load-icon';

export type RenderedIcon = {
  symbolBody: string;
  viewBox: string;
  symbolAttributes: string;
};

const SVG_INNER_RE = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;
const SVG_OPEN_RE = /<svg\b([^>]*)>/i;
const SVG_ATTR_RE = /([:\w-]+)=("[^"]*"|'[^']*')/g;

const OMITTED_SVG_ATTRIBUTES = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'id',
]);

export const extractSymbolAttributes = (svgMarkup: string): string => {
  const openingAttributes = SVG_OPEN_RE.exec(svgMarkup)?.[1];
  if (!openingAttributes) {
    return '';
  }

  const attributes: string[] = [];

  for (const [, name, value] of openingAttributes.matchAll(SVG_ATTR_RE)) {
    if (OMITTED_SVG_ATTRIBUTES.has(name)) {
      continue;
    }
    attributes.push(`${name}=${value}`);
  }

  return attributes.join(' ');
};

const extractRenderedIcon = (
  svgMarkup: string,
  description: string,
): RenderedIcon => {
  const symbolBody = SVG_INNER_RE.exec(svgMarkup)?.[1];
  if (!symbolBody) {
    throw new Error(
      `[react-icons-sprite] Unable to extract SVG content for ${description}.`,
    );
  }
  return {
    symbolBody,
    viewBox: VIEWBOX_RE.exec(svgMarkup)?.[1] ?? '0 0 24 24',
    symbolAttributes: extractSymbolAttributes(svgMarkup),
  };
};

export const isRenderableComponent = (
  value: unknown,
): value is ComponentType<Record<string, unknown>> => {
  if (typeof value === 'function') {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return '$$typeof' in value;
};

type FontAwesomeIconTuple = [
  width: number,
  height: number,
  ligatures: unknown,
  unicode: string,
  svgPathData: string | string[],
];

type FontAwesomeIconDefinition = {
  icon: FontAwesomeIconTuple;
};

type HugeiconsIconElement = readonly [
  tag: string,
  attributes: Readonly<Record<string, string | number>>,
];

type HugeiconsIconDefinition = readonly HugeiconsIconElement[];

export const isFontAwesomeIconDefinition = (
  value: unknown,
): value is FontAwesomeIconDefinition => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const icon = (value as { icon?: unknown }).icon;
  if (!Array.isArray(icon) || icon.length < 5) {
    return false;
  }

  return typeof icon[0] === 'number' && typeof icon[1] === 'number';
};

export const isHugeiconsIconDefinition = (
  value: unknown,
): value is HugeiconsIconDefinition => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!Array.isArray(item) || item.length < 2) {
      return false;
    }

    return typeof item[0] === 'string' && typeof item[1] === 'object';
  });
};

const renderFontAwesomeIconDefinition = (
  iconDefinition: FontAwesomeIconDefinition,
): RenderedIcon => {
  const [width, height, , , svgPathData] = iconDefinition.icon;
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const symbolBody = paths.map((d) => `<path d="${d}"/>`).join('');

  return {
    symbolBody,
    viewBox: `0 0 ${width} ${height}`,
    symbolAttributes: '',
  };
};

const renderHugeiconsIconDefinition = (
  iconDefinition: HugeiconsIconDefinition,
): RenderedIcon => {
  const children = [...iconDefinition]
    .sort(([, a], [, b]) => {
      const hasOpacityA = a.opacity !== undefined;
      const hasOpacityB = b.opacity !== undefined;
      return hasOpacityB ? 1 : hasOpacityA ? -1 : 0;
    })
    .map(([tag, attributes]) => {
      const { key, ...rest } = attributes;
      return createElement(tag, { ...rest, key });
    });

  const svgMarkup = renderToStaticMarkup(
    createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        color: 'currentColor',
      },
      children,
    ),
  );
  return extractRenderedIcon(svgMarkup, 'Hugeicons icon');
};

const renderLoadedIcon = (
  pack: string,
  exportName: string,
  iconComponent: unknown,
): RenderedIcon => {
  if (isFontAwesomeIconDefinition(iconComponent)) {
    return renderFontAwesomeIconDefinition(iconComponent);
  }

  if (isHugeiconsIconDefinition(iconComponent)) {
    return renderHugeiconsIconDefinition(iconComponent);
  }

  if (!isRenderableComponent(iconComponent)) {
    throw new Error(
      `[react-icons-sprite] Unable to render icon "${exportName}" from "${pack}". ` +
        'Expected a React component export.',
    );
  }

  const svgMarkup = renderToStaticMarkup(createElement(iconComponent));
  return extractRenderedIcon(svgMarkup, `"${exportName}" from "${pack}"`);
};

// Loading can start during transforms; rendering remains at asset emission.
export const createIconRenderer = () => {
  const load = createIconLoader();
  const render = (
    pack: string,
    exportName: string,
    options: IconLoadOptions = {},
  ) =>
    load(pack, exportName, options).then((component) =>
      renderLoadedIcon(pack, exportName, component),
    );
  return Object.assign(render, { preload: load.preload });
};

export const renderIcon = (
  pack: string,
  exportName: string,
  options: IconLoadOptions = {},
): Promise<RenderedIcon> => createIconRenderer()(pack, exportName, options);
