import { describe, it, expect } from 'vitest';
import { transformModule } from '../src/core';

describe('transformModule - custom sources option', () => {
  const id = 'CustomSources.tsx';

  it('does nothing if the provided sources do not match the import', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <BiAlarm/>;
    `;
    // Provide a restrictive sources array that excludes react-icons/bi
    const sources = [/^some-other-lib$/];
    const res = transformModule(code, id, () => {}, sources);
    expect(res.anyReplacements).toBe(false);
    expect(res.code).toBe(code);
  });

  it('performs replacement when the provided sources include the pack', () => {
    const code = `
      import { BiAlarm } from 'react-icons/bi';
      export const C = () => <BiAlarm/>;
    `;
    const sources = [/^react-icons\/bi$/];
    const res = transformModule(code, id, () => {}, sources);
    expect(res.anyReplacements).toBe(true);
    expect(res.code).toMatch(/ri-react-icons-bi-BiAlarm/);
  });
});
