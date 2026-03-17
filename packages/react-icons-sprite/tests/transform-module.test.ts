import { describe, expect, test } from 'vitest';
import { transformModule } from '../src/transform/transform-module';

describe('transformModule', () => {
  test('rewrites icon components and registers used icon', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle } from "lucide-react";\nexport const A = () => <Circle className="w-4" />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('ReactIconsSpriteIcon');
    expect(result.code).toContain('iconId="ri-lucide-react-Circle"');
    expect(result.code).not.toContain('import { Circle } from "lucide-react"');
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Circle' }]);
  });

  test('does not rewrite FontAwesomeIcon from @fortawesome/react-fontawesome', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nexport const A = () => <FontAwesomeIcon icon={undefined} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toContain('FontAwesomeIcon');
    expect(used).toEqual([]);
  });

  test('rewrites FontAwesome icon object usage to sprite component and registers icon', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nimport { faUser } from "@fortawesome/free-solid-svg-icons";\nexport const A = () => <FontAwesomeIcon icon={faUser} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('ReactIconsSpriteIcon');
    expect(result.code).toContain(
      'iconId="ri-fortawesome-free-solid-svg-icons-faUser"',
    );
    expect(result.code).not.toContain('icon={faUser}');
    expect(used).toEqual([
      { pack: '@fortawesome/free-solid-svg-icons', exportName: 'faUser' },
    ]);
  });

  test('ignores FontAwesome string icon usage', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nexport const A = () => <FontAwesomeIcon icon="fa-user" />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toContain('icon="fa-user"');
    expect(used).toEqual([]);
  });
});
