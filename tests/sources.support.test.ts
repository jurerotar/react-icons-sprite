import { describe, it, expect } from 'vitest';
import { ICON_COMPONENT_NAME, ICON_SOURCE, transformModule } from '../src/core';

type Case = {
  title: string;
  pack: string;
  exportName: string;
  expectedId: string; // full ri-<alias>-<ExportName>
};

// One representative case per supported source pattern in DEFAULT_ICON_SOURCES.
const cases: Case[] = [
  {
    title: 'react-icons pack (bi) — basic',
    pack: 'react-icons/bi',
    exportName: 'BiAlarm',
    expectedId: 'ri-react-icons-bi-BiAlarm',
  },
  {
    title: 'lucide-react',
    pack: 'lucide-react',
    exportName: 'Circle',
    expectedId: 'ri-lucide-react-Circle',
  },
  {
    title: '@radix-ui/react-icons',
    pack: '@radix-ui/react-icons',
    exportName: 'SunIcon',
    expectedId: 'ri-radix-ui-react-icons-SunIcon',
  },
  {
    title: '@heroicons/react with subpath',
    pack: '@heroicons/react/24/outline',
    exportName: 'BellIcon',
    expectedId: 'ri-heroicons-react-24-outline-BellIcon',
  },
  {
    title: '@tabler/icons-react',
    pack: '@tabler/icons-react',
    exportName: 'IconAlertCircle',
    expectedId: 'ri-tabler-icons-react-IconAlertCircle',
  },
  {
    title: 'phosphor-react',
    pack: 'phosphor-react',
    exportName: 'Alarm',
    expectedId: 'ri-phosphor-react-Alarm',
  },
  {
    title: 'react-feather',
    pack: 'react-feather',
    exportName: 'Bell',
    expectedId: 'ri-react-feather-Bell',
  },
  {
    title: 'react-bootstrap-icons',
    pack: 'react-bootstrap-icons',
    exportName: 'Alarm',
    expectedId: 'ri-react-bootstrap-icons-Alarm',
  },
  {
    title: 'grommet-icons',
    pack: 'grommet-icons',
    exportName: 'Add',
    expectedId: 'ri-grommet-icons-Add',
  },
  {
    title: 'remixicon-react',
    pack: 'remixicon-react',
    exportName: 'RiAlarmLine',
    expectedId: 'ri-remixicon-react-RiAlarmLine',
  },
  {
    title: 'devicons-react',
    pack: 'devicons-react',
    exportName: 'DiReact',
    expectedId: 'ri-devicons-react-DiReact',
  },
  {
    title: 'typicons-react',
    pack: 'typicons-react',
    exportName: 'TiHome',
    expectedId: 'ri-typicons-react-TiHome',
  },
  {
    title: 'boxicons-react',
    pack: 'boxicons-react',
    exportName: 'BxAlarm',
    expectedId: 'ri-boxicons-react-BxAlarm',
  },
];

describe('supported icon packages — transformModule integration', () => {
  for (const c of cases) {
    it(`replaces JSX and injects id for ${c.title}`, () => {
      const code = `
        import { ${c.exportName} } from '${c.pack}';
        export const C = () => <${c.exportName} className="x"/>;
      `;

      const seen: Array<[string, string]> = [];
      const res = transformModule(
        code,
        `${c.title}.tsx`,
        (pack, exportName) => {
          seen.push([pack, exportName]);
        },
      );

      expect(res.anyReplacements).toBe(true);
      expect(seen).toEqual([[c.pack, c.exportName]]);

      // Icon import injected
      expect(res.code).toMatch(
        new RegExp(
          `import\\s*{\\s*.*${ICON_COMPONENT_NAME}.*}\\s*from\\s*['"]${ICON_SOURCE}['"]`,
        ),
      );

      // JSX contains the correct, package-qualified iconId
      expect(res.code).toContain(
        `<${ICON_COMPONENT_NAME} iconId="${c.expectedId}" className="x" />`,
      );
    });
  }
});
