import { PDFDocument, StandardFonts, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { CleanHtmlOptions } from './html-cleaner';

const PT_PER_IN = 72;
const PT_PER_CM = PT_PER_IN / 2.54;
const HEADER_SPACE = 14;
const FOOTER_SPACE = 14;

function toPoints(value: number, unit: 'in' | 'cm'): number {
  return unit === 'in' ? value * PT_PER_IN : value * PT_PER_CM;
}

// ─── Font helpers ────────────────────────────────────────────────────────────

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

function getFont(fonts: Fonts, bold: boolean, italic: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

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
function extractTokens(
  node: ChildNode,
  fonts: Fonts,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): Token[] {
  // Text node: split at whitespace boundaries into word/space tokens
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? '';
    const font = getFont(fonts, bold, italic);
    const parts = raw.split(/(\s+)/);
    const tokens: Token[] = [];
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        tokens.push({ kind: 'space' });
      } else {
        tokens.push({
          kind: 'word',
          segments: [{ text: part, font, width: font.widthOfTextAtSize(part, fontSize) }],
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
    return [{ kind: 'word', segments: [{ text, font, width: font.widthOfTextAtSize(text, fontSize) }] }];
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
  // Adjacent word tokens with no space between them belong to the same word
  return mergeAdjacentWords(childTokens);
}

/**
 * Merge consecutive Word tokens (no Space in between) into a single Word with
 * multiple Segments. This handles cases like <strong>hel</strong><em>lo</em>.
 */
function mergeAdjacentWords(tokens: Token[]): Token[] {
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
}

// ─── Line wrapping ───────────────────────────────────────────────────────────

/**
 * Group Tokens into lines. Each line is an array of Words.
 * An empty line array signals a forced line break from a <br>.
 */
function wrapToLines(tokens: Token[], maxWidth: number, spaceWidth: number): Word[][] {
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
}

// ─── Mixed-font line drawing ─────────────────────────────────────────────────

/**
 * Draw one line of Words with optional justification or centering.
 * Justified: all lines except the last expand inter-word spacing.
 * Centered:  all lines are centered (no justification).
 * Plain:     left-aligned with natural spacing.
 */
function drawMixedLine(
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
) {
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
    const totalSpace = opts.availWidth - totalWordWidth;
    gap = totalSpace / (words.length - 1);
  }

  let cx = startX;
  for (let wi = 0; wi < words.length; wi++) {
    for (const seg of words[wi]) {
      page.drawText(seg.text, {
        x: cx,
        y: opts.y,
        size: opts.fontSize,
        font: seg.font,
        color: rgb(0, 0, 0),
      });
      cx += seg.width;
    }
    if (wi < words.length - 1) cx += gap;
  }
}

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
}

function getMargins(pageIndex: number, options: CleanHtmlOptions) {
  const top = toPoints(options.marginTop, options.marginUnit);
  const bottom = toPoints(options.marginBottom, options.marginUnit);

  if (!options.useAlternatingMargins) {
    return {
      top,
      bottom,
      left: toPoints(options.marginLeft, options.marginUnit),
      right: toPoints(options.marginRight, options.marginUnit),
    };
  }

  const isOdd = (pageIndex + 1) % 2 === 1;
  const inner = toPoints(options.innerMargin, options.marginUnit);
  const outer = toPoints(options.outerMargin, options.marginUnit);
  return isOdd
    ? { top, bottom, left: inner, right: outer }
    : { top, bottom, left: outer, right: inner };
}

function contentWidth(ctx: LayoutContext) {
  const m = getMargins(ctx.pageIndex, ctx.options);
  return ctx.pageWidth - m.left - m.right;
}

function contentLeft(ctx: LayoutContext) {
  return getMargins(ctx.pageIndex, ctx.options).left;
}

function shouldShowHeaders(ctx: LayoutContext) {
  if (!ctx.options.showHeaders) return false;
  if (ctx.options.hideHeadersUntilChapter1 && !ctx.reachedChapterOne) return false;
  return true;
}

function shouldShowPageNumbers(ctx: LayoutContext) {
  if (!ctx.options.showPageNumbers) return false;
  if (ctx.options.hidePageNumbersUntilChapter1 && !ctx.reachedChapterOne) return false;
  return true;
}

function drawHeaderFooter(ctx: LayoutContext) {
  if (!ctx.currentPage) return;

  const { options, title, author, pageIndex, currentPage } = ctx;
  const margins = getMargins(pageIndex, options);
  const headerSize = options.fontSize * 0.8;
  const footerSize = options.fontSize * 0.9;
  const isOdd = (pageIndex + 1) % 2 === 1;

  if (shouldShowHeaders(ctx)) {
    const headerText = isOdd ? title : author;
    if (headerText) {
      const font = ctx.fonts.italic;
      const textWidth = font.widthOfTextAtSize(headerText, headerSize);
      const x = contentLeft(ctx) + (contentWidth(ctx) - textWidth) / 2;
      const y = ctx.pageHeight - margins.top + 4;
      currentPage.drawText(headerText, { x, y, size: headerSize, font, color: rgb(0, 0, 0) });
    }
  }

  if (shouldShowPageNumbers(ctx)) {
    const pageNum = String(pageIndex + 1);
    const font = ctx.fonts.regular;
    const textWidth = font.widthOfTextAtSize(pageNum, footerSize);
    const x = contentLeft(ctx) + (contentWidth(ctx) - textWidth) / 2;
    const y = margins.bottom - footerSize - 2;
    currentPage.drawText(pageNum, { x, y, size: footerSize, font, color: rgb(0, 0, 0) });
  }
}

function newPage(ctx: LayoutContext) {
  drawHeaderFooter(ctx);
  ctx.pageIndex += 1;
  ctx.currentPage = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  ctx.y = ctx.pageHeight - margins.top - HEADER_SPACE;
}

function ensureSpace(ctx: LayoutContext, neededHeight: number) {
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const minY = margins.bottom + FOOTER_SPACE;
  if (!ctx.currentPage || ctx.y - neededHeight < minY) {
    newPage(ctx);
  }
}

// ─── High-level paragraph drawing ────────────────────────────────────────────

interface ParagraphOpts {
  fontSize?: number;
  centered?: boolean;
  justify?: boolean;   // default: true when not centered
  indent?: boolean;    // default: follows options.indentParagraphs
  bold?: boolean;      // base bold state (propagated into inline extraction)
  italic?: boolean;    // base italic state
  spacingBefore?: number;
  spacingAfter?: number;
  paddingLeft?: number; // extra left indent (e.g. blockquote)
}

/**
 * Draw an Element's content with full inline formatting support.
 * Handles nested <strong>, <em>, <b>, <i>, <span style="…">, <br>.
 * Non-centered paragraphs are justified by default.
 */
function drawMixedParagraph(ctx: LayoutContext, el: Element, opts: ParagraphOpts = {}) {
  const fontSize = opts.fontSize ?? ctx.options.fontSize;
  const bold = opts.bold ?? false;
  const italic = opts.italic ?? false;
  const centered = opts.centered ?? false;
  const justify = opts.justify ?? !centered;
  const doIndent = !centered && (opts.indent ?? ctx.options.indentParagraphs);
  const indentWidth = doIndent ? fontSize * 2 : 0;
  const paddingLeft = opts.paddingLeft ?? 0;
  const lineHeight = fontSize * ctx.options.lineSpacing;

  const spacingBefore =
    opts.spacingBefore !== undefined
      ? opts.spacingBefore
      : ctx.options.removeParagraphSpacing
      ? 0
      : fontSize * 0.5;
  if (spacingBefore > 0) ctx.y -= spacingBefore;

  // Collect tokens from all child nodes
  const allTokens: Token[] = [];
  for (const child of Array.from(el.childNodes)) {
    allTokens.push(...extractTokens(child, ctx.fonts, fontSize, bold, italic));
  }
  const tokens = mergeAdjacentWords(allTokens);

  if (tokens.filter((t) => t.kind === 'word').length === 0) return;

  const spaceWidth = ctx.fonts.regular.widthOfTextAtSize(' ', fontSize);
  const availWidth = contentWidth(ctx) - paddingLeft;
  const lines = wrapToLines(tokens, availWidth - indentWidth, spaceWidth);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line = <br> forced break
    if (line.length === 0) {
      ctx.y -= lineHeight;
      continue;
    }

    ensureSpace(ctx, lineHeight);

    const isFirst = i === 0;
    const isLastLine = i === lines.length - 1;
    const lineIndent = isFirst ? indentWidth : 0;
    const lineX = contentLeft(ctx) + paddingLeft + lineIndent;
    const lineAvailWidth = availWidth - lineIndent;

    drawMixedLine(ctx.currentPage!, line, {
      x: lineX,
      y: ctx.y - fontSize,
      fontSize,
      availWidth: lineAvailWidth,
      justify,
      isLastLine,
      centered,
      spaceWidth,
    });

    ctx.y -= lineHeight;
  }

  if (opts.spacingAfter) ctx.y -= opts.spacingAfter;
}

/**
 * Draw a plain string (no DOM parsing). Used for generated text like title,
 * author name, copyright items, and dinkus where we already have the string.
 */
function drawSimpleText(
  ctx: LayoutContext,
  text: string,
  opts: {
    fontSize?: number;
    font?: PDFFont;
    centered?: boolean;
    x?: number;
    y?: number;
  } = {},
) {
  const fontSize = opts.fontSize ?? ctx.options.fontSize;
  const font = opts.font ?? ctx.fonts.regular;
  const x =
    opts.x ??
    (opts.centered
      ? contentLeft(ctx) + (contentWidth(ctx) - font.widthOfTextAtSize(text, fontSize)) / 2
      : contentLeft(ctx));
  const y = opts.y ?? ctx.y - fontSize;
  ctx.currentPage!.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
}

// ─── Page structure drawing ───────────────────────────────────────────────────

function drawTitlePage(ctx: LayoutContext, el: Element) {
  newPage(ctx);
  const h1 = el.querySelector('h1');
  const authorEl = el.querySelector('.author');
  const titleText = h1?.textContent?.trim() || ctx.title;
  const authorText = (authorEl?.textContent?.trim() || ctx.author).replace(/^by\s+/i, '');

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
    drawSimpleText(ctx, authorText, { fontSize: authorSize, font: ctx.fonts.italic, centered: true, y: y - authorSize });
  }
}

