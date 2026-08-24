import { PDFDocument, StandardFonts, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CleanHtmlOptions } from './html-cleaner';

const PT_PER_IN = 72;
const PT_PER_CM = PT_PER_IN / 2.54;
const HEADER_SPACE = 14;
const FOOTER_SPACE = 14;

const toPoints = (value: number, unit: 'in' | 'cm'): number =>
  unit === 'in' ? value * PT_PER_IN : value * PT_PER_CM;

// Draw text one character at a time to prevent OpenType GSUB ligature substitution.
// When fontkit sees "fl" together it substitutes the fl-ligature glyph, but pdf-lib's
// ToUnicode CMap can map that glyph back to a wrong character (e.g. "ξ" instead of "fl").
// Drawing each character individually sidesteps the substitution entirely.
const drawChars = (page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number): void => {
  let cx = x;
  for (const char of text) {
    page.drawText(char, { x: cx, y, size, font, color: rgb(0, 0, 0) });
    cx += font.widthOfTextAtSize(char, size);
  }
};

// Width must be calculated the same way we draw: sum of individual character widths.
const charWidth = (text: string, font: PDFFont, size: number): number =>
  [...text].reduce((sum, char) => sum + font.widthOfTextAtSize(char, size), 0);

// ─── Font helpers ────────────────────────────────────────────────────────────

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

const getFont = (fonts: Fonts, bold: boolean, italic: boolean): PDFFont => {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
};

// ─── Inline content model ────────────────────────────────────────────────────
//
// A Segment is the smallest styled piece of text (same font, same run).
// A Word is one or more Segments with no whitespace between them.
// A Token is either a Word, a space boundary, or a forced newline (<br>).

type Segment = { text: string; font: PDFFont; width: number };
type Word = Segment[];
type Token =
  | { kind: 'word'; segments: Segment[] }
  | { kind: 'space' }
  | { kind: 'newline' };

/**
 * Walk a DOM node recursively and produce a flat list of Tokens.
 * Handles <strong>, <b>, <em>, <i>, <span style="…">, <br>, and nesting.
 */
const extractTokens = (
  node: ChildNode,
  fonts: Fonts,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): Token[] => {
  // Text node: split at whitespace boundaries into word/space tokens
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? '';
    const font = getFont(fonts, bold, italic);
    const tokens: Token[] = [];
    for (const part of raw.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        tokens.push({ kind: 'space' });
      } else {
        tokens.push({
          kind: 'word',
          segments: [{ text: part, font, width: charWidth(part, font, fontSize) }],
        });
      }
    }
    return tokens;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') return [{ kind: 'newline' }];

  // Block-level tags should not appear inside inline context, but handle gracefully
  const blockTags = new Set(['div', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);
  if (blockTags.has(tag)) {
    const text = (el.textContent ?? '').trim();
    if (!text) return [];
    const font = getFont(fonts, bold, italic);
    return [{ kind: 'word', segments: [{ text, font, width: charWidth(text, font, fontSize) }] }];
  }

  let b = bold;
  let i = italic;
  if (tag === 'strong' || tag === 'b') b = true;
  if (tag === 'em' || tag === 'i') i = true;
  if (tag === 'span') {
    const style = el.getAttribute('style') ?? '';
    if (/font-weight\s*:\s*(bold|[6-9]\d{2})/.test(style)) b = true;
    if (/font-style\s*:\s*italic/.test(style)) i = true;
  }

  const childTokens: Token[] = [];
  for (const child of Array.from(el.childNodes)) {
    childTokens.push(...extractTokens(child, fonts, fontSize, b, i));
  }
  return mergeAdjacentWords(childTokens);
};

/**
 * Merge consecutive Word tokens (no Space in between) into a single Word with
 * multiple Segments. This handles cases like <strong>hel</strong><em>lo</em>.
 */
const mergeAdjacentWords = (tokens: Token[]): Token[] => {
  const result: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'word') {
      const prev = result[result.length - 1];
      if (prev && prev.kind === 'word') {
        prev.segments = [...prev.segments, ...token.segments];
        continue;
      }
      result.push({ kind: 'word', segments: [...token.segments] });
    } else {
      result.push(token);
    }
  }
  return result;
};

