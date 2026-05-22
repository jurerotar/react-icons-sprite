import { describe, expect, test } from 'vitest';
import { resolveIconImport } from '../src/packs/icon-resolvers';

describe('resolveIconImport', () => {
  test('resolves lucide-react icons to concrete ESM file path', () => {
    expect(resolveIconImport('lucide-react', 'ArrowBigDown')).toBe(
      'lucide-react/dist/esm/icons/arrow-big-down.mjs',
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

  test('resolves package-specific entry points for supported packs', () => {
    expect(resolveIconImport('@mui/icons-material', 'Alarm')).toBe(
      '@mui/icons-material/Alarm',
    );
    expect(resolveIconImport('@mui/icons-material/Alarm', 'Alarm')).toBe(
      '@mui/icons-material/Alarm',
    );
    expect(resolveIconImport('@radix-ui/react-icons', 'SunIcon')).toBe(
      '@radix-ui/react-icons/dist/react-icons.esm.js',
    );
    expect(resolveIconImport('@heroicons/react/24/outline', 'BellIcon')).toBe(
      '@heroicons/react/24/outline/BellIcon',
    );
    expect(
      resolveIconImport('@fortawesome/free-solid-svg-icons', 'faUser'),
    ).toBe('@fortawesome/free-solid-svg-icons/faUser');
    expect(resolveIconImport('@phosphor-icons/react', 'Alarm')).toBe(
      '@phosphor-icons/react/dist/ssr/Alarm',
    );
    expect(resolveIconImport('@phosphor-icons/react', 'AcornIcon')).toBe(
      '@phosphor-icons/react/dist/ssr/Acorn',
    );
    expect(resolveIconImport('phosphor-react', 'Alarm')).toBe(
      'phosphor-react/dist/icons/Alarm.esm.js',
    );
    expect(resolveIconImport('react-feather', 'AlertCircle')).toBe(
      'react-feather/dist/icons/alert-circle.js',
    );
    expect(resolveIconImport('react-bootstrap-icons', 'AlarmFill')).toBe(
      'react-bootstrap-icons/dist/icons/alarm-fill.js',
    );
    expect(resolveIconImport('grommet-icons', 'Add')).toBe(
      'grommet-icons/icons/Add.js',
    );
    expect(resolveIconImport('devicons-react', 'ReactOriginal')).toBe(
      'devicons-react/icons/ReactOriginal',
    );
    expect(resolveIconImport('@carbon/icons-react', 'Add')).toBe(
      '@carbon/icons-react/es/Add.js',
    );
  });

  test('supports kebab-case conversion for acronym and numeric lucide names', () => {
    expect(resolveIconImport('lucide-react', 'CPU3D')).toBe(
      'lucide-react/dist/esm/icons/cpu3-d.mjs',
    );
  });
});
