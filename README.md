# react-icons-sprite

`react-icons-sprite` is a lightweight plugin built on top of [react-icons](https://github.com/react-icons/react-icons). It automatically detects the `react-icons` components you use, generates a single SVG spritesheet containing them, and rewrites your code to reference those symbols via `<use>`. This approach both shrinks your bundle (no more inlined React components for every icon) and reduces runtime overhead, since React no longer has to reconcile large, nested SVG trees.

> [!NOTE]
> Only Vite is currently supported. If you'd like to see a Webpack or Turbopack implementation, please open an issue!

## Motivation

By default, when you use `react-icons`, each icon is a React component. For example:

```tsx
import { LuWheat } from "react-icons/lu";

export function Example() {
  return <LuWheat />;
}
```

looks harmless, but at build time this compiles to something like:

```javascript
import { b as e } from './iconBase-BU3rGdXB.js'

function t(t) {
  return e({
    tag: `svg`, attr: { viewBox: `0 0 640 512` }, child: [{
      tag: `path`, attr: {
        d: `M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z`
      }, child: []
    }]
  })(t)
}

function n(t) {
  return e({
    tag: `svg`, attr: { viewBox: `0 0 496 512` }, child: [{
      tag: `path`, attr: {
        d: `M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z`
      }, child: []
    }]
  })(t)
}

// ... potentially dozens more child components.

export { t, n };
```

That means:

- Every icon adds hundreds of characters of JSX to your bundle.
- At runtime, React must create and diff dozens of DOM nodes for every icon render.
- If you render 100 icons, React is reconciling potentially thousands of <path> elements.

Now compare that to output when using a spritesheet with `<use>`:

```tsx
import { LuWheat } from "react-icons/lu";

export function Example() {
  return <LuWheat />;
}
```

```javascript
import { b as n } from './icon-FONPSuqX.js';

var r = e(t());
const i = () => (0, r.jsx)(n, { iconId: `ri-LuWheat` });
export { i as IconWheat };
```

`icon-FONPSuqX.js` in this case is our simple icon wrapper, which looks like this:

```javascript
var n = e(t());
const r = ({ iconId: e, ...t }) => {
  let r = `assets/react-icons-sprite-C-JClopV.svg#${e}`;
  return (0, n.jsxs)(`svg`, {
    height: `1em`,
    width: `1em`,
    preserveAspectRatio: `xMidYMid meet`,
    viewBox: `0 0 24 24`, ...t,
    children: [(0, n.jsx)(`title`, { children: e }), (0, n.jsx)(`use`, { href: r })]
  })
};
export { r as b };
```

Runtime difference:

- React only reconciles two DOM nodes (`<svg>` + `<use>`).
- All heavy path data lives in the static spritesheet once, not duplicated across components.
- Updating 100 icons is as cheap as updating 100 `<use>` tags.

This is a big win when you’re rendering icons in lists, tables, or maps where dozens or hundreds of them appear at once.

## Installation

Install the plugin via npm or yarn:

```bash
npm install --save-dev react-icons-sprite
```

Only Vite is currently supported. You only need to add the plugin to the `plugins` array.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { reactIconsSprite } from 'react-icons-sprite/vite';

const viteConfig = defineConfig({
  // ... rest of config
  plugins: [
    reactIconsSprite(),
  ],
});
```

## How it works

In **development mode**, the plugin does nothing special. Icons are rendered as they normally would from `react-icons`. This keeps hot module replacement (HMR) snappy — there’s no extra parsing of the codebase or regenerating of the sprite on every save. If the plugin were to build the sprite during dev, it would need to constantly scan for `react-icons` imports and rebuild the sheet, which is expensive and slows down iteration. So, in dev, you get the normal `react-icons` behavior.

In **build mode**, the plugin transforms your code. It parses each module, looks for imports from `react-icons/*`, and rewrites the JSX. Instead of rendering full inline `<svg>` trees, it replaces them with `<ReactIconsSpriteIcon iconId="..." />`. While doing this, it collects every unique icon used across the project. After the bundling step, the plugin renders all those icons once to static markup and generates a single SVG file containing `<symbol>` definitions for each one. Finally, it rewrites your bundle to point every `<ReactIconsSpriteIcon>` at that spritesheet using a `<use>` tag.

The result: during development you keep fast feedback loops, and in production you ship a single optimized sprite file with lightweight `<use>` references.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

