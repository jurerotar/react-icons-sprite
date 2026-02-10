import { describe, it, expect } from 'vitest';
import { buildSprite, DEFAULT_ICON_SOURCES } from '../src/core';

// Mapping of some supported packages to a representative icon export name.
// Some packages might not be installed in the environment, so we handle potential failures.
const testIcons: Array<{ pack: string; exportName: string; title: string }> = [
  {
    title: 'react-icons (bi)',
    pack: 'react-icons/bi',
    exportName: 'BiAlarm',
  },
  {
    title: 'lucide-react',
    pack: 'lucide-react',
    exportName: 'Circle',
  },
  {
    title: '@radix-ui/react-icons',
    pack: '@radix-ui/react-icons',
    exportName: 'SunIcon',
  },
  {
    title: '@heroicons/react (v2 outline)',
    pack: '@heroicons/react/24/outline',
    exportName: 'BellIcon',
  },
  {
    title: '@tabler/icons-react',
    pack: '@tabler/icons-react',
    exportName: 'IconAlertCircle',
  },
  {
    title: 'phosphor-react',
    pack: 'phosphor-react',
    exportName: 'Alarm',
  },
  {
    title: '@phosphor-icons/react',
    pack: '@phosphor-icons/react',
    exportName: 'Horse',
  },
  {
    title: 'react-feather',
    pack: 'react-feather',
    exportName: 'Bell',
  },
  {
    title: 'react-bootstrap-icons',
    pack: 'react-bootstrap-icons',
    exportName: 'Alarm',
  },
  {
    title: 'grommet-icons',
    pack: 'grommet-icons',
    exportName: 'Add',
  },
  {
    title: '@remixicon/react',
    pack: '@remixicon/react',
    exportName: 'RiAddBoxLine',
  },
  {
    title: 'devicons-react',
    pack: 'devicons-react',
    exportName: 'ReactOriginal',
  },
  {
    title: 'FontAwesome (Free Solid)',
    pack: '@fortawesome/free-solid-svg-icons',
    exportName: 'faCoffee',
  },
  {
    title: 'MUI Icons',
    pack: '@mui/icons-material',
    exportName: 'Alarm',
  },
  {
    title: 'Unicons',
    pack: '@iconscout/react-unicons',
    exportName: 'UilReact',
  },
];

describe('Sprite integration across icon sets', () => {
  for (const icon of testIcons) {
    it(
      `generates valid sprite content for ${icon.title} (${icon.pack})`,
      { timeout: 30000 },
      async () => {
        const sprite = await buildSprite([
          { pack: icon.pack, exportName: icon.exportName },
        ]);

        expect(sprite).toMatch(
          /<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/,
        );
        expect(sprite).toContain('<defs>');
        expect(sprite).toContain('</defs>');
        expect(sprite.trim().endsWith('</svg>')).toBe(true);

        // 2. Verify it contains the symbol with correct ID
        // Note: computeIconId is internal, but we know the format or can just check for inclusion
        // The ID should be ri-<normalized-pack>-<exportName>
        const expectedIdPart = icon.exportName;
        expect(sprite).toContain(`id="ri-`);
        expect(sprite).toContain(expectedIdPart);

        // 3. Verify it contains actual path/graphic definition
        // Most icons use <path ... />, <g ... />, <circle ... />, etc.
        // We expect at least one of these inside the symbol.
        expect(sprite).toMatch(
          /<(path|g|circle|rect|polyline|polygon|ellipse)/i,
        );

        // 4. Verify viewBox is present
        expect(sprite).toContain('viewBox=');
      },
    );
  }

  it('covers all patterns in DEFAULT_ICON_SOURCES', () => {
    // This is a meta-test to ensure our testIcons list covers all regexes in DEFAULT_ICON_SOURCES
    const patterns = [...DEFAULT_ICON_SOURCES];
    const coveredPatterns = new Set<RegExp>();

    // These patterns are for components or meta-packages that don't directly export icons
    // in the same way, or are handled via the icon prop (like FontAwesomeIcon)
    const knownNonIconPacks = [/^@fortawesome\/react-fontawesome$/];

    for (const icon of testIcons) {
      for (const pattern of patterns) {
        if (pattern.test(icon.pack)) {
          coveredPatterns.add(pattern);
        }
      }
    }

    const uncovered = patterns.filter(
      (p) =>
        !coveredPatterns.has(p) &&
        !knownNonIconPacks.some((k) => k.toString() === p.toString()),
    );
    expect(
      uncovered,
      `Patterns not covered by integration test: ${uncovered.map((p) => p.toString()).join(', ')}`,
    ).toHaveLength(0);
  });
});
