#!/usr/bin/env node
/**
 * WordPress WXR to Astro Markdown Converter
 * Converts WordPress export files to Markdown with frontmatter
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const TurndownService = require('turndown');

// Initialize Turndown for HTML to Markdown conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Custom rules for WordPress-specific elements
turndown.addRule('wpCaption', {
  filter: function (node) {
    return node.nodeName === 'DIV' && node.className.includes('wp-caption');
  },
  replacement: function (content, node) {
    const img = node.querySelector('img');
    const caption = node.querySelector('.wp-caption-text');
    if (img) {
      const alt = caption ? caption.textContent : (img.alt || '');
      return `\n\n![${alt}](${img.src})\n*${alt}*\n\n`;
    }
    return content;
  }
});

// Handle YouTube embeds
turndown.addRule('youtube', {
  filter: function (node) {
    if (node.nodeName === 'IFRAME') {
      const src = node.getAttribute('src') || '';
      return src.includes('youtube.com') || src.includes('youtu.be');
    }
    return false;
  },
  replacement: function (content, node) {
    const src = node.getAttribute('src') || '';
    const match = src.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) {
      return `\n\n<div class="youtube-embed">\n  <iframe src="https://www.youtube.com/embed/${match[1]}" allowfullscreen></iframe>\n</div>\n\n`;
    }
    return '';
  }
});

// Handle WordPress galleries
turndown.addRule('gallery', {
  filter: function (node) {
    return node.nodeName === 'DIV' && node.className.includes('gallery');
  },
  replacement: function (content, node) {
    const images = node.querySelectorAll('img');
    let result = '\n\n';
    images.forEach(img => {
      result += `![${img.alt || ''}](${img.src})\n\n`;
    });
    return result;
  }
});

/**
 * Slugify a string for use as a filename
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Extract the first sentence or first N characters for description
 */
function extractDescription(content, maxLength = 160) {
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Try to get first sentence
  const sentenceMatch = text.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= maxLength) {
    return sentenceMatch[0].trim();
  }

  // Otherwise truncate at word boundary
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

/**
 * Parse WordPress WXR export file
 */
async function parseWxr(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xml);

  const channel = result.rss.channel;
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  return items.filter(item => {
    const postType = item['wp:post_type'];
    const status = item['wp:status'];
    return postType === 'post' && status === 'publish';
  });
}

/**
 * Convert a WordPress post to Markdown
 */
function convertPost(post) {
  const title = post.title || 'Untitled';
  const content = post['content:encoded'] || '';
  const pubDate = post.pubDate || post['wp:post_date'] || new Date().toISOString();
  const wpSlug = post['wp:post_name'] || slugify(title);
  const wpPostId = parseInt(post['wp:post_id'], 10) || null;

  // Extract categories and tags
  const categories = [];
  const tags = [];

  if (post.category) {
    const cats = Array.isArray(post.category) ? post.category : [post.category];
    cats.forEach(cat => {
      if (typeof cat === 'object') {
        if (cat.$.domain === 'category') {
          categories.push(cat._);
        } else if (cat.$.domain === 'post_tag') {
          tags.push(cat._);
        }
      } else {
        categories.push(cat);
      }
    });
  }

  // Convert HTML content to Markdown
  const markdown = turndown.turndown(content);

  // Generate description from content
  const description = extractDescription(content);

  return {
    title,
    description,
    pubDate: new Date(pubDate),
    wpSlug,
    wpPostId,
    tags: [...new Set([...categories, ...tags])],
    content: markdown,
  };
}

/**
 * Generate a unique filename, handling duplicates
 */
function getUniqueFilename(slug, pubDate, usedSlugs) {
  let filename = slug;

  if (usedSlugs.has(slug)) {
    // Append date to make unique
    const dateStr = pubDate.toISOString().split('T')[0];
    filename = `${slug}-${dateStr}`;
  }

  usedSlugs.add(filename);
  return filename;
}

/**
 * Write Markdown file with frontmatter
 */
function writeMarkdown(post, filename, outputDir) {
  const frontmatter = [
    '---',
    `title: "${post.title.replace(/"/g, '\\"')}"`,
    `description: "${post.description.replace(/"/g, '\\"')}"`,
    `pubDate: "${post.pubDate.toISOString()}"`,
    `wpSlug: "${post.wpSlug}"`,
  ];

  if (post.wpPostId) {
    frontmatter.push(`wpPostId: ${post.wpPostId}`);
  }

  if (post.tags.length > 0) {
    frontmatter.push(`tags: [${post.tags.map(t => `"${t}"`).join(', ')}]`);
  }

  frontmatter.push('---', '', post.content);

  const filePath = path.join(outputDir, `${filename}.md`);
  fs.writeFileSync(filePath, frontmatter.join('\n'));

  return filePath;
}

/**
 * Generate Vercel redirect rules
 */
function generateRedirects(posts, filenames) {
  const redirects = [];

  posts.forEach((post, index) => {
    const filename = filenames[index];
    const wpSlug = post.wpSlug;

    // Redirect from old WordPress URL to new URL
    if (wpSlug !== filename) {
      redirects.push({
        source: `/${wpSlug}`,
        destination: `/blog/${filename}`,
        permanent: true,
      });
    }

    // Always add root-level redirect to /blog/
    redirects.push({
      source: `/${wpSlug}`,
      destination: `/blog/${filename}`,
      permanent: true,
    });
  });

  // Remove duplicates
  const unique = redirects.filter((redirect, index, self) =>
    index === self.findIndex(r => r.source === redirect.source)
  );

  return { redirects: unique };
}

/**
 * Main conversion function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Look for XML files in export folder
    const exportDir = path.join(process.cwd(), 'export');
    if (fs.existsSync(exportDir)) {
      const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.xml'));
      if (files.length > 0) {
        args.push(path.join(exportDir, files[0]));
        console.log(`Found export file: ${args[0]}`);
      }
    }
  }

  if (args.length === 0) {
    console.error('Usage: npm run convert <path-to-wordpress-export.xml>');
    console.error('   or: Place XML file in ./export/ folder');
    process.exit(1);
  }

  const inputFile = args[0];

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`Converting: ${inputFile}`);

  // Parse WordPress export
  const posts = await parseWxr(inputFile);
  console.log(`Found ${posts.length} published posts`);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'src', 'content', 'blog');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert and write posts
  const usedSlugs = new Set();
  const convertedPosts = [];
  const filenames = [];

  for (const post of posts) {
    const converted = convertPost(post);
    const filename = getUniqueFilename(converted.wpSlug, converted.pubDate, usedSlugs);

    writeMarkdown(converted, filename, outputDir);
    convertedPosts.push(converted);
    filenames.push(filename);

    console.log(`  ✓ ${filename}.md`);
  }

  // Generate Vercel redirects
  const vercelConfig = generateRedirects(convertedPosts, filenames);
  fs.writeFileSync(
    path.join(process.cwd(), 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  console.log(`\n✓ Generated vercel.json with ${vercelConfig.redirects.length} redirects`);

  console.log(`\n✓ Conversion complete! ${posts.length} posts converted.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
