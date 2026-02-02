# WordPress to Astro Migration Guide

This document tracks the steps taken to migrate a WordPress blog to Astro with Tailwind CSS, deployed on Vercel.

## Design Goals

Match the original wordpress theme from https://vttvlive.provick.ca.  This was a blog with a corresponding youtube and twitch channel.

## Prerequisites

- Node.js 18+ installed
- WSL (Ubuntu) environment
- WordPress WXR export file (in export folder)

## Step 1: Initialize Astro Project

```bash
# Create new Astro project with blog template
npm create astro@latest . -- --template blog --install --no-git -y

# If created in subdirectory, move files to root
mv retrograde-rotation/* retrograde-rotation/.[!.]* . 2>/dev/null
rmdir retrograde-rotation
```

## Step 2: Install and Configure Tailwind CSS

```bash
# Add Tailwind CSS integration
npx astro add tailwind -y

# Install typography plugin
npm install @tailwindcss/typography
```

## Step 3: Configure Design Tokens

Edit `src/styles/global.css` with:
- Tailwind v4 CSS-based configuration using `@theme`
- Custom color palette (primary, background, text colors)
- Typography plugin customizations for article styling
- WordPress legacy classes (.alignleft, .alignright, .wp-caption, etc.)


## Step 5: Configure Content Collection

Update `src/content.config.ts` to add schema fields:
- `title` (string, required)
- `pubDate` (date, required)
- `description` (string, required)
- `slug` (string, optional)
- `wpSlug` (string, optional) - original WordPress slug
- `wpPostId` (number, optional) - original WordPress post ID
- `tags` (string array, default [])

## Step 6: Install Conversion Dependencies

```bash
npm install --save-dev xml2js turndown
```

## Step 7: Create WordPress Conversion Script

Create `convert-wp.js` in project root that:
1. Parses WordPress WXR (XML) export files
2. Converts HTML content to clean Markdown using Turndown
3. Handles WordPress-specific elements (captions, galleries)
4. Generates unique filenames for duplicate titles (appends date)
5. Creates Vercel redirect rules for old URLs

## Step 8: Export WordPress Content

1. Go to WordPress admin panel
2. Navigate to Tools > Export
3. Select "All content" or "Posts"
4. Click "Download Export File"

## Step 9: Run Conversion

```bash
# WSL path format for Windows downloads
npm run convert "/mnt/c/Users/USERNAME/Downloads/your-export.xml"
```

Output:
- Markdown files in `src/content/blog/`
- `vercel.json` with 301 redirects

## Step 10: Handle Duplicate Titles

Posts with duplicate titles (e.g., "Ugh", "Struggle") are automatically renamed:
- `ugh.md` (first occurrence)
- `ugh-2004-03-31.md` (second occurrence with date)
- `ugh-2005-02-13.md` (third occurrence)

## Step 11: URL Redirects

The conversion script generates `vercel.json` with redirects:
- `/old-slug` → `/blog/new-slug` (root-level posts)
- `/blog/old-slug` → `/blog/new-slug` (renamed duplicates)

All redirects are 301 (permanent) for SEO.

## Step 12: Build and Preview

```bash
# Build the site
npm run build

# Preview locally
npm run dev
```

## Step 13: Deploy to Vercel

```bash
npx vercel
```

## Post-Migration Tasks

### Images
1. Download images and mp3s from WordPress media library
2. Add to `public/images/`
3. Update image paths in Markdown files

### Verify Redirects
Test that old URLs properly redirect:
- `https://yoursite.com/old-post-name`

### SEO
- Verify sitemap at `/sitemap-index.xml`
- Verify RSS feed at `/rss.xml`
- Submit new sitemap to Google Search Console

## File Structure

```
project-root/
├── src/
│   ├── content/
│   │   └── blog/           # Converted Markdown posts
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── styles/
│   │   └── global.css      # Tailwind config + WordPress classes
│   └── content.config.ts   # Content collection schema
├── convert-wp.js           # Conversion script
├── vercel.json             # Redirects for Vercel
└── package.json
```

## Troubleshooting

### Duplicate slugs in build
Ensure the conversion script generates unique slugs for both filenames AND frontmatter.

### Missing fonts
The Inter font is loaded via Google Fonts in global.css.

### WordPress classes not styled
Check that global.css includes `.alignleft`, `.alignright`, `.wp-caption` classes.
