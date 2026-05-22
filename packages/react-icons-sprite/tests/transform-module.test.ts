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

  test('does not generate sourcemaps unless requested', () => {
    const input = `import { Circle } from "lucide-react";\nexport const A = () => <Circle />;`;

    const withoutMap = transformModule(input, 'file.tsx', () => {});
    const withMap = transformModule(input, 'file.tsx', () => {}, undefined, {
      sourceMap: true,
    });

    expect(withoutMap.map).toBeNull();
    expect(withMap.map).not.toBeNull();
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
    expect(result.code).not.toContain('@fortawesome/react-fontawesome');
    expect(result.code).not.toContain('@fortawesome/free-solid-svg-icons');
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

  test('ignores FontAwesomeIcon with string icon prop in JSX expression', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nexport const A = () => <FontAwesomeIcon icon={"coffee"} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toContain('icon={"coffee"}');
    expect(used).toEqual([]);
  });

  test('rewrites aliased icon component usages and deduplicates registration', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle as Ring } from "lucide-react";\nexport const A = () => <><Ring /><Ring></Ring></>;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('iconId="ri-lucide-react-Circle"');
    expect(result.code).not.toContain('Ring');
    expect(used).toEqual([
      { pack: 'lucide-react', exportName: 'Circle' },
      { pack: 'lucide-react', exportName: 'Circle' },
    ]);
  });

  test('does not add a duplicate iconId prop', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle } from "lucide-react";\nexport const A = () => <Circle iconId="custom" />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code.match(/iconId=/g)).toHaveLength(1);
    expect(result.code).toContain('<ReactIconsSpriteIcon iconId="custom" />');
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Circle' }]);
  });

  test('rewrites default imported icon component usages', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import CircleIcon from "lucide-react";\nexport const A = () => <CircleIcon />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('iconId="ri-lucide-react-default"');
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'default' }]);
  });

  test('does not rewrite when imported icons are never used in JSX', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle } from "lucide-react";\nconst x = Circle;\nexport const A = () => <div />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toBe(input);
    expect(used).toEqual([]);
  });

  test('keeps unrelated specifiers while removing used icon import declaration', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle } from "lucide-react";\nimport { helper } from "./helper";\nexport const A = () => <Circle data-x={helper()} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('import { helper } from "./helper";');
    expect(result.code).not.toContain('import { Circle } from "lucide-react";');
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Circle' }]);
  });

  test('removes only rewritten specifiers from mixed icon imports', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle, Square, Triangle as Warning } from "lucide-react";\nconst kept = Square;\nexport const A = () => <Warning />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain(
      'import { Circle, Square } from "lucide-react";',
    );
    expect(result.code).toContain('const kept = Square;');
    expect(result.code).not.toContain('Triangle as Warning');
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Triangle' }]);
  });

  test('keeps existing sprite import and does not duplicate it', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { ReactIconsSpriteIcon } from "react-icons-sprite";\nimport { Circle } from "lucide-react";\nexport const A = () => <Circle />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(
      result.code.match(
        /import \{ ReactIconsSpriteIcon \} from "react-icons-sprite";/g,
      ),
    ).toHaveLength(1);
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Circle' }]);
  });

  test('uses existing aliased sprite import local name', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { ReactIconsSpriteIcon as Icon } from "react-icons-sprite";\nimport { Circle } from "lucide-react";\nexport const A = () => <Circle />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain('<Icon iconId="ri-lucide-react-Circle" />');
    expect(result.code).not.toContain('<ReactIconsSpriteIcon');
    expect(result.code.match(/from "react-icons-sprite"/g)).toHaveLength(1);
    expect(used).toEqual([{ pack: 'lucide-react', exportName: 'Circle' }]);
  });

  test('ignores type-only icon source imports', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import type { Circle } from "lucide-react";\nexport const A = () => <Circle />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toBe(input);
    expect(used).toEqual([]);
  });

  test('does not rewrite FontAwesome icon attribute when expression is not an identifier', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nimport { faUser } from "@fortawesome/free-solid-svg-icons";\nexport const A = () => <FontAwesomeIcon icon={faUser.iconName} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toContain('icon={faUser.iconName}');
    expect(used).toEqual([]);
  });

  test('rewrites aliased FontAwesome component local import', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon as FA } from "@fortawesome/react-fontawesome";\nimport { faUser } from "@fortawesome/free-solid-svg-icons";\nexport const A = () => <FA icon={faUser} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain(
      'iconId="ri-fortawesome-free-solid-svg-icons-faUser"',
    );
    expect(result.code).not.toContain('icon={faUser}');
    expect(result.code).not.toContain('@fortawesome/react-fontawesome');
    expect(used).toEqual([
      { pack: '@fortawesome/free-solid-svg-icons', exportName: 'faUser' },
    ]);
  });

  test('keeps unrelated FontAwesome component import specifiers', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { FontAwesomeIcon, SomethingElse } from "@fortawesome/react-fontawesome";\nimport { faUser } from "@fortawesome/free-solid-svg-icons";\nconst kept = SomethingElse;\nexport const A = () => <FontAwesomeIcon icon={faUser} />;`;

    const result = transformModule(input, 'file.tsx', (pack, exportName) => {
      used.push({ pack, exportName });
    });

    expect(result.anyReplacements).toBe(true);
    expect(result.code).toContain(
      'import { SomethingElse } from "@fortawesome/react-fontawesome";',
    );
    expect(result.code).toContain('const kept = SomethingElse;');
    expect(result.code).not.toContain('FontAwesomeIcon');
    expect(used).toEqual([
      { pack: '@fortawesome/free-solid-svg-icons', exportName: 'faUser' },
    ]);
  });

  test('does not rewrite custom source imports when sources do not match', () => {
    const used: Array<{ pack: string; exportName: string }> = [];
    const input = `import { Circle } from "lucide-react";\nexport const A = () => <Circle />;`;

    const result = transformModule(
      input,
      'file.tsx',
      (pack, exportName) => {
        used.push({ pack, exportName });
      },
      [/^custom-icons$/],
    );

    expect(result.anyReplacements).toBe(false);
    expect(result.code).toBe(input);
    expect(used).toEqual([]);
  });
});
