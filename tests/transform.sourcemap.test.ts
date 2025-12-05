import { describe, it, expect } from 'vitest';
import { transformModule, ICON_COMPONENT_NAME } from '../src/core';

describe('transformModule - source maps', () => {
  it('returns a non-null source map with correct source when replacements occur', () => {
    const id = 'SourceMapTest.tsx';
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <BiAlarm/>;
    `;

    const res = transformModule(code, id, () => {});
    expect(res.anyReplacements).toBe(true);
    expect(res.map).not.toBeNull();
    expect(res.map!.sources?.[0]).toBe(id);
    // sanity: output contains our JSX replacement
    expect(res.code).toContain(
      `<${ICON_COMPONENT_NAME} iconId="ri-BiAlarm" />`,
    );
  });
});
