import { expect, test } from 'vitest';
import { buildSprite } from '../src/sprite/build-sprite';

test('hoists gradient paint servers outside symbols without changing references', async () => {
  const linear =
    '<linearGradient id="base"><stop offset="0" stop-color="red"/></linearGradient>';
  const radial = '<radialGradient id="derived" href="#base"/>';
  const path = '<path fill="url(#derived)" d="M0 0h10v10z"/>';
  const sprite = await buildSprite([{ pack: 'test', exportName: 'Gradient' }], {
    renderIcon: Object.assign(
      async () => ({
        viewBox: '0 0 10 10',
        symbolAttributes: '',
        symbolBody: `<g>${linear}${radial}${path}</g>`,
      }),
      { preload: async () => {} },
    ),
  });
  expect(sprite).toContain(`<defs>${linear}${radial}</defs><symbol`);
  expect(sprite).toContain(`<g>${path}</g></symbol>`);
  expect(sprite).not.toContain('display:none');
});

test('does not add definitions for icons without gradients', async () => {
  const sprite = await buildSprite([{ pack: 'test', exportName: 'Solid' }], {
    renderIcon: Object.assign(
      async () => ({
        viewBox: '0 0 24 24',
        symbolAttributes: 'fill="currentColor"',
        symbolBody: '<path d="M0 0h10v10z"/>',
      }),
      { preload: async () => {} },
    ),
  });
  expect(sprite).not.toContain('<defs>');
  expect(sprite).toContain('fill="currentColor"><path');
});

test('empty sprites have no hidden ancestor', async () => {
  expect(await buildSprite([])).toBe(
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );
});
