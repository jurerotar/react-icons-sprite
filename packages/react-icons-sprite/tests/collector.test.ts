import { describe, expect, test } from 'vitest';
import { createCollector } from '../src/collector/create-collector';

describe('createCollector', () => {
  test('deduplicates package icons across importers', () => {
    const collector = createCollector();

    collector.add('lucide-react', 'Search', { importer: '/one.tsx' });
    collector.add('lucide-react', 'Search', { importer: '/two.tsx' });

    expect(collector.toList()).toEqual([
      { pack: 'lucide-react', exportName: 'Search', importer: '/two.tsx' },
    ]);
  });

  test('keeps relative custom icons separate per importer', () => {
    const collector = createCollector();

    collector.add('./icons', 'Search', { importer: '/one.tsx' });
    collector.add('./icons', 'Search', { importer: '/two.tsx' });

    expect(collector.toList()).toEqual([
      { pack: './icons', exportName: 'Search', importer: '/one.tsx' },
      { pack: './icons', exportName: 'Search', importer: '/two.tsx' },
    ]);
  });
});