function drawCopyrightPage(ctx: LayoutContext, el: Element) {
  newPage(ctx);
  const items = el.querySelectorAll('.copyright-item');
  const fontSize = ctx.options.fontSize;
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  let y = ctx.pageHeight - margins.top - areaHeight * 0.7;

  items.forEach((item) => {
    const text = item.textContent?.trim();
    if (!text) return;
    const isBold =
      item.classList.contains('copyright-title') || item.classList.contains('copyright-author');
    const font = isBold ? ctx.fonts.bold : ctx.fonts.regular;
    ctx.currentPage!.drawText(text, {
      x: contentLeft(ctx),
      y: y - fontSize,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= fontSize * 1.4;
  });
}

function drawPrefacePage(ctx: LayoutContext, el: Element) {
  newPage(ctx);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  ctx.y = ctx.pageHeight - margins.top - areaHeight * 0.4;

  for (const child of Array.from(el.children)) {
    drawMixedParagraph(ctx, child, { centered: true, indent: false, spacingBefore: 0 });
  }
}

function drawBlankPage(ctx: LayoutContext) {
  newPage(ctx);
}

function drawDinkus(ctx: LayoutContext, el: Element) {
  const text = el.textContent?.trim() || ctx.options.dinkusSymbol;
  const fontSize = ctx.options.fontSize;
  const lineHeight = fontSize * ctx.options.lineSpacing;
  const spacing = fontSize * 0.75;

  ctx.y -= spacing;
  ensureSpace(ctx, lineHeight);
  drawSimpleText(ctx, text, { centered: true, y: ctx.y - fontSize });
  ctx.y -= lineHeight;
  ctx.y -= spacing;
}

function drawChapterHeading(ctx: LayoutContext, el: Element) {
  newPage(ctx);
  const margins = getMargins(ctx.pageIndex, ctx.options);
  const areaHeight = ctx.pageHeight - margins.top - margins.bottom;
  ctx.y = ctx.pageHeight - margins.top - areaHeight * 0.33;

  const headingSize = ctx.options.fontSize * 1.5;

  // The wrapper contains a <div><strong>Chapter N</strong></div> and optionally
  // a text node or sibling elements for the subtitle.
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

  ctx.y -= headingSize; // breathing room after heading
}

function drawHeading(ctx: LayoutContext, el: Element, level: number) {
  const multipliers = [1.8, 1.5, 1.3, 1.15, 1.1, 1.05];
  const fontSize = ctx.options.fontSize * multipliers[level - 1];

  // First heading inside a .chapter gets its own page, positioned at 1/3
  const inChapter = el.closest('.chapter');
  const isFirstChapterHeading =
    inChapter && el === inChapter.querySelector('h1, h2, h3, h4, h5, h6');
  if (isFirstChapterHeading) {
    newPage(ctx);
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
}

function drawBlockquote(ctx: LayoutContext, el: Element) {
  const fontSize = ctx.options.fontSize;
  const paddingLeft = fontSize * 2;
  const spacingV = ctx.options.removeParagraphSpacing ? 0 : fontSize * 0.5;

  ctx.y -= spacingV;

  // Blockquotes often wrap their content in <p> children
  const childParas = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'p');
  if (childParas.length > 0) {
    for (const para of childParas) {
      drawMixedParagraph(ctx, para, {
        italic: true,
        indent: false,
        spacingBefore: 0,
        paddingLeft,
      });
    }
  } else {
    // Plain blockquote with no <p> children
    drawMixedParagraph(ctx, el, {
      italic: true,
      indent: false,
      spacingBefore: 0,
      paddingLeft,
    });
  }

  ctx.y -= spacingV;
}

// ─── DOM traversal ────────────────────────────────────────────────────────────

function processElement(ctx: LayoutContext, el: Element) {
  if (el.classList.contains('title-page')) { drawTitlePage(ctx, el); return; }
  if (el.classList.contains('blank-page-after-title')) { drawCopyrightPage(ctx, el); return; }
  if (el.classList.contains('preface') && !el.classList.contains('chapter')) { drawPrefacePage(ctx, el); return; }
  if (el.classList.contains('blank-page-after-preface')) { drawBlankPage(ctx); return; }
  if (el.classList.contains('summary')) { newPage(ctx); processChildren(ctx, el); newPage(ctx); return; }
  if (el.classList.contains('chapter-heading-wrapper')) { drawChapterHeading(ctx, el); return; }
  if (el.classList.contains('dinkus')) { drawDinkus(ctx, el); return; }

  if (el.classList.contains('chapter')) {
    if (el.classList.contains('chapter-one-start')) ctx.reachedChapterOne = true;
    if (ctx.options.pageBreaks) {
      newPage(ctx);
    } else if (!ctx.currentPage) {
      newPage(ctx);
    }
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
    const centered =
      el.classList.contains('keep-center') || el.getAttribute('align') === 'center';
    drawMixedParagraph(ctx, el, { centered, indent: !centered });
    return;
  }

  if (tag === 'blockquote') { drawBlockquote(ctx, el); return; }
  if (tag === 'hr') { drawDinkus(ctx, el); return; }

  // Generic containers: recurse into children
  if (el.children.length > 0) {
    processChildren(ctx, el);
  } else {
    // Leaf element with text content
    const text = el.textContent?.trim();
    if (text) {
      const centered = el.classList.contains('keep-center');
      drawMixedParagraph(ctx, el, { centered, indent: !centered });
    }
  }
}

function processChildren(ctx: LayoutContext, parent: Element) {
  for (const child of Array.from(parent.children)) {
    if (child.classList.contains('chapter-one-start')) ctx.reachedChapterOne = true;
    processElement(ctx, child);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function fetchFontBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function generatePdf(cleanedHtml: string, options: CleanHtmlOptions): Promise<Uint8Array> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedHtml, 'text/html');
  const body = doc.body;

  const pdfDoc = await PDFDocument.create();

  // Load EB Garamond from /public/fonts; fall back to built-in Times Roman if unavailable
  const [regularBytes, boldBytes, italicBytes, boldItalicBytes] = await Promise.all([
    fetchFontBytes('/fonts/EBGaramond-Regular.ttf'),
    fetchFontBytes('/fonts/EBGaramond-Bold.ttf'),
    fetchFontBytes('/fonts/EBGaramond-Italic.ttf'),
    fetchFontBytes('/fonts/EBGaramond-BoldItalic.ttf'),
  ]);

  const fonts: Fonts = {
    regular: regularBytes
      ? await pdfDoc.embedFont(regularBytes)
      : await pdfDoc.embedFont(StandardFonts.TimesRoman),
    bold: boldBytes
      ? await pdfDoc.embedFont(boldBytes)
      : await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    italic: italicBytes
      ? await pdfDoc.embedFont(italicBytes)
      : await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    boldItalic: boldItalicBytes
      ? await pdfDoc.embedFont(boldItalicBytes)
      : await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
  };

  const title =
    options.customTitle || body.querySelector('h1')?.textContent?.trim() || '';
  const author = (
    options.customAuthor ||
    body.querySelector('.author')?.textContent?.trim() ||
    ''
  ).replace(/^by\s+/i, '');

  const ctx: LayoutContext = {
    doc: pdfDoc,
    options,
    title,
    author,
    fonts,
    pageWidth: toPoints(options.pageWidth, options.pageUnit),
    pageHeight: toPoints(options.pageHeight, options.pageUnit),
    currentPage: null,
    pageIndex: -1,
    y: 0,
    reachedChapterOne:
      !options.hidePageNumbersUntilChapter1 && !options.hideHeadersUntilChapter1,
  };

  processChildren(ctx, body);
  drawHeaderFooter(ctx);

  if (pdfDoc.getPageCount() === 0) {
    newPage(ctx);
    drawHeaderFooter(ctx);
  }

  return pdfDoc.save();
}
