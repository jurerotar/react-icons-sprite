import { describe, it, expect } from 'vitest';
import { computeIconId } from '../src/core';

describe('computeIconId - alias normalization edge cases', () => {
  it('normalizes multi-segment packs like react-icons/hi2 and fa6', () => {
    expect(computeIconId('react-icons/hi2', 'HiFoo')).toBe(
      'ri-react-icons-hi2-HiFoo',
    );
    expect(computeIconId('react-icons/fa6', 'Fa6Bar')).toBe(
      'ri-react-icons-fa6-Fa6Bar',
    );
  });

  it('removes @ scope and replaces non-alphanumeric with dashes', () => {
    expect(computeIconId('@scope/pkg', 'Icon')).toBe('ri-scope-pkg-Icon');
    expect(computeIconId('@scope/pkg/sub/path', 'Icon')).toBe(
      'ri-scope-pkg-sub-path-Icon',
    );
  });

  it('handles other hyphenated names', () => {
    expect(computeIconId('react-icons/fa6-solid', 'FaBeer')).toBe(
      'ri-react-icons-fa6-solid-FaBeer',
    );
  });
});
