# AGENTS.md

Scope: this file applies to the entire repository.

## Project Overview

This project is a cross-browser extension for exporting Shimo documents to local files. It supports Chrome, Firefox, and Edge, batch export, team spaces, multiple export formats, and preserving folder hierarchy.

Primary stack:

- Manifest V3 browser extension
- Webpack 5
- Vanilla JavaScript
- No Babel and no frontend framework

## Repository Layout

- `src/`: extension source code.
- `src/background.js`: Manifest V3 service worker, core export flow, and Shimo API integration.
- `src/browser.js`: compatibility layer for Chrome/Firefox extension APIs.
- `src/popup.*`: popup UI.
- `src/settings.*`: settings page UI.
- `manifest/`: browser-specific manifests.
- `docs/`: static website, documentation, and blog content.
- `docs/blog/`: blog pages and blog-related scripts.
- `docs/images/`: documentation and blog images.
- `images/`: store and promotional assets.
- `dist/`, `.build-temp/`, `build/`: generated build/package outputs.

Do not edit generated outputs directly.

## Commands

Use these npm scripts from the repository root:

```bash
npm run dev
npm run build
npm run build:all
npm run pack:all
npm run clean
```

Command meanings:

- `npm run dev`: development watch build.
- `npm run build`: build the Chrome version.
- `npm run build:all`: build Chrome, Firefox, and Edge versions.
- `npm run pack:all`: build all browsers and package zip files.
- `npm run clean`: remove generated build outputs.

## Extension Development Rules

- Keep the implementation in vanilla JavaScript unless the user explicitly asks for a larger stack change.
- Do not introduce Babel, a frontend framework, or a new build system without explicit approval.
- Keep `background.js` compatible with the Manifest V3 service worker environment.
- Use `src/browser.js` for browser extension API compatibility instead of calling browser-specific APIs directly when cross-browser behavior matters.
- Preserve the existing Shimo login/cookie assumptions. Export requests depend on the user already being logged in to Shimo.
- Treat `manifest/manifest-chrome.json` as the source of truth for the extension version.
- When comments are needed, prefer concise Chinese comments. Avoid comments that restate obvious code.

## Generated Files

Do not manually edit:

- `node_modules/`
- `dist/`
- `.build-temp/`
- `build/`

Regenerate these paths with npm scripts.

## Docs And Blog Workflow

Blog pages live in `docs/blog/*.html`. For a new blog post, follow the structure, SEO/GEO patterns, and visual style of recent published posts, not only the older template file.

### Blog Research And Content Requirements

- For tutorials, migration guides, comparisons, product recommendations, current limits, or platform-specific instructions, research current official docs and credible sources before writing. Do not rely only on memory for Notion, Feishu, Obsidian, Shimo, browser-store, or platform import/export behavior.
- Prefer practical Chinese SEO topics around Shimo export, backup, migration, format conversion, troubleshooting, team-space permissions, and document workflow migration.
- Target long-tail search intent. Examples: "Shimo to Obsidian migration", "Shimo to Notion import", "Shimo to Feishu Docs migration", "export Shimo Markdown with images", and related Chinese equivalents.
- The article must be actionable. Include a direct answer near the top, a concise AEO/GEO summary, prerequisites, step-by-step workflow, format choices, caveats, failure handling, validation checklist, and FAQ.
- Avoid empty marketing copy. Explain what actually works, what does not migrate cleanly, and what needs manual checking.
- Do not invent product capabilities, hidden APIs, limits, or official support claims. If a workflow is inferred from available import/export formats, state it as an inferred or practical workflow rather than an official one.
- For migration articles, cover source export, local file organization, target import, image/attachment handling, table/spreadsheet handling, permission/history/comment limitations, rollback, and final acceptance checks.
- Keep the article structure consistent with recent posts: top hero image, `aeo-summary`, `answer-block`, practical sections, internal links, visible FAQ, and right-sidebar CTA/components where the existing page pattern uses them.

### Blog SEO And GEO Requirements

For new or substantially changed blog posts:

