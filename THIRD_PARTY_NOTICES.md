# Third-party notices

CowTech GEO v0.1.0 is a self-hosted source distribution. CowTech-owned source is licensed under Apache-2.0; third-party terms are preserved. See [license scope](LICENSE-SCOPE.md).

## GEOFlow-derived workbench

The workbench includes source derived from GEOFlow, Copyright 2026 Yao Jingang. Its original [Apache-2.0 license](workbench/LICENSE) and [NOTICE](workbench/NOTICE) are retained. Modified surviving files carry a CowTech modification notice. Attribution is not an assertion of endorsement.

The comparison baseline is the upstream source at [b865cecaf4830c62f9dec443eeed7d570fbf17ed](https://github.com/yaojingang/GEOFlow/tree/b865cecaf4830c62f9dec443eeed7d570fbf17ed). The license for that exact snapshot was examined; today's upstream licensing must not be substituted for the license of the actual incorporated snapshot. No old Git history or copies of old distributions are included here.

## Directly included browser code

- **Lucide 1.8.0**: the shipped minified artifact exactly matches the official npm package. [ISC and Feather-derived MIT notices](third-party/licenses/bundled/lucide/LICENSE) are preserved together. [Upstream](https://github.com/lucide-icons/lucide).
- **Tailwind CSS 3.4.17 production stylesheet**: the former Play CDN JavaScript bundle is no longer shipped. `workbench/public/css/tailwind.css` is generated from the exact locked npm dependency using the checked-in content configuration and CSS input. The MIT [license](third-party/licenses/bundled/tailwindcss/LICENSE) and generated stylesheet license banner are preserved. Additional [modern-normalize](third-party/licenses/bundled/modern-normalize/LICENSE) and [normalize.css](third-party/licenses/bundled/normalize.css/LICENSE) MIT notices are retained for Preflight normalization ancestry; these are attribution reference copies, not a claim that whole upstream normalizer packages are installed. Build tools execute only during compilation; their JavaScript is not embedded in the stylesheet. See [build and verification](docs/CSS-BUILD.md).

Unused Filament bundles/fonts and site-specific/inspiration-reference theme directories are not included in this distribution. The existing generic site views remain available. No third-party font binary is shipped in this source directory.

## Package dependencies

[DEPENDENCIES.json](third-party/DEPENDENCIES.json) records 440 locked package entries across Composer and npm, including runtime, development/build and optional platform packages. It is an inventory of declarations, not a compatibility certification. Filesystem license texts are stored under `third-party/licenses/`; declaration/README evidence for packages without an available license text is stored under `third-party/license-evidence/`.

The inventory distinguishes packages downloaded during installation from browser assets directly shipped here. The original package notices must also be retained when dependencies or Docker images are redistributed. Operating-system/base-image components are not part of this application-package inventory.

Public upstream authors and their published contact details in dependency metadata are attribution, not CowTech account credentials. Alternative licenses and MPL declarations are retained as declared; the inventory does not silently relabel all dependencies as Apache-2.0.

## Branding

The CowTech name and logo identify this distribution. A software license does not by itself authorize use of third-party trademarks, imply endorsement, or settle branding rights. No separate broad trademark permission is asserted by this document.

## Runtime notice completion (2026-10-04)

All 211 locked runtime records now reference license text and attribution material. The eleven previous gaps were resolved using these distinct methods; they are **not** all recovered standalone upstream LICENSE files:

- `pg-types` and `pgpass`: verbatim full MIT sections, including copyright, from the exact-version README.
- `pusher/pusher-php-server`: original Pusher (2014) and Squeeks (2010) copyright statements from the pinned README, plus the standard MIT text that README references.
- Three `@aws-sdk` packages: their exact-version npm Apache-2.0 declarations and AWS team attribution, together with the AWS SDK monorepo LICENSE/NOTICE pinned to the locked client-s3 release. The small packages do not each ship a separate license file.
- `laravel/sentinel`, `abstract-logging`, `brotli`, `dfa`, `fontkit`: original MIT declarations and published author metadata plus the standard MIT permission/warranty text. `ATTRIBUTION.json` explicitly records this assembly method. No copyright year was invented and no newly assembled file is represented as an upstream-authored file.

This closes the distribution's missing-text/attribution engineering checklist using declared licenses. It does not certify all historical ownership or grant additional rights on behalf of dependency authors. Package source notices remain applicable and must not be removed. Uninstalled optional-platform build packages are inventoried by their lockfile metadata; they are not shipped as binaries in this source distribution.