// ─── Line wrapping ───────────────────────────────────────────────────────────

/**
 * Group Tokens into lines. Each line is an array of Words.
 * An empty line array signals a forced line break from a <br>.
 */
const wrapToLines = (tokens: Token[], maxWidth: number, spaceWidth: number): Word[][] => {
  const lines: Word[][] = [];
  let currentLine: Word[] = [];
  let lineWidth = 0;

  for (const token of tokens) {
    if (token.kind === 'newline') {
      lines.push([...currentLine]);
      currentLine = [];
      lineWidth = 0;
      continue;
    }
    if (token.kind === 'space') continue;

    const { segments } = token;
    const wordWidth = segments.reduce((s, seg) => s + seg.width, 0);
    const spaceNeeded = currentLine.length > 0 ? spaceWidth : 0;

    if (currentLine.length > 0 && lineWidth + spaceNeeded + wordWidth > maxWidth) {
      lines.push([...currentLine]);
      currentLine = [segments];
      lineWidth = wordWidth;
    } else {
      currentLine.push(segments);
      lineWidth += spaceNeeded + wordWidth;
    }
  }

  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
};

// ─── Mixed-font line drawing ─────────────────────────────────────────────────

/**
 * Draw one line of Words with optional justification or centering.
 * Justified: all lines except the last expand inter-word spacing.
 * Centered:  all lines are centered (no justification).
 * Plain:     left-aligned with natural spacing.
 */
const drawMixedLine = (
  page: PDFPage,
  words: Word[],
  opts: {
    x: number;
    y: number;
    fontSize: number;
    availWidth: number;
    justify: boolean;
    isLastLine: boolean;
    centered: boolean;
    spaceWidth: number;
  },
) => {
  if (words.length === 0) return;

  const totalWordWidth = words.reduce(
    (sum, w) => sum + w.reduce((s, seg) => s + seg.width, 0),
    0,
  );

  let startX = opts.x;
  let gap = opts.spaceWidth;

  if (opts.centered) {
    const totalWidth = totalWordWidth + Math.max(0, words.length - 1) * opts.spaceWidth;
    startX = opts.x + (opts.availWidth - totalWidth) / 2;
  } else if (opts.justify && !opts.isLastLine && words.length > 1) {
    gap = (opts.availWidth - totalWordWidth) / (words.length - 1);
  }

  let cx = startX;
  for (let wi = 0; wi < words.length; wi++) {
    for (const seg of words[wi]) {
      drawChars(page, seg.text, cx, opts.y, seg.font, opts.fontSize);
      cx += seg.width;
    }
    if (wi < words.length - 1) cx += gap;
  }
};

// ─── Layout context ──────────────────────────────────────────────────────────

interface LayoutContext {
  doc: PDFDocument;
  options: CleanHtmlOptions;
  title: string;
  author: string;
  fonts: Fonts;
  pageWidth: number;
  pageHeight: number;
  currentPage: PDFPage | null;
  pageIndex: number;
  y: number;
  reachedChapterOne: boolean;
  pageIsFresh: boolean;
  storyStarted: boolean;
  lastBlockCentered: boolean;
}

const getMargins = (pageIndex: number, options: CleanHtmlOptions) => {
  const top = toPoints(options.marginTop, options.marginUnit);
  const bottom = toPoints(options.marginBottom, options.marginUnit);

  if (!options.useAlternatingMargins) {
    return { top, bottom, left: toPoints(options.marginLeft, options.marginUnit), right: toPoints(options.marginRight, options.marginUnit) };
  }

  const isOdd = (pageIndex + 1) % 2 === 1;
  const inner = toPoints(options.innerMargin, options.marginUnit);
  const outer = toPoints(options.outerMargin, options.marginUnit);
  return isOdd
    ? { top, bottom, left: inner, right: outer }
    : { top, bottom, left: outer, right: inner };
};

const contentWidth = (ctx: LayoutContext) => {
  const m = getMargins(ctx.pageIndex, ctx.options);
  return ctx.pageWidth - m.left - m.right;
};

const contentLeft = (ctx: LayoutContext) =>
  getMargins(ctx.pageIndex, ctx.options).left;

