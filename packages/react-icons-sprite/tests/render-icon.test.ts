import { describe, expect, test } from 'vitest';
import { forwardRef } from 'react';
import { isRenderableComponent } from '../src/sprite/render-icon';

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
