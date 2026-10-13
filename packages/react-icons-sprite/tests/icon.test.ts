import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { ReactIconsSpriteIcon } from '../src/icon';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER } from '../src/index';

test('renders one SVG and one use reference with the default sizing', () => {
  const markup = renderToStaticMarkup(
    createElement(ReactIconsSpriteIcon, { iconId: 'ri-lucide-react-Circle' }),
  );
  expect(markup).toBe(
    `<svg height="1em" width="1em" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><use href="${REACT_ICONS_SPRITE_URL_PLACEHOLDER}#ri-lucide-react-Circle"></use></svg>`,
  );
  expect(markup).not.toContain('iconId=');
});

test('forwards accessibility, styling and data attributes to the SVG', () => {
  const markup = renderToStaticMarkup(
    createElement(ReactIconsSpriteIcon, {
      iconId: 'search',
      role: 'img',
      'aria-label': 'Search',
      'aria-hidden': false,
      className: 'search-icon',
      style: { color: 'red', strokeWidth: 2 },
      tabIndex: 0,
      ...{ 'data-state': 'active' },
    }),
  );
  expect(markup).toContain('role="img"');
  expect(markup).toContain('aria-label="Search"');
  expect(markup).toContain('aria-hidden="false"');
  expect(markup).toContain('class="search-icon"');
  expect(markup).toContain('style="color:red;stroke-width:2"');
  expect(markup).toContain('tabindex="0"');
  expect(markup).toContain('data-state="active"');
  expect(markup).toContain(
    `<use href="${REACT_ICONS_SPRITE_URL_PLACEHOLDER}#search">`,
  );
});

test('allows explicit dimensions, aspect ratio and a non-square viewBox', () => {
  const markup = renderToStaticMarkup(
    createElement(ReactIconsSpriteIcon, {
      iconId: 'wide-icon',
      width: 32,
      height: 16,
      viewBox: '0 0 512 256',
      preserveAspectRatio: 'none',
      fill: 'none',
      stroke: 'currentColor',
    }),
  );
  expect(markup).toContain('width="32"');
  expect(markup).toContain('height="16"');
  expect(markup).toContain('viewBox="0 0 512 256"');
  expect(markup).toContain('preserveAspectRatio="none"');
  expect(markup).toContain('fill="none"');
  expect(markup).toContain('stroke="currentColor"');
});

test('forwards event handlers to the outer SVG', () => {
  const onClick = vi.fn();
  const onKeyDown = vi.fn();
  const svg = ReactIconsSpriteIcon({
    iconId: 'button-icon',
    onClick,
    onKeyDown,
  });
  expect(svg.type).toBe('svg');
  expect(svg.props.onClick).toBe(onClick);
  expect(svg.props.onKeyDown).toBe(onKeyDown);
  expect(svg.props.iconId).toBeUndefined();
});
