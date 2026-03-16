import { describe, expect, test } from 'vitest';
import { detectUsage } from '../src/transform/usage-scanner';

describe('detectUsage', () => {
  test('detects jsx usage by imported local names', () => {
    const code = '<div><Circle className="w-4" /></div>';
    expect(detectUsage(code, ['Circle'])).toBe(true);
    expect(detectUsage(code, ['Square'])).toBe(false);
  });
});
