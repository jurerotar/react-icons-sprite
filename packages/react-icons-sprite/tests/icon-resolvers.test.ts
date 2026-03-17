import { describe, expect, test } from 'vitest';
import { resolveIconImport } from '../src/packs/icon-resolvers';

describe('resolveIconImport', () => {
  test('resolves lucide-react icons to concrete ESM file path', () => {
    expect(resolveIconImport('lucide-react', 'ArrowBigDown')).toBe(
      'lucide-react/dist/esm/icons/arrow-big-down.js',
    );
  });

  test('resolves @tabler/icons-react icons to concrete ESM file path', () => {
    expect(resolveIconImport('@tabler/icons-react', 'IconAlertCircle')).toBe(
      '@tabler/icons-react/dist/esm/icons/IconAlertCircle.mjs',
    );
  });

  test('falls back to original pack for unresolved providers', () => {
    expect(resolveIconImport('react-icons/fa', 'FaBeer')).toBe(
      'react-icons/fa',
    );
  });

  test('supports kebab-case conversion for acronym and numeric lucide names', () => {
    expect(resolveIconImport('lucide-react', 'CPU3D')).toBe(
      'lucide-react/dist/esm/icons/cpu3-d.js',
    );
  });
});
