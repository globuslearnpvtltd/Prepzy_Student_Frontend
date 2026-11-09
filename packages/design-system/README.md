# @prepzy/design-system

One configuration file — [`design.config.ts`](./design.config.ts) — controls the styling of every Prepzy app:
colours, typography, spacing, radius, shadows, themes and the look of each component.

## Change the design

1. Edit `design.config.ts`.
2. Run `npm run tokens` from the repo root (it also runs before `dev`, `build` and `storybook`).
3. Check the result in Storybook: `npm run storybook` → http://localhost:6006.

The generator rejects typos (an unknown token such as `radius: 'huge'`, an unknown property, or a default that
isn't a defined variant) and tells you exactly where the mistake is.

| You want to…                      | Add it to                                     | Result                                             |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Add a colour                      | `tokens.colors.<scale>.<step>`                | Utility `bg-<scale>-<step>`, usable in components  |
| Add a meaning ("highlight")       | `semantic.highlight: 'accent.400'`            | Utility `bg-highlight`, overridable per theme      |
| Add a font size / radius / shadow | `tokens.fontSizes` / `radius` / `shadows`     | `text-<name>` / `rounded-<name>` / `shadow-<name>` |
| Rescale page spacing              | `tokens.spacingUnit`                          | All `p-*`, `m-*`, `gap-*` utilities rescale        |
| Add a theme                       | `themes.<name>: { brand: 'info.600' }`        | Apply with `data-theme="<name>"` on any element    |
| Add a component variant           | `components.<name>.variants.<group>.<option>` | New typed prop value, no component code change     |
| Add a component                   | `components.<name>` + a React component       | Styled entirely from the config                    |

Only colours defined in the config exist — Tailwind's default palette (`bg-red-500` …) is switched off, so pages
can't drift from the brand.

## How it works

```
design.config.ts ──► scripts/generate-css.ts ──► src/styles/design-system.css
                                                   ├─ @theme static { --color-*, --text-*, --radius-* … }  (Tailwind utilities)
                                                   ├─ [data-theme="…"] { semantic overrides }
                                                   └─ .pz-button[data-intent="primary"] { … }             (component styles)
```

Components render a class plus `data-*` attributes (`<button class="pz-button" data-intent="primary" data-size="md">`).
Their variant props are inferred from the config, so TypeScript only accepts variants the config defines.
Structural layout that isn't a design decision (e.g. a button is `inline-flex`) lives in `src/styles/structure.css`.

## Use in an app

```css
/* app globals.css */
@import 'tailwindcss';
@import '@prepzy/design-system/styles.css';
@source '../../node_modules/@prepzy/design-system/src';
```

```tsx
import { Button, Card, CardTitle } from '@prepzy/design-system';

<Button intent="secondary" size="lg">
  Start test
</Button>;
```

## Scripts

| Command                   | What it does                                            |
| ------------------------- | ------------------------------------------------------- |
| `npm run generate`        | Regenerate `design-system.css` from the config          |
| `npm test`                | Generator and component tests (incl. "CSS is in sync")  |
| `npm run storybook`       | Component catalogue with theme switcher and a11y checks |
| `npm run build-storybook` | Static catalogue in `storybook-static/`                 |
