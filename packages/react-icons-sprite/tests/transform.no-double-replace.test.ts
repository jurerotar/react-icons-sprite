import { describe, it, expect } from 'vitest';
import { ICON_COMPONENT_NAME, ICON_SOURCE, transformModule } from '../src/core';

describe('transformModule - no double replacement when sprite component is already used', () => {
  const id = 'AlreadyIcon.tsx';

  it('leaves existing ReactIconsSpriteIcon JSX intact', () => {
    const code = `
      import { ${ICON_COMPONENT_NAME} } from '${ICON_SOURCE}';
      export const C = () => <${ICON_COMPONENT_NAME} iconId="ri-x" data-y={2}/>;
    `;

    const res = transformModule(code, id, () => {});
    // No replacements should occur because there are no react-icons usages
    expect(res.anyReplacements).toBe(false);
    expect(res.code).toBe(code);
  });
});
