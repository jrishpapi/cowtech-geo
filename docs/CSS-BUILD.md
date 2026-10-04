# Production CSS build

The workbench no longer executes Tailwind Play CDN in visitors' browsers. It serves a local, precompiled stylesheet. Tailwind is pinned to **3.4.17** to preserve the previous default theme and preflight rather than performing a major-version redesign.

```sh
cd workbench
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

The input is `resources/css/app.css`; `tailwind.config.cjs` scans all Blade views, application PHP class strings, resources JavaScript and public asset JavaScript. Output: `public/css/tailwind.css`. All nine formerly Play-CDN-loading templates reference that stylesheet with a modification-time cache key. The lockfile records npm integrity hashes. Both PHP and nginx Dockerfiles build CSS from these inputs; they do not rely solely on a manually copied output. Docker uses Node 22; no Node process or CSS compiler is required in the final serving containers.

When editing templates or adding class names, rebuild CSS. Use complete literal class names, not string fragments such as `bg-${color}-500`; add explicit safelist values when genuinely necessary. Operator-provided HTML content can use site CSS; arbitrary new Tailwind class names in stored content require a rebuild. The legacy optional Vite development pipeline remains available as `npm run build:vite`; its JavaScript artifacts are not part of this distribution's serving path.

Tailwind MIT text and the output license banner are retained. Build dependencies and any optional platform packages are listed in `third-party/DEPENDENCIES.json`; build JavaScript is not bundled into the generated CSS. This is a source/application dependency inventory, not an OS/base-image SBOM.

Official references: [Tailwind v3 installation](https://v3.tailwindcss.com/docs/installation), [content configuration](https://v3.tailwindcss.com/docs/content-configuration).
