import { describe, it, expect } from 'vitest';
import { transformModule, ICON_SOURCE, ICON_COMPONENT_NAME } from '../src/core';

describe('transformModule - aliased local specifiers', () => {
  const id = 'Aliased.tsx';

  it('replaces JSX that uses an aliased local name and prunes the specifier', () => {
    const code = `
      import { BiAlarm as Alarm } from 'react-icons/bi';
      export const C = () => <Alarm data-x={1}/>;
    `;

    const seen: Array<[string, string]> = [];
    const res = transformModule(code, id, (pack, exportName) => {
      seen.push([pack, exportName]);
    });

    expect(res.anyReplacements).toBe(true);
    expect(seen).toEqual([['react-icons/bi', 'BiAlarm']]);

    // Should inject our component import
    expect(res.code).toMatch(
      new RegExp(
        `import\\s*{\\s*.*${ICON_COMPONENT_NAME}.*}\\s*from\\s*['"]${ICON_SOURCE}['"]`,
      ),
    );

    // JSX tag is replaced and props preserved
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-react-icons-bi-BiAlarm" data-x={1} />`,
    );

    // Original aliased import should be removed entirely
    expect(res.code).not.toMatch(/BiAlarm\s+as\s+Alarm/);
    expect(res.code).not.toMatch(/from\s*['"]react-icons\/bi['"]/);
  });
});