const shouldShowHeaders = (ctx: LayoutContext) =>
  ctx.options.showHeaders && !(ctx.options.hideHeadersUntilChapter1 && !ctx.reachedChapterOne);

const shouldShowPageNumbers = (ctx: LayoutContext) =>
  ctx.options.showPageNumbers && !(ctx.options.hidePageNumbersUntilChapter1 && !ctx.reachedChapterOne);

const drawHeaderFooter = (ctx: LayoutContext) => {
  if (!ctx.currentPage) return;

  const { options, title, author, pageIndex, currentPage } = ctx;
  const margins = getMargins(pageIndex, options);
  const headerSize = options.fontSize * 0.8;
  const footerSize = options.fontSize * 0.9;
  const isOdd = (pageIndex + 1) % 2 === 1;

  if (shouldShowHeaders(ctx)) {
    const headerText = isOdd ? title : author;
    if (headerText) {
      const font = isOdd ? ctx.fonts.italic : ctx.fonts.regular;
      const textWidth = charWidth(headerText, font, headerSize);
      const x = contentLeft(ctx) + (contentWidth(ctx) - textWidth) / 2;
      const y = ctx.pageHeight - margins.top + 4;
      drawChars(currentPage, headerText, x, y, font, headerSize);
    }
  }

  if (shouldShowPageNumbers(ctx)) {
    const pageNum = String(pageIndex + 1);
    const font = ctx.fonts.regular;
    const textWidth = charWidth(pageNum, font, footerSize);
    const x = contentLeft(ctx) + (contentWidth(ctx) - textWidth) / 2;
    const y = margins.bottom - footerSize - 2;
    drawChars(currentPage, pageNum, x, y, font, footerSize);
  }
};

const newPage = (ctx: LayoutContext) => {
  drawHeaderFooter(ctx);
  // Chapter 1 = first story page (the page after our inserted blank page).
  // Enable headers/footers only after leaving front matter, not on the blank page itself.
  if (ctx.storyStarted && !ctx.reachedChapterOne) ctx.reachedChapterOne = true;
  ctx.pageIndex += 1;
  ctx.currentPage = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  ctx.y = ctx.pageHeight - margins.top - HEADER_SPACE;
  ctx.pageIsFresh = true;
};

// Start a new page only if the current one already has content (or doesn't exist).
// Prevents stacked blank pages when chapter wrappers and headings each request a break.
const ensureFreshPage = (ctx: LayoutContext) => {
  if (!ctx.currentPage || !ctx.pageIsFresh) newPage(ctx);
};

const ensureSpace = (ctx: LayoutContext, neededHeight: number) => {
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const minY = margins.bottom + FOOTER_SPACE;
  if (!ctx.currentPage || ctx.y - neededHeight < minY) newPage(ctx);
};

// ─── High-level paragraph drawing ────────────────────────────────────────────

const CENTERED_BLOCK_EXTRA = 1.0; // extra spacing (× fontSize) before/after a centered block

const isCenteredElement = (el: Element): boolean =>
  el.classList.contains('keep-center') || el.getAttribute('align') === 'center';

interface ParagraphOpts {
  fontSize?: number;
  centered?: boolean;
  justify?: boolean;    // default: true when not centered
  indent?: boolean;     // default: follows options.indentParagraphs
  bold?: boolean;       // base bold state (propagated into inline extraction)
  italic?: boolean;     // base italic state
  spacingBefore?: number;
  spacingAfter?: number;
  paddingLeft?: number; // extra left indent (e.g. blockquote)
}

/**
 * Draw an Element's content with full inline formatting support.
 * Handles nested <strong>, <em>, <b>, <i>, <span style="…">, <br>.
 * Non-centered paragraphs are justified by default.
 */
