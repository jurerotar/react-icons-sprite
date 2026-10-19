import satisfies from 'semver/functions/satisfies.js';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  hasVersionedIconResolver,
  resolveIconImport,
} from '../src/packs/icon-resolvers';

describe('resolveIconImport', () => {
  test.each([
    ['0.104.0', 'js'],
    ['0.261.0', 'js'],
    ['0.262.0', 'mjs'],
    ['0.263.0', 'mjs'],
    ['0.263.1', 'mjs'],
    ['0.263.2-beta.0', 'js'],
    ['0.264.0', 'js'],
    ['0.468.0', 'js'],
    ['0.471.1', 'js'],
    ['0.577.0', 'js'],
    ['1.0.0-rc.0', 'js'],
    ['1.0.0', 'js'],
    ['1.8.0', 'js'],
    ['1.9.0', 'mjs'],
    ['1.16.0', 'mjs'],
    ['1.43.0', 'mjs'],
    ['1.43.0-beta.1', 'mjs'],
    ['1.53.0', 'mjs'],
  ])('resolves numeric Lucide names for version %s', (version, extension) => {
    for (const [name, filename] of [
      ['Settings2', 'settings-2'],
      ['Maximize2', 'maximize-2'],
      ['Minimize2', 'minimize-2'],
      ['ArrowBigDown', 'arrow-big-down'],
    ]) {
      expect(resolveIconImport('lucide-react', name, version)).toBe(
        `lucide-react/dist/esm/icons/${filename}.${extension}`,
      );
    }
  });

  test.each([undefined, 'invalid'])(
    'falls back to the package entry when no range matches %s',
    (version) => {
      expect(resolveIconImport('lucide-react', 'Settings2', version)).toBe(
        'lucide-react',
      );
    },
  );

  test.each(['0.0.1', '0.1.2-beta.0', '0.11.0', '0.103.0'])(
    'uses the bundled CommonJS entry for older Lucide %s',
    (version) => {
      expect(resolveIconImport('lucide-react', 'Maximize2', version)).toBe(
        'lucide-react/dist/cjs/lucide-react.js',
      );
    },
  );

  test.each(['Settings2', 'Settings2Icon', 'LucideSettings2'])(
    'resolves Lucide naming variants for %s',
    (name) => {
      expect(resolveIconImport('lucide-react', name, '1.43.0')).toBe(
        'lucide-react/dist/esm/icons/settings-2.mjs',
      );
    },
  );

  test.each([
    [
      '@tabler/icons-react',
      'IconAlertCircle',
      '2.0.0',
      'dist/esm/icons/alert-circle.js',
    ],
    [
      '@tabler/icons-react',
      'IconAlertCircle',
      '2.1.0',
      'dist/esm/icons/IconAlertCircle.js',
    ],
    [
      '@tabler/icons-react',
      'IconAlertCircle',
      '3.0.0-beta.2',
      'dist/esm/icons/IconAlertCircle.mjs',
    ],
    ['@radix-ui/react-icons', 'SunIcon', '1.0.0', 'dist/react-icons.esm.js'],
    [
      '@radix-ui/react-icons',
      'SunIcon',
      '2.0.0-rc.1776195498999',
      'dist/SunIcon.js',
    ],
    ['@phosphor-icons/react', 'AlarmIcon', '2.0.10', 'dist/icons/Alarm.es.js'],
    ['@phosphor-icons/react', 'Alarm', '2.0.11', 'dist/ssr/Alarm.mjs'],
    ['@phosphor-icons/react', 'Alarm', '2.0.12', 'dist/csr/Alarm.mjs'],
    ['@phosphor-icons/react', 'Alarm', '2.0.13', 'dist/ssr/Alarm.mjs'],
    ['@phosphor-icons/react', 'Alarm', '2.1.0', 'dist/icons/Alarm.mjs'],
    ['@phosphor-icons/react', 'Alarm', '2.1.3', 'dist/ssr/Alarm.mjs'],
    ['@phosphor-icons/react', 'AlarmIcon', '2.1.8-rc.0', 'dist/index.cjs.js'],
    [
      '@phosphor-icons/react',
      'AlarmIcon',
      '2.1.8-rc.1',
      'dist/ssr/Alarm.es.js',
    ],
    ['@phosphor-icons/react', 'Alarm', '2.1.10', 'dist/ssr/Alarm.es.js'],
    ['phosphor-react', 'Alarm', '1.0.0', 'dist/index.js'],
    ['phosphor-react', 'Alarm', '1.0.1', 'dist/icons/Alarm.esm.js'],
    [
      'react-bootstrap-icons',
      'AlarmFill',
      '1.11.6',
      'dist/icons/alarm-fill.js',
    ],
    ['react-feather', 'AlertCircle', '1.0.2', 'dist/icons/alert-circle.js'],
    ['grommet-icons', 'Add', '4.0.0', 'icons/Add.js'],
    ['devicons-react', 'ReactOriginal', '1.0.6', 'dist/index.js'],
    ['devicons-react', 'ReactOriginal', '1.0.7', 'index.js'],
    ['devicons-react', 'ReactOriginal', '1.0.8', 'dist/index.js'],
    ['devicons-react', 'ReactOriginal', '1.0.9', 'index.js'],
    ['devicons-react', 'ReactOriginal', '1.1.2', 'icons/ReactOriginal.js'],
    ['devicons-react', 'ReactOriginal', '1.2.3', 'icons/ReactOriginal.js'],
    ['devicons-react', 'ReactOriginal', '1.2.4', 'lib/icons/ReactOriginal.js'],
    [
      'devicons-react',
      'ReactOriginal',
      '1.2.3-canary-0.0.1',
      'lib/icons/ReactOriginal.js',
    ],
    [
      'devicons-react',
      'ReactOriginal',
      '1.2.3-canary-0.0.2',
      'lib/icons/ReactOriginal.js',
    ],
    [
      'devicons-react',
      'ReactOriginal',
      '1.2.3-canary-0.0.4',
      'icons/ReactOriginal.js',
    ],
    [
      'devicons-react',
      'ReactOriginal',
      '1.2.3-canary-0.0.5',
      'lib/icons/ReactOriginal.js',
    ],
    ['@carbon/icons-react', 'Add16', '10.4.0', 'lib/index.js'],
    ['@carbon/icons-react', 'Add', '11.0.0', 'lib/Add.js'],
    [
      '@ant-design/icons',
      'AlertOutlined',
      '4.0.0',
      'lib/icons/AlertOutlined.js',
    ],
    [
      '@fluentui/react-icons',
      'BorderBlindsIcon',
      '0.1.1',
      'lib-commonjs/components/BorderBlindsIcon.js',
    ],
    [
      '@fluentui/react-icons',
      'CalendarAdd24Regular',
      '1.1.110',
      'lib/esm/components/CalendarAdd24Regular.js',
    ],
    [
      '@fluentui/react-icons',
      'CalendarAdd24Regular',
      '2.0.313',
      'lib-cjs/index.js',
    ],
    [
      '@fluentui/react-icons',
      'CalendarAdd24Regular',
      '2.0.314',
      'lib-cjs/atoms/svg/calendar-add.js',
    ],
    [
      '@fluentui/react-icons',
      'CalendarAdd24Regular',
      '2.0.336',
      'lib-cjs/atoms/svg/calendar-add.cjs',
    ],
    ['@primer/octicons-react', 'AlertIcon', '19.29.0', 'dist/index.umd.js'],
    [
      '@primer/octicons-react',
      'AlertIcon',
      '19.30.0',
      'dist/icons/AlertIcon.mjs',
    ],
    [
      '@hugeicons/core-free-icons',
      'GlobalSearchIcon',
      '1.0.0',
      'dist/GlobalSearchIcon.mjs',
    ],
    [
      '@hugeicons/core-free-icons',
      'GlobalSearchIcon',
      '1.0.4',
      'dist/esm/index.js',
    ],
    [
      '@hugeicons/core-free-icons',
      'GlobalSearchIcon',
      '1.2.0',
      'GlobalSearchIcon',
    ],
    ['@mui/icons-material', 'Alarm', '5.0.0', 'Alarm'],
    ['@remixicon/react', 'RiSearchLine', '0.0.2', 'cjs/RiSearchLine.cjs'],
    ['@remixicon/react', 'RiSearchLine', '4.0.0', 'index.js'],
    ['@pillage-first/graphics', 'PillageFirstWheat', '0.0.9', 'dist/index.js'],
    [
      '@pillage-first/graphics',
      'PillageFirstWheat',
      '0.0.10',
      'dist/index.mjs',
    ],
  ])('resolves %s %s in %s', (pack, name, version, filename) => {
    expect(resolveIconImport(pack, name, version)).toBe(`${pack}/${filename}`);
  });
  test.each([
    [
      '@mui/icons-material/Alarm',
      'default',
      '5.0.0',
      '@mui/icons-material/Alarm',
    ],
    [
      '@ant-design/icons/AlertOutlined',
      'default',
      '4.0.0',
      '@ant-design/icons/lib/icons/AlertOutlined.js',
    ],
    [
      '@fluentui/react-icons/svg/add',
      'Add24Regular',
      '2.0.314',
      '@fluentui/react-icons/lib-cjs/atoms/svg/add.js',
    ],
    [
      '@fluentui/react-icons/svg/add',
      'Add24Regular',
      '2.0.336',
      '@fluentui/react-icons/lib-cjs/atoms/svg/add.cjs',
    ],
    [
      '@hugeicons/core-free-icons/GlobalSearchIcon',
      'default',
      '1.0.0',
      '@hugeicons/core-free-icons/dist/GlobalSearchIcon.mjs',
    ],
    [
      '@hugeicons/core-free-icons/GlobalSearchIcon',
      'default',
      '4.3.2',
      '@hugeicons/core-free-icons/GlobalSearchIcon',
    ],
    [
      '@heroicons/react/outline',
      'BellIcon',
      '1.0.0',
      '@heroicons/react/outline/BellIcon.js',
    ],
    [
      '@heroicons/react/24/outline',
      'BellIcon',
      '2.0.0',
      '@heroicons/react/24/outline/BellIcon',
    ],
    [
      '@fortawesome/free-solid-svg-icons',
      'faUser',
      '5.1.0',
      '@fortawesome/free-solid-svg-icons/faUser.js',
    ],
    ['react-icons/fa', 'FaBeer', '3.0.0', 'react-icons/fa/index.js'],
    ['react-icons/fa', 'FaBeer', '5.0.0', 'react-icons/fa'],
  ])('resolves %s in %s', (pack, name, version, expected) => {
    expect(resolveIconImport(pack, name, version)).toBe(expected);
  });
  test.each([undefined, 'invalid', '0.0.1'])(
    'keeps sources without a matching version %s',
    (version) => {
      expect(
        resolveIconImport('@tabler/icons-react', 'IconAlertCircle', version),
      ).toBe('@tabler/icons-react');
      expect(
        resolveIconImport('@mui/icons-material/Alarm', 'default', version),
      ).toBe('@mui/icons-material/Alarm');
    },
  );
  test('keeps custom sources unchanged', () => {
    expect(resolveIconImport('custom-icons', 'Alarm', '1.0.0')).toBe(
      'custom-icons',
    );
  });
  test.each(['custom-icons', 'constructor', 'toString', '__proto__'])(
    'ignores unregistered source %s',
    (pack) => {
      expect(hasVersionedIconResolver(pack)).toBe(false);
      expect(resolveIconImport(pack, 'Alarm', '1.0.0')).toBe(pack);
    },
  );
});