- Use a descriptive HTML filename with lowercase words separated by hyphens, usually matching the primary keyword and ending in `.html`.
- Include `title`, `meta description`, `keywords`, canonical URL, robots, Open Graph, and Twitter metadata.
- Put the primary keyword naturally in the title, H1, meta description, first answer block, at least one H2, image alt text, and FAQ where appropriate.
- Cover close variants and related entities naturally in headings and body copy. Do not keyword-stuff.
- Include JSON-LD for `BlogPosting`, `BreadcrumbList`, and `FAQPage`; include `HowTo` JSON-LD for tutorial posts when appropriate.
- If `FAQPage` JSON-LD is present, keep a matching visible FAQ section in the article. Do not add schema-only FAQ content.
- Keep article dates consistent across visible metadata, Open Graph article times, and JSON-LD. Use the current publication date in the project timezone unless the user specifies otherwise.
- Use internal links to nearby cluster articles and product pages. Related links should be useful to the reader, not arbitrary.

### Blog Publishing Checklist

When adding a new blog post, update all relevant publishing surfaces in the same change:

- `docs/blog/index.html`: add the post to the latest list and any featured/hub sections when relevant.
- `docs/blog/blog-components.js`: add related-post metadata and short titles.
- `docs/sitemap.xml`: add the page URL and image entry.
- `docs/llms.txt`: add the article entry.
- `docs/blog/cluster-shimo-export/cluster-plan.json`: update the SEO cluster when the article belongs to it.
- `docs/images/`: add the hero image and verify all referenced image paths exist.
- `docs/images/blog-image-prompts.txt`: record the generation prompt, filename, tool, and style notes when a new generated image is created.

### Blog Illustration Requirements

- New blog hero images should use a Google product-illustration style by default: Material Design inspired flat vector illustration, clean geometric shapes, rounded friendly characters, simple document/workspace objects, bright but restrained colors, generous whitespace, and a 16:9 composition.
- The style should feel like a Google help-center or product-marketing illustration: clear, lightweight, optimistic, and diagram-like. It should not look like a 3D render, photorealistic scene, dark glassmorphism dashboard, generic stock image, or cinematic poster.
- Preferred output is `.webp` under `docs/images/`, with a descriptive filename matching the blog slug. Minimum practical size is 1200x675; recent images use about 1672x941.
- Visual concepts should show the real article workflow: cloud documents moving into local folders, Markdown/Word/Excel/PDF files, folder trees, import/export flows, checkmarks, validation dashboards, archives, or target knowledge-base/workspace structures.
- Use a light, clean palette with Google-like accent colors: blue, red/coral, yellow, and green, plus neutral white or very soft gradient backgrounds. Avoid dark dominant palettes and avoid making the entire image one hue.
- A single short English keyword may be used as poster typography when it helps the concept, such as `EXPORT`, `MIGRATE`, `BACKUP`, `FORMAT`, or `FIX`. The word must be large, intentional, and easy to read. Do not include long sentences, fake UI labels, small unreadable text, Chinese interface text, or product names as generated text.
- Do not include brand logos, trademarked app logos, watermarks, exact product screenshots, or fake product UI.
- Avoid 3D, glassmorphism, realistic shadows, photographic lighting, photorealistic people, heavy texture, clutter, and complex backgrounds. If people are used, keep them simple, flat, secondary, and non-identifying.
- Recommended prompt language: "Google Material Design inspired flat vector illustration, clean geometric shapes, friendly rounded characters, bright blue red yellow green accents, soft light background, productivity workflow, 16:9, no 3D, no photorealism, no logos, no screenshots, no small text".
- Every hero image must have a meaningful `alt` attribute in the article and matching Open Graph/Twitter/sitemap image references.

For docs/blog-only changes, validate changed HTML, referenced assets, JSON-LD blocks, and sitemap XML when practical.

## Validation

- Run `npm run build` for extension code changes.
- Run `npm run build:all` when changes affect manifests, browser compatibility, packaging, or release behavior.
- For docs/blog changes, check that edited pages load as static HTML, that referenced images exist, that JSON-LD parses as JSON, and that `docs/sitemap.xml` remains valid XML.
- If a command cannot be run, report that clearly in the final response.

## Git Safety

- The working tree may contain user changes. Do not revert unrelated changes.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless the user explicitly asks for them.
- Do not commit or push unless the user explicitly asks.
