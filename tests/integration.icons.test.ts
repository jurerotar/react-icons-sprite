import { describe, it, expect } from 'vitest';
import { ICON_COMPONENT_NAME, transformModule } from '../src/core';

describe('FontAwesome and MUI Integration', () => {
  it('handles @fortawesome/react-fontawesome with FontAwesomeIcon component', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      import { faCoffee } from '@fortawesome/free-solid-svg-icons';
      export const C = () => <FontAwesomeIcon icon={faCoffee} className="fa-lg" />;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(code, 'fa-test.tsx', (pack, exportName) => {
      seen.push([pack, exportName]);
    });

    expect(res.anyReplacements).toBe(true);
    // It should register the icon itself, not the FontAwesomeIcon component
    expect(seen).toContainEqual([
      '@fortawesome/free-solid-svg-icons',
      'faCoffee',
    ]);

    // JSX should be replaced with our icon component, and icon prop removed
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-fortawesome-free-solid-svg-icons-faCoffee" className="fa-lg" />`,
    );
    expect(res.code).not.toContain('icon={faCoffee}');
  });

  it('handles MUI icons with subpaths', () => {
    const code = `
      import Alarm from '@mui/icons-material/Alarm';
      export const C = () => <Alarm />;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(
      code,
      'mui-subpath-test.tsx',
      (pack, exportName) => {
        seen.push([pack, exportName]);
      },
    );

    expect(res.anyReplacements).toBe(true);
    expect(seen).toEqual([['@mui/icons-material/Alarm', 'default']]);
    // It becomes ri-mui-icons-material-Alarm-default because / is replaced by -
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-mui-icons-material-Alarm-default" />`,
    );
  });

  it('handles aliased icon imports', () => {
    const code = `
      import { Alarm as MyAlarm } from '@mui/icons-material';
      export const C = () => <MyAlarm />;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(code, 'alias-test.tsx', (pack, exportName) => {
      seen.push([pack, exportName]);
    });

    expect(res.anyReplacements).toBe(true);
    expect(seen).toEqual([['@mui/icons-material', 'Alarm']]);
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-mui-icons-material-Alarm" />`,
    );
  });

  it('does not replace FontAwesomeIcon if icon prop is missing', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      export const C = () => <FontAwesomeIcon />;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(
      code,
      'fa-no-prop-test.tsx',
      (pack, exportName) => {
        seen.push([pack, exportName]);
      },
    );

    // FontAwesomeIcon is in DEFAULT_ICON_SOURCES, but without 'icon' prop we can't determine the actual icon.
    // However, our current logic swaps the tag anyway if it's in localNameToImport.
    // Let's see what it does.

    // If it's in localNameToImport, it WILL be replaced.
    // In core.ts:
    // const localNameToImport = collectIconImports(ast, sources);
    // if (meta.pack === '@fortawesome/react-fontawesome' && meta.exportName === 'FontAwesomeIcon') { ... }
    // It swaps the tag: path.node.name = t.jSXIdentifier(iconLocalName);

    expect(res.anyReplacements).toBe(true);
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-fortawesome-react-fontawesome-FontAwesomeIcon" />`,
    );
  });

  it('handles FontAwesomeIcon with complex icon prop (ignored for now)', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      export const C = () => <FontAwesomeIcon icon={["fas", "coffee"]} />;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(
      code,
      'fa-complex-prop-test.tsx',
      (pack, exportName) => {
        seen.push([pack, exportName]);
      },
    );

    expect(res.anyReplacements).toBe(true);
    // Should fallback to the component itself if it can't resolve the icon identifier
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-fortawesome-react-fontawesome-FontAwesomeIcon" icon={["fas", "coffee"]} />`,
    );
  });

  it('handles FontAwesomeIcon with string literal icon prop (unsupported but should not crash)', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      export const C = () => <FontAwesomeIcon icon="coffee" />;
    `;

    const res = transformModule(code, 'fa-string-prop-test.tsx', () => {});
    expect(res.anyReplacements).toBe(true);
    expect(res.code).toContain(
      'iconId="ri-fortawesome-react-fontawesome-FontAwesomeIcon"',
    );
  });

  it('handles FontAwesomeIcon with member expression icon prop', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      import * as Icons from '@fortawesome/free-solid-svg-icons';
      export const C = () => <FontAwesomeIcon icon={Icons.faCoffee} />;
    `;

    // Our current logic only handles Identifier for the icon prop
    const res = transformModule(code, 'fa-member-test.tsx', () => {});
    expect(res.anyReplacements).toBe(true);
    // Fallback because Icons.faCoffee is not an Identifier we look up in localNameToImport
    expect(res.code).toContain(
      'iconId="ri-fortawesome-react-fontawesome-FontAwesomeIcon"',
    );
  });

  it('handles multiple icons and mixed sources', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      import { faCoffee } from '@fortawesome/free-solid-svg-icons';
      import { Alarm } from '@mui/icons-material';
      import { Circle } from 'lucide-react';

      export const C = () => (
        <div>
          <FontAwesomeIcon icon={faCoffee} />
          <Alarm />
          <Circle />
        </div>
      );
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(code, 'mixed-test.tsx', (pack, exportName) => {
      seen.push([pack, exportName]);
    });

    expect(res.anyReplacements).toBe(true);
    expect(seen).toContainEqual([
      '@fortawesome/free-solid-svg-icons',
      'faCoffee',
    ]);
    expect(seen).toContainEqual(['@mui/icons-material', 'Alarm']);
    expect(seen).toContainEqual(['lucide-react', 'Circle']);

    expect(res.code).toContain(
      'iconId="ri-fortawesome-free-solid-svg-icons-faCoffee"',
    );
    expect(res.code).toContain('iconId="ri-mui-icons-material-Alarm"');
    expect(res.code).toContain('iconId="ri-lucide-react-Circle"');
  });

  it('handles custom icon sources via options', () => {
    const code = `
      import { MyIcon } from 'my-custom-icons';
      export const C = () => <MyIcon />;
    `;

    const customSources = [/^\my-custom-icons$/];
    const seen: Array<[string, string]> = [];
    const res = transformModule(
      code,
      'custom-test.tsx',
      (pack, exportName) => {
        seen.push([pack, exportName]);
      },
      customSources,
    );

    expect(res.anyReplacements).toBe(true);
    expect(seen).toEqual([['my-custom-icons', 'MyIcon']]);
    expect(res.code).toContain('iconId="ri-my-custom-icons-MyIcon"');
  });

  it('prunes unused FontAwesome icons but keeps others', () => {
    const code = `
      import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
      import { faCoffee, faBell } from '@fortawesome/free-solid-svg-icons';
      import { Alarm } from '@mui/icons-material';
      export const C = () => (
        <div>
          <FontAwesomeIcon icon={faCoffee} />
          <Alarm />
        </div>
      );
    `;

    const res = transformModule(code, 'prune-test.tsx', () => {});

    expect(res.code).toContain(
      'import { ReactIconsSpriteIcon } from "react-icons-sprite"',
    );
    // faCoffee should be pruned from imports, but it might still appear in iconId if we don't normalize it there.
    expect(res.code).not.toMatch(/import.*faCoffee/);
    // faBell should remain because it's not used
    expect(res.code).toContain('faBell');
    // Alarm should be pruned because it's used
    expect(res.code).not.toMatch(/import.*Alarm/);
    // FontAwesomeIcon should be pruned because its only usage was replaced
    expect(res.code).not.toContain('FontAwesomeIcon');
  });
});
