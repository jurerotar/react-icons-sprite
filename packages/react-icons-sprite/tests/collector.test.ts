import { describe, it, expect } from 'vitest';
import { createCollector } from '../src/core';

describe('createCollector - de-duplication and ordering', () => {
  it('de-duplicates by pack+exportName and preserves first insertion order', () => {
    const c = createCollector();

    // Add duplicates in mixed order
    c.add('react-icons/bi', 'BiAlarm');
    c.add('react-icons/bi', 'BiAdjust');
    c.add('react-icons/bi', 'BiAlarm'); // duplicate
    c.add('react-icons/fa', 'FaBeer');
    c.add('react-icons/bi', 'BiAdjust'); // duplicate

    const list = c.toList();
    expect(list).toEqual([
      { pack: 'react-icons/bi', exportName: 'BiAlarm' },
      { pack: 'react-icons/bi', exportName: 'BiAdjust' },
      { pack: 'react-icons/fa', exportName: 'FaBeer' },
    ]);

    // Clearing works
    c.clear();
    expect(c.toList()).toEqual([]);
  });
});