const drawMixedParagraph = (ctx: LayoutContext, el: Element, opts: ParagraphOpts = {}) => {
  const fontSize = opts.fontSize ?? ctx.options.fontSize;
  const bold = opts.bold ?? false;
  const italic = opts.italic ?? false;
  const centered = opts.centered ?? false;
  const justify = opts.justify ?? !centered;
  const doIndent = !centered && (opts.indent ?? ctx.options.indentParagraphs);
  const indentWidth = doIndent ? fontSize * 2 : 0;
  const paddingLeft = opts.paddingLeft ?? 0;
  const lineHeight = fontSize * ctx.options.lineSpacing;

  let spacingBefore =
    opts.spacingBefore !== undefined
      ? opts.spacingBefore
      : ctx.options.removeParagraphSpacing ? 0 : fontSize * 0.5;
  let spacingAfter = opts.spacingAfter ?? 0;

  // Extra space when a centered block appears amid normal text (epigraphs, quotes, etc.)
  if (centered && opts.spacingBefore === undefined && !ctx.lastBlockCentered) {
    spacingBefore += fontSize * CENTERED_BLOCK_EXTRA;
  }
  if (!centered && opts.spacingBefore === undefined && ctx.lastBlockCentered) {
    spacingBefore += fontSize * CENTERED_BLOCK_EXTRA;
  }
  if (centered && opts.spacingAfter === undefined) {
    spacingAfter = fontSize * CENTERED_BLOCK_EXTRA;
  }

  if (spacingBefore > 0) ctx.y -= spacingBefore;

  const allTokens: Token[] = [];
  for (const child of Array.from(el.childNodes)) {
    allTokens.push(...extractTokens(child, ctx.fonts, fontSize, bold, italic));
  }
  const tokens = mergeAdjacentWords(allTokens);

  if (tokens.filter((t) => t.kind === 'word').length === 0) {
    ctx.lastBlockCentered = centered;
    return;
  }

  const spaceWidth = ctx.fonts.regular.widthOfTextAtSize(' ', fontSize);
  const availWidth = contentWidth(ctx) - paddingLeft;
  const lines = wrapToLines(tokens, availWidth - indentWidth, spaceWidth);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.length === 0) { ctx.y -= lineHeight; continue; } // <br> forced break

    ensureSpace(ctx, lineHeight);

    const isFirst = i === 0;
    const isLastLine = i === lines.length - 1;
    const lineIndent = isFirst ? indentWidth : 0;

    drawMixedLine(ctx.currentPage!, line, {
      x: contentLeft(ctx) + paddingLeft + lineIndent,
      y: ctx.y - fontSize,
      fontSize,
      availWidth: availWidth - lineIndent,
      justify,
      isLastLine,
      centered,
      spaceWidth,
    });

    ctx.y -= lineHeight;
  }

  ctx.pageIsFresh = false;
  ctx.lastBlockCentered = centered;
  if (spacingAfter > 0) ctx.y -= spacingAfter;
};

/**
 * Draw a plain string (no DOM parsing). Used for generated text like title,
 * author name, copyright items, and dinkus where we already have the string.
 */
const drawSimpleText = (
  ctx: LayoutContext,
  text: string,
  opts: { fontSize?: number; font?: PDFFont; centered?: boolean; x?: number; y?: number } = {},
) => {
  const fontSize = opts.fontSize ?? ctx.options.fontSize;
  const font = opts.font ?? ctx.fonts.regular;
  const x =
    opts.x ??
    (opts.centered
      ? contentLeft(ctx) + (contentWidth(ctx) - charWidth(text, font, fontSize)) / 2
      : contentLeft(ctx));
  const y = opts.y ?? ctx.y - fontSize;
  drawChars(ctx.currentPage!, text, x, y, font, fontSize);
  ctx.pageIsFresh = false;
};

// Wrap plain text to fit within maxWidth (used for copyright URLs, etc.)
const wrapTextToLines = (text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = '';

  const pushLongWord = (word: string) => {
    let chunk = '';
    for (const char of word) {
      const test = chunk + char;
      if (charWidth(test, font, fontSize) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = test;
      }
    }
    if (chunk) lines.push(chunk);
  };

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (charWidth(test, font, fontSize) > maxWidth) {
      if (line) {
        lines.push(line);
        if (charWidth(word, font, fontSize) > maxWidth) {
          pushLongWord(word);
          line = '';
        } else {
          line = word;
        }
      } else {
        pushLongWord(word);
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Parse copyright lines directly from the cleaned HTML string (matches what you see in preview).
const parseCopyrightItemsFromHtml = (html: string): { text: string; bold: boolean }[] => {
  const sectionMatch = html.match(/<div class="blank-page-after-title"[^>]*>([\s\S]*?)<\/div>/i);
  const section = sectionMatch?.[1] ?? '';
  if (!section) return [];

  const items: { text: string; bold: boolean }[] = [];
  const re = /<p\s+class="copyright-item([^"]*)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    items.push({
      text,
      bold: /copyright-title|copyright-author/.test(match[1]),
    });
  }
  return items;
};

