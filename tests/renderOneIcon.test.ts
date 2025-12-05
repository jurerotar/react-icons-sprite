import { describe, it, expect } from 'vitest';
import { renderOneIcon } from '../src/core';

describe('renderOneIcon', () => {
  it('throws helpful error when export is missing', async () => {
    await expect(
      renderOneIcon('react-icons/bi', 'BiNotExisting'),
    ).rejects.toThrowError(
      /Icon export not found: react-icons\/bi -> BiNotExisting/,
    );
  });

  it('preserves viewBox and presentation attributes on <symbol>', async () => {
    const { id, symbol } = await renderOneIcon('react-icons/bi', 'BiAlarm');

    expect(id).toBe('ri-BiAlarm');
    // viewBox propagated
    expect(symbol).toMatch(/<symbol[^>]*viewBox="0 0 24 24"/i);
    // typical react-icons SVG includes fill/currentColor and stroke/currentColor; ensure kept
    expect(symbol).toMatch(/<symbol[^>]*\sfill="currentColor"/i);
    expect(symbol).toMatch(/<symbol[^>]*\sstroke="currentColor"/i);
    // stroke-width is a presentation attribute and should be preserved on symbol
    expect(symbol).toMatch(/<symbol[^>]*\sstroke-width="[0-9.]+"/i);
    // inner content retained (path or g)
    expect(symbol).toMatch(
      /<symbol[\s\S]*>([\s\S]*?<path[\s\S]*?>|[\s\S]*?<g[\s\S]*?>)[\s\S]*<\/symbol>/i,
    );
  });
});
