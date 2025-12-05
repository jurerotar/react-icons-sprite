import { describe, it, expect } from 'vitest';
import { transformModule, ICON_SOURCE, ICON_COMPONENT_NAME } from '../src/core';

describe('transformModule - import parsing and JSX replacement', () => {
  const id = 'Component.tsx';

  it('replaces react-icon JSX with sprite icon and injects import', () => {
    const code = `
      import React from 'react';
      import { BiAlarm, BiAdjust } from 'react-icons/bi';

      export const C = () => (
        <div>
          <BiAlarm />
          <BiAdjust className="x" />
          <span>ok</span>
        </div>
      );
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(code, id, (pack, exportName) => {
      seen.push([pack, exportName]);
    });

    expect(res.anyReplacements).toBe(true);
    expect(seen).toEqual([
      ['react-icons/bi', 'BiAlarm'],
      ['react-icons/bi', 'BiAdjust'],
    ]);

    // It should import the sprite icon component
    expect(res.code).toMatch(
      new RegExp(
        `import\\s*{\\s*.*${ICON_COMPONENT_NAME}.*}\\s*from\\s*['"]${ICON_SOURCE}['"]`,
      ),
    );

    // JSX tags replaced to the icon component name
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-BiAlarm" />`,
    );
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-BiAdjust" className="x" />`,
    );

    // Original BiAlarm/BiAdjust specifiers should be pruned if unused after replacement
    expect(res.code).not.toMatch(/\{\s*BiAlarm\s*,\s*BiAdjust\s*}/);
  });

  it('does nothing when no react-icons imports are present', () => {
    const code = 'export const C = () => <div/>';
    const res = transformModule(code, id, () => {});
    expect(res.anyReplacements).toBe(false);
    expect(res.code).toBe(code);
  });
});
