import { expect, test } from 'vitest';
import { fastFilter } from '../src/transform/fast-filter';

test.each([
  'import{Circle}from"lucide-react";const A=()=> <Circle/>;',
  'import/* comment */{Circle}from"lucide-react";const A=()=> <Circle/>;',
  'import\n{Circle}from"lucide-react";const A=()=> <Circle/>;',
])('retains compact and commented import declarations: %s', (code) => {
  expect(fastFilter(code)).toBe(true);
});

test('skips runtime code containing important and JSX-like strings', () => {
  expect(
    fastFilter('style.setProperty("display", "<none>", "important");'),
  ).toBe(false);
});
