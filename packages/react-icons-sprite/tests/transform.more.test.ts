import { describe, it, expect } from 'vitest';
import { transformModule, ICON_SOURCE, ICON_COMPONENT_NAME } from '../src/core';

describe('transformModule - edge cases', () => {
  const id = 'File.tsx';

  it('respects existing import of ReactIconsSpriteIcon (no duplicate) and aliases', () => {
    const code = `
      import React from 'react';
      import { ${ICON_COMPONENT_NAME} as RIS } from '${ICON_SOURCE}';
      import { BiAlarm, BiAdjust } from 'react-icons/bi';

      export const C = () => (
        <div>
          <BiAlarm />
          <BiAdjust />
        </div>
      );
    `;

    const res = transformModule(code, id, () => {});

    // Uses alias in JSX
    expect(res.code).toContain('<RIS iconId="ri-react-icons-bi-BiAlarm" />');
    expect(res.code).toContain('<RIS iconId="ri-react-icons-bi-BiAdjust" />');

    // No new import for the component should be added
    const importCount = (
      res.code.match(new RegExp(`from ['"]${ICON_SOURCE}['"]`, 'g')) || []
    ).length;
    expect(importCount).toBe(1);
  });

  it('does not add iconId if already present (preserves value)', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <BiAlarm iconId="ri-Custom" />;
    `;
    const res = transformModule(code, id, () => {});
    expect(res.code).toContain(`<${ICON_COMPONENT_NAME} iconId="ri-Custom" />`);
  });

  it('replaces both opening and closing tags', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <div><BiAlarm></BiAlarm></div>;
    `;
    const res = transformModule(code, id, () => {});
    // Should not leave original closing tag name lying around
    expect(res.code).not.toMatch(/<\/BiAlarm>/);
    // Opening tag replaced
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-react-icons-bi-BiAlarm">`,
    );
    // Closing tag is the icon component
    expect(res.code).toContain(`</${ICON_COMPONENT_NAME}>`);
  });

  it('ignores type-only imports from react-icons', () => {
    const code = `
      import type { BiAlarm } from 'react-icons/bi';
      export const C = () => <div><span>no change</span></div>;
    `;
    const res = transformModule(code, id, () => {});
    expect(res.anyReplacements).toBe(false);
    expect(res.code).toBe(code);
  });

  it('only prunes used specifiers and keeps unused ones', () => {
    const code = `
      import { BiAlarm, BiAdjust } from 'react-icons/bi';
      export const C = () => <BiAlarm/>;
    `;
    const res = transformModule(code, id, () => {});
    // BiAlarm should be removed from import list, BiAdjust should remain
    expect(res.code).toMatch(
      /import\s*\{\s*BiAdjust\s*\}\s*from\s*['"]react-icons\/bi['"]/,
    );
    expect(res.code).not.toMatch(/\{\s*BiAlarm\s*\}/);
  });

  it('leaves module intact if there are react-icons imports but no JSX usage', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <div/>;
    `;
    const res = transformModule(code, id, () => {});
    expect(res.anyReplacements).toBe(false);
    expect(res.code).toBe(code);
  });
});
