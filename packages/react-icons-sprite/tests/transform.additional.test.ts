import { describe, it, expect } from 'vitest';
import { transformModule, ICON_SOURCE, ICON_COMPONENT_NAME } from '../src/core';

describe('transformModule - additional cases', () => {
  const id = 'OnlyIcons.tsx';

  it('removes entire react-icons import when all specifiers were replaced', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <BiAlarm/>;
    `;

    const res = transformModule(code, id, () => {});

    // Should not contain react-icons import anymore
    expect(res.code).not.toMatch(/from\s*['"]react-icons\/bi['"]/);

    // Should contain our component import
    expect(res.code).toMatch(
      new RegExp(
        `import\\s*{\\s*.*${ICON_COMPONENT_NAME}.*}\\s*from\\s*['"]${ICON_SOURCE}['"]`,
      ),
    );
  });

  it('inserts icon import adjacent to first import and survives pruning of the only import', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      const X = 1;
      export const C = () => <BiAlarm a={X}/>;
    `;
    const res = transformModule(code, id, () => {});

    // The first import should now be our sprite import (react-icons import removed)
    const firstImport = res.code.match(
      /^(?:\s*\/\/.*\n|\s*\/\*[\s\S]*?\*\/\s*\n)?\s*import[^\n]+/,
    );
    expect(firstImport?.[0]).toMatch(new RegExp(`${ICON_SOURCE}`));
  });

  it('ignores non-supported import forms (namespace/default) and does nothing', () => {
    const codeNs = `
      import * as BI from 'react-icons/bi';
      export const C = () => <div/>;
    `;
    const resNs = transformModule(codeNs, id, () => {});
    expect(resNs.anyReplacements).toBe(false);
    expect(resNs.code).toBe(codeNs);

    const codeDef = `
      import BI from 'react-icons/bi';
      export const C = () => <div/>;
    `;
    const resDef = transformModule(codeDef, id, () => {});
    expect(resDef.anyReplacements).toBe(false);
    expect(resDef.code).toBe(codeDef);
  });
});
