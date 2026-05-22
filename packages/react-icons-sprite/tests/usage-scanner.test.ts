import { describe, expect, test } from 'vitest';
import { detectUsage } from '../src/transform/usage-scanner';

describe('detectUsage', () => {
  test('detects jsx usage by imported local names', () => {
    const code = '<div><Circle className="w-4" /></div>';
    expect(detectUsage(code, ['Circle'])).toBe(true);
    expect(detectUsage(code, ['Square'])).toBe(false);
  });

  test('detects closing tag usage', () => {
    const code = '<Circle></Circle>';
    expect(detectUsage(code, ['Circle'])).toBe(true);
  });

  test('does not match similar names', () => {
    const code = '<CircleOutline />';
    expect(detectUsage(code, ['Circle'])).toBe(false);
  });

  test('returns false when there are no candidate names', () => {
    const code = '<Circle />';
    expect(detectUsage(code, [])).toBe(false);
  });
});