test.each([
  ['@ant-design/icons', '4.0.0'],
  ['@carbon/icons-react', '10.4.0'],
  ['@fluentui/react-icons', '0.1.1'],
  ['@fortawesome/free-solid-svg-icons', '5.1.0'],
  ['@fortawesome/react-fontawesome', '0.1.0'],
  ['@heroicons/react', '0.1.0'],
  ['@hugeicons/core-free-icons', '1.0.0'],
  ['@mui/icons-material', '5.0.0-beta.0'],
  ['@phosphor-icons/react', '2.0.3'],
  ['@phosphor-icons/react', '2.1.8-rc.0'],
  ['@primer/octicons-react', '10.0.0'],
  ['@radix-ui/react-icons', '2.0.0-rc.1776195498999'],
  ['@remixicon/react', '0.0.2'],
  ['@tabler/icons-react', '2.0.0'],
  ['@tabler/icons-react', '3.0.0-beta.2'],
  ['devicons-react', '0.1.0'],
  ['devicons-react', '1.2.3-canary-0.0.1'],
  ['grommet-icons', '0.1.0'],
  ['lucide-react', '0.104.0'],
  ['phosphor-react', '0.1.0'],
  ['react-bootstrap-icons', '1.0.0-beta.0'],
  ['react-feather', '1.0.2'],
  ['react-icons', '3.0.0'],
])('permits supported %s %s in peer dependencies', (pack, version) => {
  const { peerDependencies } = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  expect(satisfies(version, peerDependencies[pack])).toBe(true);
});