const collectCopyrightItemsFromBody = (body: Element): { text: string; bold: boolean }[] => {
  const items: { text: string; bold: boolean }[] = [];
  const seen = new Set<string>();

  const add = (el: Element) => {
    const text = el.textContent?.trim() ?? '';
    if (!text || seen.has(text)) return;
    seen.add(text);
    items.push({
      text,
      bold: el.classList.contains('copyright-title') || el.classList.contains('copyright-author'),
    });
  };

  const blank = body.querySelector('.blank-page-after-title');
  if (blank) {
    blank.querySelectorAll('.copyright-item').forEach(add);
    // Items can end up as siblings if HTML parsing breaks the wrapper div
    let sib = blank.nextElementSibling;
    while (sib?.classList.contains('copyright-item')) {
      add(sib);
      sib = sib.nextElementSibling;
    }
  }

  return items;
};

const enrichOptionsFromBody = (options: CleanHtmlOptions, body: Element): CleanHtmlOptions => {
  const meta = body.querySelector('#typesetter-metadata');
  if (!meta) return options;
  return {
    ...options,
    wordCount: options.wordCount || meta.getAttribute('data-word-count') || '',
    fandom: options.fandom || meta.getAttribute('data-fandom') || '',
    warning: options.warning || meta.getAttribute('data-warning') || '',
    publishDate: options.publishDate || meta.getAttribute('data-publish-date') || '',
    completedDate: options.completedDate || meta.getAttribute('data-completed-date') || '',
    ao3Url: options.ao3Url || meta.getAttribute('data-ao3-url') || '',
  };
};

const getCopyrightItemsFromOptions = (ctx: LayoutContext): { text: string; bold: boolean }[] => {
  const { options, title, author } = ctx;
  const shouldShowWarning = !!options.warning && !options.warning.includes('No Archive Warnings Apply');
  const cleanAuthor = author.replace(/^by\s+/i, '');
  const items: { text: string; bold: boolean }[] = [];
  if (title) items.push({ text: title, bold: true });
  if (cleanAuthor) items.push({ text: `by ${cleanAuthor}`, bold: true });
  if (options.fandom) items.push({ text: `Fandom: ${options.fandom}`, bold: false });
  if (shouldShowWarning) items.push({ text: `Warning: ${options.warning!}`, bold: false });
  if (options.wordCount) items.push({ text: `Word Count: ${options.wordCount}`, bold: false });
  if (options.publishDate) items.push({ text: `Published: ${options.publishDate}`, bold: false });
  if (options.completedDate) items.push({ text: `Completed: ${options.completedDate}`, bold: false });
  if (options.ao3Url) items.push({ text: `Original URL: ${options.ao3Url}`, bold: false });
  items.push({ text: `Typeset by yjzhang typesetter ${new Date().toISOString().split('T')[0]}`, bold: false });
  if (options.binderName) items.push({ text: `Binded by: ${options.binderName}`, bold: false });
  return items;
};

// Prefer whichever source has the most items — DOM partial parse was hiding metadata.
const getCopyrightItems = (
  ctx: LayoutContext,
  body: Element,
  cleanedHtml: string,
): { text: string; bold: boolean }[] => {
  const sources = [
    parseCopyrightItemsFromHtml(cleanedHtml),
    collectCopyrightItemsFromBody(body),
    getCopyrightItemsFromOptions(ctx),
  ];
  return sources.reduce((best, cur) => (cur.length > best.length ? cur : best), sources[0]);
};

// ─── Page structure drawing ───────────────────────────────────────────────────

