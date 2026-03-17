import { describe, expect, test } from 'vitest';
import { forwardRef } from 'react';
import {
  extractSymbolAttributes,
  isFontAwesomeIconDefinition,
  isRenderableComponent,
} from '../src/sprite/render-icon';

describe('isRenderableComponent', () => {
  test('accepts function components', () => {
    const Icon = () => null;
    expect(isRenderableComponent(Icon)).toBe(true);
  });

  test('accepts forwardRef components', () => {
    const Icon = forwardRef<SVGSVGElement>((_props, _ref) => null);
    expect(isRenderableComponent(Icon)).toBe(true);
  });

  test('rejects non-component exports', () => {
    expect(isRenderableComponent({})).toBe(false);
    expect(isRenderableComponent(null)).toBe(false);
    expect(isRenderableComponent('SunIcon')).toBe(false);
  });
});

describe('extractSymbolAttributes', () => {
  test('keeps fill and stroke-related svg attributes needed by outline icons', () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="24" height="24"><path d="M0 0h24v24H0z"/></svg>';

    expect(extractSymbolAttributes(markup)).toBe(
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"',
    );
  });
});

describe('isFontAwesomeIconDefinition', () => {
  test('accepts valid FontAwesome icon definition objects', () => {
    expect(
      isFontAwesomeIconDefinition({
        icon: [512, 512, [], 'f0f4', 'M0 0h24v24H0z'],
      }),
    ).toBe(true);
  });

  test('rejects invalid icon definition shapes', () => {
    expect(isFontAwesomeIconDefinition(null)).toBe(false);
    expect(isFontAwesomeIconDefinition({ icon: [] })).toBe(false);
    expect(
      isFontAwesomeIconDefinition({
        icon: ['512', 512, [], 'f0f4', 'M0 0h24v24H0z'],
      }),
    ).toBe(false);
  });
});
