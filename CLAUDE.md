# VTTV Live Blog - Project Instructions

## Overview

This is the VTTV Live blog, migrated from WordPress to Astro with Tailwind CSS v4. The blog was associated with a YouTube/Twitch channel covering tabletop gaming content (X-Wing, Star Wars Destiny, Imperial Assault, Android Netrunner).

**Original site:** https://vttvlive.provick.ca

## Tech Stack

- **Framework:** Astro 5.x with static output
- **Styling:** Tailwind CSS v4 with `@tailwindcss/typography`
- **Content:** Markdown files with frontmatter in `src/content/blog/`
- **Deployment:** Vercel with 301 redirects for old WordPress URLs

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run convert  # Convert WordPress XML export to Markdown
```

## Project Structure

```
src/
├── content/
│   └── blog/           # Markdown posts (converted from WordPress)
├── layouts/
│   └── BlogPost.astro  # Post layout template
├── pages/
│   ├── blog/
│   │   ├── index.astro      # Blog listing page
│   │   └── [...slug].astro  # Individual post pages
│   └── index.astro          # Homepage
├── styles/
│   └── global.css      # Tailwind v4 config + WordPress legacy classes
└── content.config.ts   # Content collection schema
```

## Content Schema

Posts have this frontmatter structure:

```yaml
---
title: "Post Title"
description: "Short description"
pubDate: "2024-01-15T00:00:00.000Z"
wpSlug: "original-wordpress-slug"    # Optional
wpPostId: 123                         # Optional
tags: ["X-Wing", "Tournament"]        # Optional
---
```

## Styling Notes

- **Design tokens** are defined in `global.css` using Tailwind v4's `@theme` directive
- **WordPress legacy classes** (`.alignleft`, `.alignright`, `.wp-caption`) are preserved for converted content
- **YouTube embeds** use the `.youtube-embed` class for responsive 16:9 aspect ratio
- Primary color: `#0693e3` (cyan blue)
- Accent color: `#9b51e0` (purple)

## WordPress Migration

The `convert-wp.cjs` script handles WordPress WXR exports:

1. Place XML export in `./export/` folder
2. Run `npm run convert`
3. Markdown files are created in `src/content/blog/`
4. `vercel.json` is generated with redirect rules

Duplicate slugs are handled by appending dates (e.g., `post-title-2024-01-15.md`).

## Deployment

The site deploys to Vercel. The `vercel.json` file contains 301 redirects from old WordPress URLs to new Astro paths.