const drawTitlePage = (ctx: LayoutContext, el: Element) => {
  newPage(ctx);
  const titleText = el.querySelector('h1')?.textContent?.trim() || ctx.title;
  const authorText = (el.querySelector('.author')?.textContent?.trim() || ctx.author).replace(/^by\s+/i, '');

  const titleSize = ctx.options.fontSize * 1.8;
  const authorSize = ctx.options.fontSize;
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;

  if (titleText) {
    const y = ctx.pageHeight - margins.top - areaHeight * 0.4;
    drawSimpleText(ctx, titleText, { fontSize: titleSize, font: ctx.fonts.bold, centered: true, y: y - titleSize });
  }
  if (authorText) {
    const y = ctx.pageHeight - margins.top - areaHeight * 0.4 - titleSize * 1.8;
    drawSimpleText(ctx, authorText, { fontSize: authorSize, font: ctx.fonts.regular, centered: true, y: y - authorSize });
  }
};

const drawCopyrightPage = (ctx: LayoutContext, body: Element, cleanedHtml: string) => {
  newPage(ctx);
  const fontSize = ctx.options.fontSize;
  const lineHeight = fontSize * 1.2;
  const itemGap = fontSize * 0.25;
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  const maxWidth = contentWidth(ctx);
  const left = contentLeft(ctx);

  const items = getCopyrightItems(ctx, body, cleanedHtml);
  if (items.length === 0) return;

  let totalHeight = 0;
  for (const item of items) {
    const font = item.bold ? ctx.fonts.bold : ctx.fonts.regular;
    totalHeight += wrapTextToLines(item.text, font, fontSize, maxWidth).length * lineHeight + itemGap;
  }
  const topPadding = Math.max(fontSize * 2, areaHeight - totalHeight - fontSize * 2);
  let y = ctx.pageHeight - margins.top - topPadding;

  for (const item of items) {
    const font = item.bold ? ctx.fonts.bold : ctx.fonts.regular;
    for (const line of wrapTextToLines(item.text, font, fontSize, maxWidth)) {
      drawChars(ctx.currentPage!, line, left, y - fontSize, font, fontSize);
      y -= lineHeight;
      ctx.pageIsFresh = false;
    }
    y -= itemGap;
  }
  ctx.y = y;
};

// Page 3: half-title — just the work title, centered, in book font size, no bold.
const drawHalfTitlePage = (ctx: LayoutContext, el: Element) => {
  newPage(ctx);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  const fontSize = ctx.options.fontSize;

  const titleText =
    el.querySelector('.half-title-text')?.textContent?.trim() || ctx.title;

  if (titleText) {
    const y = ctx.pageHeight - margins.top - (areaHeight - fontSize) / 2;
    drawSimpleText(ctx, titleText, {
      fontSize,
      font: ctx.fonts.regular,
      centered: true,
      y: y - fontSize,
    });
  }
};

const drawBlankPage = (ctx: LayoutContext) => {
  newPage(ctx);
  // Intentional blank — do not reuse this page for the chapter that follows.
  ctx.pageIsFresh = false;
};

const drawDinkus = (ctx: LayoutContext, el: Element) => {
  const text = el.textContent?.trim() || ctx.options.dinkusSymbol;
  const fontSize = ctx.options.fontSize;
  const lineHeight = fontSize * ctx.options.lineSpacing;
  const spacing = fontSize * 0.75;

  ctx.y -= spacing;
  ensureSpace(ctx, lineHeight);
  drawSimpleText(ctx, text, { centered: true, y: ctx.y - fontSize });
  ctx.y -= lineHeight + spacing;
};

const drawChapterHeading = (ctx: LayoutContext, el: Element) => {
  ensureFreshPage(ctx);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  ctx.y = ctx.pageHeight - margins.top - areaHeight * 0.33;

  const headingSize = ctx.options.fontSize * 1.5;

  const headingDiv = el.querySelector('div');
  if (headingDiv) {
    drawMixedParagraph(ctx, headingDiv, {
      fontSize: headingSize,
      centered: true,
      justify: false,
      indent: false,
      bold: true,
      spacingBefore: 0,
    });
  }

  // Subtitle: text nodes at the top level of the wrapper (outside the div)
  const subtitleParts: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent?.trim();
      if (t) subtitleParts.push(t);
    } else if ((child as Element).tagName?.toLowerCase() !== 'div') {
      const t = (child as Element).textContent?.trim();
      if (t) subtitleParts.push(t);
    }
  }
  const subtitle = subtitleParts.join(' ').trim();
  if (subtitle) {
    ctx.y -= headingSize * 0.3;
    ensureSpace(ctx, headingSize * ctx.options.lineSpacing);
    drawSimpleText(ctx, subtitle, {
      fontSize: headingSize * 0.85,
      font: ctx.fonts.regular,
      centered: true,
      y: ctx.y - headingSize * 0.85,
    });
    ctx.y -= headingSize * 0.85 * ctx.options.lineSpacing;
  }

  ctx.y -= headingSize;
};

