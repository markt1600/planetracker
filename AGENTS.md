<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Share preview graphic (standing instruction)

Every site or new top-level section built in this project must ship with a link-preview graphic so that pasting its
address into WhatsApp, iMessage or social apps shows a picture, title and description. When creating one:

- Add `opengraph-image.jpg` (1200×630, under 300 KB so WhatsApp accepts it) and `twitter-image.jpg` next to the route's
  `layout.tsx`/`page.tsx`, each with a matching `.alt.txt`. Base the picture on a real screenshot of the site with the
  title set over it, not a generic placeholder.
- Set `metadataBase`, `openGraph` and `twitter` (`summary_large_image`) in that route's `metadata`.
- Verify the built page's `<head>` contains absolute `og:image`, `og:title` and `og:description` tags.
- Regenerate the graphic when the site's name or look changes noticeably.
