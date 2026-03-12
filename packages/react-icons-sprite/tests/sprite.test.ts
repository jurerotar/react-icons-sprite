import { describe, it, expect } from 'vitest';
import { buildSprite } from '../src/core';

describe('buildSprite - spritesheet generation', () => {
  it('generates an SVG with symbols for provided icons', async () => {
    const sprite = await buildSprite([
      { pack: 'react-icons/bi', exportName: 'BiAlarm' },
      { pack: 'react-icons/bi', exportName: 'BiAdjust' },
    ]);

    expect(sprite).toMatch(/<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(sprite).toContain('<defs>');
    expect(sprite).toContain('</defs>');
    expect(sprite).toContain('id="ri-react-icons-bi-BiAlarm"');
    expect(sprite).toContain('id="ri-react-icons-bi-BiAdjust"');
    expect(sprite.trim().endsWith('</svg>')).toBe(true);
  });
});