const drawHeading = (ctx: LayoutContext, el: Element, level: number) => {
  const multipliers = [1.8, 1.5, 1.3, 1.15, 1.1, 1.05];
  const fontSize = ctx.options.fontSize * multipliers[level - 1];

  const inChapter = el.closest('.chapter');
  const isFirstChapterHeading = inChapter && el === inChapter.querySelector('h1, h2, h3, h4, h5, h6');
  if (isFirstChapterHeading) {
    ensureFreshPage(ctx);
    const margins = getMargins(ctx.pageIndex, ctx.options);
    const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
    ctx.y = ctx.pageHeight - margins.top - areaHeight * 0.33;
  }

  drawMixedParagraph(ctx, el, {
    fontSize,
    centered: level <= 2,
    justify: false,
    indent: false,
    bold: true,
    spacingBefore: isFirstChapterHeading ? 0 : fontSize * 0.5,
    spacingAfter: fontSize * 0.4,
  });
};

const drawBlockquote = (ctx: LayoutContext, el: Element) => {
  const fontSize = ctx.options.fontSize;
  const paddingLeft = fontSize * 2;
  const spacingV = ctx.options.removeParagraphSpacing ? 0 : fontSize * 0.5;

  ctx.y -= spacingV;

  const childParas = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'p');
  if (childParas.length > 0) {
    for (const para of childParas) {
      drawMixedParagraph(ctx, para, { italic: true, indent: false, spacingBefore: 0, paddingLeft });
    }
  } else {
    drawMixedParagraph(ctx, el, { italic: true, indent: false, spacingBefore: 0, paddingLeft });
  }

  ctx.y -= spacingV;
};

// ─── Front matter ─────────────────────────────────────────────────────────────

const FRONT_MATTER_CLASSES = ['title-page', 'blank-page-after-title', 'half-title-page', 'blank-page-after-preface'];

const isFrontMatter = (el: Element) => FRONT_MATTER_CLASSES.some((c) => el.classList.contains(c));

const drawFrontMatter = (ctx: LayoutContext, body: Element, cleanedHtml: string) => {
  const titleEl = body.querySelector('.title-page');
  if (titleEl) drawTitlePage(ctx, titleEl);

  drawCopyrightPage(ctx, body, cleanedHtml);

  const halfEl = body.querySelector('.half-title-page');
  if (halfEl) drawHalfTitlePage(ctx, halfEl);

  const blankEl = body.querySelector('.blank-page-after-preface');
  if (blankEl) {
    drawBlankPage(ctx);
    ctx.storyStarted = true;
  }
};

// ─── DOM traversal ────────────────────────────────────────────────────────────

