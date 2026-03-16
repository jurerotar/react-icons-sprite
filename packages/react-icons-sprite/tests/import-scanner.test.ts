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
});
