import { describe, expect, test } from 'vitest';
import { scanIconImports } from '../src/transform/import-scanner';
import { DEFAULT_ICON_SOURCES } from '../src/packs/icon-resolvers';

describe('scanIconImports', () => {
  test('extracts icon imports from supported packs', () => {
    const code = `
      import { Circle, Square as Box } from "lucide-react";
      import { Foo } from "./local";
    `;

    const scanned = scanIconImports(code, DEFAULT_ICON_SOURCES);
    expect(scanned).toEqual([
      { pack: 'lucide-react', names: ['Circle', 'Box'] },
    ]);
  });

  test('supports default and mixed import specifiers', () => {
    const code = `
      import IconDefault, { Circle as Ring, Square } from "lucide-react";
    `;

    expect(scanIconImports(code, DEFAULT_ICON_SOURCES)).toEqual([
      { pack: 'lucide-react', names: ['IconDefault', 'Ring', 'Square'] },
    ]);
  });

  test('ignores side-effect imports from supported pack', () => {
    const code = `
      import "lucide-react";
    `;

    expect(scanIconImports(code, DEFAULT_ICON_SOURCES)).toEqual([]);
  });

  test('ignores type-only imports from supported packs', () => {
    const code = `
      import type { Circle } from "lucide-react";
      import { type Square, Triangle } from "lucide-react";
    `;

    expect(scanIconImports(code, DEFAULT_ICON_SOURCES)).toEqual([
      { pack: 'lucide-react', names: ['Triangle'] },
    ]);
  });

  test('supports custom global regex sources without lastIndex misses', () => {
    const code = `
      import { Circle } from "lucide-react";
      import { Square } from "lucide-react";
    `;

    expect(scanIconImports(code, [/^lucide-react$/g])).toEqual([
      { pack: 'lucide-react', names: ['Circle'] },
      { pack: 'lucide-react', names: ['Square'] },
    ]);
  });

  test('ignores imports from unsupported packs', () => {
    const code = `
      import { Circle } from "./icons";
      import IconDefault from "some-icons";
    `;

    expect(scanIconImports(code, DEFAULT_ICON_SOURCES)).toEqual([]);
  });
});