const processElement = (ctx: LayoutContext, el: Element) => {
  if (isFrontMatter(el)) return;
  // Copyright lines are drawn on page 2 only — never as body paragraphs.
  if (el.classList.contains('copyright-item')) return;
  // Work-level AO3 preface is replaced by the half-title page; skip leftovers.
  if (el.classList.contains('preface') && !el.classList.contains('chapter')) return;
  if (el.classList.contains('summary')) { newPage(ctx); processChildren(ctx, el); newPage(ctx); return; }
  if (el.classList.contains('chapter-heading-wrapper')) { drawChapterHeading(ctx, el); return; }
  if (el.classList.contains('dinkus')) { drawDinkus(ctx, el); return; }

  if (el.classList.contains('chapter')) {
    // AO3 wraps each chapter title in `div.chapter.preface` — that is not a new chapter.
    if (el.classList.contains('preface')) {
      processChildren(ctx, el);
      return;
    }
    if (ctx.options.pageBreaks || !ctx.currentPage) ensureFreshPage(ctx);
    processChildren(ctx, el);
    return;
  }

  const tag = el.tagName.toLowerCase();

  if (tag === 'h1') { drawHeading(ctx, el, 1); return; }
  if (tag === 'h2') { drawHeading(ctx, el, 2); return; }
  if (tag === 'h3') { drawHeading(ctx, el, 3); return; }
  if (tag === 'h4') { drawHeading(ctx, el, 4); return; }
  if (tag === 'h5') { drawHeading(ctx, el, 5); return; }
  if (tag === 'h6') { drawHeading(ctx, el, 6); return; }

  if (tag === 'p') {
    if (el.classList.contains('copyright-item')) return;
    const centered = isCenteredElement(el);
    drawMixedParagraph(ctx, el, { centered, indent: !centered });
    return;
  }

  if (tag === 'blockquote') { drawBlockquote(ctx, el); return; }
  if (tag === 'hr') { drawDinkus(ctx, el); return; }

  if (el.children.length > 0) {
    if (isCenteredElement(el)) {
      for (const child of Array.from(el.children)) {
        drawMixedParagraph(ctx, child, { centered: true, indent: false });
      }
      return;
    }
    processChildren(ctx, el);
  } else if (el.textContent?.trim()) {
    const centered = isCenteredElement(el);
    drawMixedParagraph(ctx, el, { centered, indent: !centered });
  }
};

const processChildren = (ctx: LayoutContext, parent: Element) => {
  for (const child of Array.from(parent.children)) {
    processElement(ctx, child);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

const fetchFontBytes = async (path: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await fetch(path);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
};

export const generatePdf = async (cleanedHtml: string, options: CleanHtmlOptions): Promise<Uint8Array> => {
  const body = new DOMParser().parseFromString(cleanedHtml, 'text/html').body;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load EB Garamond from /public/fonts; fall back to built-in Times Roman if unavailable
  const [regularBytes, boldBytes, italicBytes, boldItalicBytes] = await Promise.all([
    fetchFontBytes('/fonts/EBGaramond-Regular.ttf'),
    fetchFontBytes('/fonts/EBGaramond-Bold.ttf'),
    fetchFontBytes('/fonts/EBGaramond-Italic.ttf'),
    fetchFontBytes('/fonts/EBGaramond-BoldItalic.ttf'),
  ]);

  const fonts: Fonts = {
    regular:    regularBytes    ? await pdfDoc.embedFont(regularBytes)    : await pdfDoc.embedFont(StandardFonts.TimesRoman),
    bold:       boldBytes       ? await pdfDoc.embedFont(boldBytes)       : await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    italic:     italicBytes     ? await pdfDoc.embedFont(italicBytes)     : await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    boldItalic: boldItalicBytes ? await pdfDoc.embedFont(boldItalicBytes) : await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
  };

  const title = options.customTitle || body.querySelector('.title-page h1')?.textContent?.trim() || body.querySelector('h1')?.textContent?.trim() || '';
  const author = (options.customAuthor || body.querySelector('.author')?.textContent?.trim() || '').replace(/^by\s+/i, '');
  const enrichedOptions = enrichOptionsFromBody(options, body);

  const ctx: LayoutContext = {
    doc: pdfDoc,
    options: enrichedOptions,
    title,
    author,
    fonts,
    pageWidth: toPoints(options.pageWidth, options.pageUnit),
    pageHeight: toPoints(options.pageHeight, options.pageUnit),
    currentPage: null,
    pageIndex: -1,
    y: 0,
    reachedChapterOne: !options.hidePageNumbersUntilChapter1 && !options.hideHeadersUntilChapter1,
    pageIsFresh: false,
    storyStarted: false,
    lastBlockCentered: false,
  };

  drawFrontMatter(ctx, body, cleanedHtml);
  processChildren(ctx, body);
  drawHeaderFooter(ctx);

  if (pdfDoc.getPageCount() === 0) {
    newPage(ctx);
    drawHeaderFooter(ctx);
  }

  return pdfDoc.save();
};
