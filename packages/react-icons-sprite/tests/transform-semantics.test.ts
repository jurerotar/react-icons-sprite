import { parse } from '@babel/parser';
import { expect, test } from 'vitest';
import { transformWithOxc } from 'vite';
import { transformModule } from '../src/transform/transform-module';

const transform = (code: string) => {
  const used: string[] = [];
  const result = transformModule(code, 'Example.tsx', (pack, name) =>
    used.push(`${pack}:${name}`),
  );
  expect(() =>
    parse(result.code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    }),
  ).not.toThrow();
  return { ...result, used };
};

test.each([
  'const text = "<Circle />";',
  "const text = '<Circle />';",
  'const text = `<Circle />`;',
  'const pattern = /<Circle \\/>/;',
  '// <Circle />\nconst text = 1;',
  '/* <Circle /> */ const text = 1;',
  'const element = <div title="<Circle />" />;',
  'const element = <div>{"<Circle />"}</div>;',
])('preserves JSX-looking text: %s', (literal) => {
  const input = `import { Circle } from 'lucide-react';\n${literal}`;
  expect(transform(input)).toMatchObject({
    code: input,
    anyReplacements: false,
    used: [],
  });
  const mixed = transform(`${input}\nexport const Actual = () => <Circle />;`);
  expect(mixed.code).toContain(literal);
  expect(mixed.used).toEqual(['lucide-react:Circle']);
});

test.each([
  "// import { Circle } from 'lucide-react';\n",
  "/* import { Circle } from 'lucide-react'; */\n",
  'const text = "import { Circle } from \'lucide-react\';";\n',
])('ignores imports inside text: %s', (prefix) => {
  const input = `${prefix}export const Example = () => <Circle />;`;
  expect(transform(input)).toMatchObject({
    code: input,
    anyReplacements: false,
    used: [],
  });
});

test.each([
  'function Example(Circle) { return <Circle />; }',
  'function Example({ Circle }) { return <Circle></Circle>; }',
  'const Example = ({ icon: Circle }) => <Circle />;',
  'const Example = (Circle = fallback) => <Circle />;',
  'function Example() { const Circle = local; return <Circle />; }',
  'function Example() { return <Circle />; var Circle = local; }',
  'function Example() { return <Circle />; function Circle() {} }',
  'function Example() { { let Circle = local; return <Circle />; } }',
  'function Example() { try {} catch (Circle) { return <Circle />; } }',
  'function Example() { for (const Circle of icons) { render(<Circle />); } }',
  'const Example = function Circle() { return <Circle />; };',
  'const Example = (Circle) => <Button icon={Circle} />;',
])('preserves shadowed bindings: %s', (shadowed) => {
  const input = `import { Circle } from 'lucide-react';\n${shadowed}`;
  expect(transform(input)).toMatchObject({
    code: input,
    anyReplacements: false,
    used: [],
  });
  const mixed = transform(`${input}\nexport const Actual = () => <Circle />;`);
  expect(mixed.code).toContain(shadowed);
  expect(mixed.used).toEqual(['lucide-react:Circle']);
});

test('transforms real JSX inside template expressions while preserving template text', () => {
  const result = transform(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This fixture contains literal template syntax.
    "import { Circle } from 'lucide-react';\nconst text = `<Circle /> ${render(<Circle />)}`;",
  );
  expect(result.code).toContain('`<Circle /> ${render(<ReactIconsSpriteIcon');
  expect(result.used).toEqual(['lucide-react:Circle']);
});

test('keeps member-expression and exported icon references alive', () => {
  const result = transform(
    "import { Circle } from 'lucide-react';\nexport { Circle };\nexport const Example = () => <><Circle /><Circle.Other /></>;",
  );
  expect(result.code).toContain("import { Circle } from 'lucide-react';");
  expect(result.code).toContain('export { Circle }');
  expect(result.code).toContain('<Circle.Other />');
});

test.each([
  [
    '@fortawesome/react-fontawesome',
    'FontAwesomeIcon',
    '@fortawesome/free-solid-svg-icons',
    'faUser',
  ],
  [
    '@hugeicons/react',
    'HugeiconsIcon',
    '@hugeicons/core-free-icons',
    'SearchIcon',
  ],
])(
  'preserves shadowed wrappers and definition references for %s',
  (pack, component, iconPack, icon) => {
    const header = `import { ${component} } from "${pack}";\nimport { ${icon} } from "${iconPack}";\n`;
    for (const binding of [component, icon]) {
      const shadowed = `function Example(${binding}) { return <${component} icon={${icon}} />; }`;
      const result = transform(
        header +
          shadowed +
          `\nexport const Actual = () => <${component} icon={${icon}} />;`,
      );
      expect(result.code).toContain(shadowed);
      expect(result.used).toEqual([`${iconPack}:${icon}`]);
    }
    const untouched = `<${component} icon="coffee" />`;
    const result = transform(
      header +
        `export const Example = () => <><${component} icon={${icon}} />${untouched}</>;`,
    );
    expect(result.code).toContain(untouched);
    expect(result.code).toContain(`import { ${component} }`);
  },
);

test('avoids imported sprite aliases shadowed in a nested scope', () => {
  const result = transform(
    'import { ReactIconsSpriteIcon as Icon } from "react-icons-sprite";\nimport { Circle } from "lucide-react";\nexport function Example(Icon) { return <Circle />; }',
  );
  expect(result.code).toContain(
    'ReactIconsSpriteIcon as ReactIconsSpriteIcon1',
  );
  expect(result.code).toContain('<ReactIconsSpriteIcon1 iconId=');
});

test('avoids collisions with existing local component names', () => {
  const result = transform(
    'import { Circle } from "lucide-react";\nfunction ReactIconsSpriteIcon() {}\nexport const Example = () => <Circle />;',
  );
  expect(result.code).toContain(
    'ReactIconsSpriteIcon as ReactIconsSpriteIcon1',
  );
  expect(result.code).toContain('function ReactIconsSpriteIcon() {}');
});

test('keeps directive prologues and hashbangs before the inserted import', () => {
  const result = transform(
    '#!/usr/bin/env node\n"use client";\nimport { Circle } from "lucide-react";\nexport const Example = () => <Circle />;',
  );
  expect(
    result.code.startsWith('#!/usr/bin/env node\n"use client";\nimport'),
  ).toBe(true);
});

test('leaves unsupported syntax unchanged without registering icons', () => {
  const input =
    'import { Circle } from "lucide-react"; export const Example = () => <Circle';
  const used: string[] = [];
  expect(
    transformModule(input, 'Example.tsx', (_, name) => used.push(name)),
  ).toMatchObject({ code: input, anyReplacements: false });
  expect(used).toEqual([]);
});

test('compiles transformed mixed TSX with an independent compiler', async () => {
  const input = `import { Circle, X } from 'lucide-react';
const kept = X;
export function Example({ Circle }: { Circle: any }) {
  return <Circle />;
}
export const Actual = () => <Button icon={X}><Circle /></Button>;`;
  for (const sourceMap of [false, true]) {
    const result = transformModule(input, 'Example.tsx', () => {}, undefined, {
      sourceMap,
    });
    const compiled = await transformWithOxc(result.code, 'Example.tsx');
    expect(compiled.code).toContain('ri-lucide-react-Circle');
    expect(compiled.code).toContain('ri-lucide-react-X');
    expect(result.code).toContain('return <Circle />;');
    expect(result.code).toContain('const kept = X;');
  }
});
