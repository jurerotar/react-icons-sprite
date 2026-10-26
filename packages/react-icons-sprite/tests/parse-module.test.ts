import { expect, test } from 'vitest';
import { createModuleParser } from '../src/transform/parse-module';

test.each([false, true])(
  'parses TSX, directives and Unicode with raw transfer preferred: %s',
  (preferRaw) => {
    const parse = createModuleParser(preferRaw);
    const code =
      '"use client"; const label = "😀"; const Icon = ({ icon }: Props) => <Circle icon={icon} />;';
    const program = parse('Example.tsx', code);
    expect(program?.body[0]).toMatchObject({
      type: 'ExpressionStatement',
      directive: 'use client',
    });
    expect(program?.end).toBe(code.length);
    expect(program?.body.at(-1)?.type).toBe('VariableDeclaration');
    expect(parse('Broken.tsx', 'const x = <Circle')).toBeNull();
  },
);

test('standard and supported raw parsing produce the same ESTree output', () => {
  const code =
    'import { Circle } from "lucide-react"; function Example({ Circle }) { return <Circle />; }';
  expect(createModuleParser(true)('Example.tsx', code)).toEqual(
    createModuleParser(false)('Example.tsx', code),
  );
});
