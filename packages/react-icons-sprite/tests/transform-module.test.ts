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
});
