import * as cheerio from 'cheerio';

/**
 * Processes raw AO3 HTML into a clean, standardized structure
 * This is the first step that both fetched and uploaded HTML go through
 */
export function processAO3Html(html: string, url?: string): { html: string; title: string; author: string; wordCount: string; fandom: string; warning: string; publishDate: string; completedDate: string; ao3Url: string } {
  const $ = cheerio.load(html);
  
  // Check if this is raw AO3 HTML (has AO3-specific elements)
  const isRawAO3 = $('#workskin, #chapters, .preface, #preface').length > 0;
  
  if (isRawAO3) {
    // Extract the work content
    const workContent = $('#workskin, #chapters').html() || '';
    
    // Extract title and author - try multiple selectors in order
    let title = $('.work .title.heading').first().text().trim() || // Fetched AO3 page
                $('.preface .title.heading').first().text().trim() || // Downloaded AO3 HTML
                $('h2.title.heading').first().text().trim() || // Alternative structure
                $('.meta h1').first().text().trim() || // Preface meta
                $('h1.heading').first().text().trim() || // Generic heading
                $('title').text().split(' - ')[0].trim(); // Fallback to page title
    
    const authorElement = $('.byline a[rel="author"]').first().length 
      ? $('.byline a[rel="author"]').first() // Fetched AO3 (link)
      : $('.byline').first(); // Downloaded AO3 or generic
    let author = authorElement.text().trim();
    
    // Clean up author - remove "by " prefix if present
    author = author.replace(/^by\s+/i, '');
    
    // Extract word count
    let wordCount = '';
    const statsText = $('dd.words').text().trim();
    if (statsText) {
      wordCount = statsText;
    }
    
    // Extract fandom (first one if multiple)
    let fandom = '';
    const fandomElement = $('.fandom.tags a.tag').first();
    if (fandomElement.length) {
      fandom = fandomElement.text().trim();
    }
    
    // Extract warning (archive warnings)
    let warning = '';
    const warningElements = $('.warning.tags a.tag, dd.warning').toArray();
    if (warningElements.length) {
      warning = warningElements.map(el => $(el).text().trim()).filter(w => w).join(', ');
    }
    
    // Extract publish date
    let publishDate = '';
    const publishElement = $('dd.published').text().trim();
    if (publishElement) {
      publishDate = publishElement;
    }
    
    // Extract completed date
    let completedDate = '';
    const completedElement = $('dd.status').text().trim();
    if (completedElement) {
      completedDate = completedElement;
    }
    
    // Use provided URL or try to extract from meta
    const ao3Url = url || $('link[rel="canonical"]').attr('href') || '';
    
    // Create a clean HTML document
    const processedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title || 'Story'}</title>
      </head>
      <body>
        <h1>${title || 'Story'}</h1>
        ${author ? `<p class="author">by ${author}</p>` : ''}
        ${workContent}
      </body>
      </html>
    `;
    
    return { html: processedHtml, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url };
  }
  
  // Not raw AO3 HTML, try to extract metadata but keep structure
  const title = $('body > h1, h1.title, h1.heading').first().text().trim();
  const authorElement = $('.author, .byline, h3.byline, div.byline').first();
  let author = authorElement.text().trim();
  author = author.replace(/^by\s+/i, '');
  
  // For non-AO3 HTML, we don't have these metadata
  const wordCount = '';
  const fandom = '';
  const warning = '';
  const publishDate = '';
  const completedDate = '';
  const ao3Url = url || '';
  
  return { html, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url };
}

export interface CleanHtmlOptions {
  removeEndnotes: boolean;
  removeImages: boolean;
  removeFootnotes: boolean;
  removeChapterNotes: boolean;
  removeSummary: boolean;
  fontSize: number;
  lineSpacing: number;
  pageBreaks: boolean;
  indentParagraphs: boolean;
  removeParagraphSpacing: boolean;
  dinkusSymbol: string;
  showPageNumbers: boolean;
  hidePageNumbersUntilChapter1: boolean;
  showHeaders: boolean;
  hideHeadersUntilChapter1: boolean;
  customTitle: string;
  customAuthor: string;
  pageWidth: number;
  pageHeight: number;
  pageUnit: 'in' | 'cm';
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  marginUnit: 'in' | 'cm';
  useAlternatingMargins: boolean;
  innerMargin: number;
  outerMargin: number;
  wordCount?: string;
  fandom?: string;
  warning?: string;
  publishDate?: string;
  completedDate?: string;
  ao3Url?: string;
  binderName?: string;
}

/**
 * Cleans and formats HTML content for PDF generation
 * @param html - The raw HTML content to clean
 * @param options - Options for cleaning and formatting
 * @returns Cleaned and styled HTML ready for PDF generation
 */
export function cleanHtml(html: string, options: CleanHtmlOptions): string {
  const $ = cheerio.load(html);

  // Remove endnotes
  if (options.removeEndnotes) {
    removeEndnotes($);
  }

  // Remove footnotes
  if (options.removeFootnotes) {
    removeFootnotes($);
  }

  // Remove chapter notes
  if (options.removeChapterNotes) {
    removeChapterNotes($);
  }

  // Remove summary
  if (options.removeSummary) {
    $('.summary').remove();
  }

  // Remove images and their sources
  if (options.removeImages) {
    removeImagesAndSources($);
  }

  // Remove all links (convert to spans)
  removeLinks($);

  // Preserve center-aligned elements
  preserveCenterAlignment($);

  // Remove "Chapter Text" headings
  removeChapterTextHeadings($);

  // Clean author elements (remove "by " prefix)
  cleanAuthorElements($);

  // Apply custom title/author if provided
  if (options.customTitle || options.customAuthor) {
    applyCustomTitleAuthor($, options.customTitle, options.customAuthor);
  }

  // Wrap first h1 and author in a title page div
  wrapTitleAndAuthor($);

  // Add copyright/metadata page after title page (page 2)
  const $titlePage = $('.title-page').first();
  if ($titlePage.length) {
    const title = options.customTitle || $('body > h1').first().text().trim() || '';
    const author = options.customAuthor || $('.author').first().text().trim().replace(/^by\s+/i, '') || '';
    const wordCount = options.wordCount || '';
    const fandom = options.fandom || '';
    const warning = options.warning || '';
    const publishDate = options.publishDate || '';
    const completedDate = options.completedDate || '';
    const ao3Url = options.ao3Url || '';
    const binderName = options.binderName || '';
    
    // Only show warning if it's not "No Archive Warnings Apply"
    const shouldShowWarning = warning && !warning.includes('No Archive Warnings Apply');
    
    const copyrightPageContent = `
      <div class="blank-page-after-title">
        ${title ? `<p class="copyright-item copyright-title"><strong>${title}</strong></p>` : ''}
        ${author ? `<p class="copyright-item copyright-author"><strong>by ${author}</strong></p>` : ''}
        ${fandom ? `<p class="copyright-item">Fandom: ${fandom}</p>` : ''}
        ${shouldShowWarning ? `<p class="copyright-item">Warning: ${warning}</p>` : ''}
        ${wordCount ? `<p class="copyright-item">Word Count: ${wordCount}</p>` : ''}
        ${publishDate ? `<p class="copyright-item">Published: ${publishDate}</p>` : ''}
        ${completedDate ? `<p class="copyright-item">Completed: ${completedDate}</p>` : ''}
        ${ao3Url ? `<p class="copyright-item">Original URL: ${ao3Url}</p>` : ''}
        <p class="copyright-item">Typeset by yjzhang typesetter ${new Date().toISOString().split('T')[0]}</p>
        ${binderName ? `<p class="copyright-item">Binded by: ${binderName}</p>` : ''}
      </div>
    `;
    
    $titlePage.after(copyrightPageContent);
  }

  // Remove ALL inline styles from the first preface (title/author page) to ensure proper centering
  const $firstPreface = $('body > div.preface:not(.chapter), #chapters > .preface:not(.chapter)').first();
  if ($firstPreface.length) {
    $firstPreface.removeAttr('style');
    // Also remove inline styles from children
    $firstPreface.find('*').removeAttr('style');
  }
  
  // For other prefaces (like chapter prefaces), just remove page-break-before
  $('.preface').not($firstPreface).each(function() {
    const $preface = $(this);
    const style = $preface.attr('style');
    if (style) {
      const newStyle = style.replace(/page-break-before\s*:\s*always\s*;?/gi, '').trim();
      if (newStyle) {
        $preface.attr('style', newStyle);
      } else {
        $preface.removeAttr('style');
      }
    }
  });

  // Add blank page after preface (second title/author)
  const $preface = $('body > div.preface:not(.chapter), #chapters > .preface:not(.chapter)').first();
  if ($preface.length) {
    $preface.after('<div class="blank-page-after-preface"></div>');
  }

  // Replace horizontal rules with dinkus
  replaceHrWithDinkus($, options.dinkusSymbol);

  // Clean up unnecessary br tags
  cleanupBrTags($);

  // Format chapter headings
  formatChapterHeadings($);
  
  // Mark Chapter 1 for page numbering if needed
  if (options.showPageNumbers && options.hidePageNumbersUntilChapter1) {
    markChapterOne($);
  }

  // Add page breaks after chapters
  if (options.pageBreaks) {
    addChapterPageBreaks($);
  }

  // Remove all empty elements throughout the document
  removeAllEmptyElements($);

  // Trim trailing empty elements to prevent blank pages
  trimTrailingEmptyElements($);

  // Get the cleaned HTML
  const bodyContent = $('body').html() || $.html();

  // Extract title and author for headers
  let title = options.customTitle || $('body > h1').first().text().trim() || '';
  let author = options.customAuthor || $('.author').first().text().trim().replace(/^by\s+/i, '') || '';

  // Create final HTML with styles
  return generateStyledHtml(bodyContent, options, title, author);
}

/**
 * Removes endnotes from the document
 */
function removeEndnotes($: cheerio.CheerioAPI): void {
  // Remove divs with id="endnotesX" where X is a number (AO3 format)
  $('div[id^="endnotes"]').remove();
  
  // Also remove generic endnotes sections
  $('.endnotes, #endnotes, [class*="endnote"]').remove();
  
  // Remove "Chapter End Notes" paragraphs and their following blockquotes
  $('p').each(function() {
    const text = $(this).text().trim();
    if (text === 'Chapter End Notes' || text === 'End Notes' || text.toLowerCase() === 'chapter end notes') {
      // Remove the next blockquote if it exists
      const nextElem = $(this).next();
      if (nextElem.is('blockquote')) {
        nextElem.remove();
      }
      // Remove the paragraph itself
      $(this).remove();
    }
  });
}

/**
 * Removes afterword sections from the document
 */
function removeFootnotes($: cheerio.CheerioAPI): void {
  // Remove afterword sections (AO3 format)
  $('.afterword').remove();
  
  // Remove series links
  $('#series, .series.module').remove();
  
  // Also remove any divs containing "Series this work belongs to"
  $('div').each(function() {
    const text = $(this).text().trim();
    if (text.includes('Series this work belongs to')) {
      $(this).remove();
    }
  });
}

/**
 * Removes chapter notes from the document
 */
function removeChapterNotes($: cheerio.CheerioAPI): void {
  // Find paragraphs that say "Chapter Notes" and remove them along with following elements
  $('p').each(function() {
    const text = $(this).text().trim();
    if (text === 'Chapter Notes' || text === 'Chapter notes' || text.toLowerCase() === 'chapter notes') {
      // Get the next siblings that are part of the chapter notes
      let nextElem = $(this).next();
      
      // Remove the next blockquote if it exists
      if (nextElem.is('blockquote')) {
        nextElem.remove();
        nextElem = $(this).next(); // Get the next element after blockquote
      }
      
      // Remove the endnote-link div if it exists
      if (nextElem.hasClass('endnote-link') || nextElem.is('[class*="endnote-link"]')) {
        nextElem.remove();
      }
      
      // Remove the Chapter Notes paragraph itself
      $(this).remove();
    }
  });
  
  // Remove common chapter note containers
  $('.notes, [class*="chapternotes"], [class*="chapter-notes"]').remove();
  
  // Remove standalone "See the end of the chapter for more notes" links
  $('.endnote-link, [class*="endnote-link"]').remove();
}

/**
 * Removes "Chapter Text" headings that appear in AO3 works
 */
function removeChapterTextHeadings($: cheerio.CheerioAPI): void {
  $('h1, h2, h3, h4, h5, h6').each(function() {
    const text = $(this).text().trim();
    if (text === 'Chapter Text' || text.toLowerCase() === 'chapter text') {
      $(this).remove();
    }
  });
}

/**
 * Removes images and their source attributions
 */
function removeImagesAndSources($: cheerio.CheerioAPI): void {
  // First, handle images inside centered paragraphs - remove entire paragraph
  $('img').each(function() {
    const $img = $(this);
    const $parent = $img.parent();
    
    // Check if parent is a <p> tag with align="center"
    if ($parent.is('p') && $parent.attr('align') === 'center') {
      // Also check if there's a following centered paragraph with just a symbol (like ~)
      const $next = $parent.next();
      if ($next.is('p') && $next.attr('align') === 'center') {
        const nextText = $next.text().trim();
        // If next paragraph is just a single symbol or very short, remove it too
        if (nextText.length <= 3) {
          $next.remove();
        }
      }
      
      // Remove the entire centered paragraph (includes image and credits)
      $parent.remove();
    } else {
      // Just remove the image
      $img.remove();
    }
  });
  
  // Then find and remove source attributions - only in paragraphs
  // Look for paragraphs that contain "Source:" and are likely just source attributions
  $('p').each(function() {
    const $p = $(this);
    const text = $p.text().trim();
    
    // Check if this is a short paragraph that starts with or only contains source info
    if (text.length < 200 && /^\s*source\s*:/i.test(text)) {
      // This paragraph starts with "Source:" and is short, likely just a source attribution
      $p.remove();
    }
  });
  
  // Also remove any standalone centered paragraphs that are just symbols
  $('p[align="center"]').each(function() {
    const $p = $(this);
    const text = $p.text().trim();
    // Remove if it's just a single character or symbol (like ~)
    if (text.length <= 3 && /^[~*\-_.]+$/.test(text)) {
      $p.remove();
    }
  });
  
  // Note: Empty elements are cleaned up later by removeAllEmptyElements()
}

/**
 * Removes all links by converting them to span tags
 */
function removeLinks($: cheerio.CheerioAPI): void {
  $('a').each(function() {
    const $link = $(this);
    const content = $link.html() || '';
    const $span = $('<span>').html(content);
    
    // Preserve any classes from the link
    const classes = $link.attr('class');
    if (classes) {
      $span.attr('class', classes);
    }
    
    $link.replaceWith($span);
  });
}

/**
 * Cleans author elements by removing "by " prefix
 */
function cleanAuthorElements($: cheerio.CheerioAPI): void {
  $('.author').each(function() {
    const $author = $(this);
    let text = $author.text().trim();
    
    // Remove "by " from the beginning (case-insensitive)
    text = text.replace(/^by\s+/i, '');
    
    $author.text(text);
  });
}

/**
 * Applies custom title and/or author text (for styling purposes)
 */
function applyCustomTitleAuthor($: cheerio.CheerioAPI, customTitle: string, customAuthor: string): void {
  // Update main title if custom title provided
  if (customTitle) {
    const $firstH1 = $('body > h1').first();
    if ($firstH1.length) {
      $firstH1.text(customTitle);
    }
  }

  // Update author if custom author provided
  if (customAuthor) {
    const $author = $('.author').first();
    if ($author.length) {
      $author.text(customAuthor);
    }
  }

  // Update preface title/author if exists
  const $preface = $('.preface').first();
  if ($preface.length) {
    if (customTitle) {
      const $prefaceTitle = $preface.find('h2.title, h3.title').first();
      if ($prefaceTitle.length) {
        $prefaceTitle.text(customTitle);
      }
    }
    if (customAuthor) {
      const $prefaceAuthor = $preface.find('.byline').first();
      if ($prefaceAuthor.length) {
        $prefaceAuthor.text(customAuthor);
      }
    }
  }
}

/**
 * Wraps the first h1 and author in a title-page div
 */
function wrapTitleAndAuthor($: cheerio.CheerioAPI): void {
  const $firstH1 = $('body > h1').first();
  const $author = $firstH1.next('.author');
  
  if ($firstH1.length && $author.length) {
    // Create a wrapper div
    const $wrapper = $('<div class="title-page"></div>');
    
    // Insert the wrapper before the h1
    $firstH1.before($wrapper);
    
    // Move h1 and author into the wrapper
    $wrapper.append($firstH1);
    $wrapper.append($author);
  }
}

/**
 * Replaces <hr> elements with centered dinkus
 */
function replaceHrWithDinkus($: cheerio.CheerioAPI, symbol: string): void {
  $('hr').each(function() {
    const $dinkus = $('<div class="dinkus"></div>').text(symbol);
    $(this).replaceWith($dinkus);
  });
}

/**
 * Preserves center-aligned elements by adding a class
 */
function preserveCenterAlignment($: cheerio.CheerioAPI): void {
  // Handle <center> tags - only mark children without explicit alignment
  $('center').each(function() {
    $(this).find('*').each(function() {
      const child = $(this);
      const align = child.attr('align');
      const style = child.attr('style');
      
      // Only add keep-center if the element doesn't have its own alignment
      if (!align && (!style || !style.includes('text-align'))) {
        child.addClass('keep-center');
      }
    });
    // Replace center tag with div to maintain structure
    const content = $(this).html();
    $(this).replaceWith($('<div>').html(content || ''));
  });
  
  // Find all elements with explicit center alignment
  $('*').each(function() {
    const elem = $(this);
    
    // Check for align="center" attribute
    if (elem.attr('align') === 'center') {
      elem.addClass('keep-center');
    }
    
    // Check for inline style with text-align: center
    const style = elem.attr('style');
    if (style && style.includes('text-align') && style.includes('center')) {
      elem.addClass('keep-center');
    }
    
    // Check for common center alignment classes
    const className = elem.attr('class') || '';
    if (className.match(/text-center|align-?center|center/i)) {
      elem.addClass('keep-center');
    }
  });
}

/**
 * Formats chapter headings to split at first colon
 * "Chapter 1: Subtitle" becomes:
 * - "Chapter 1" (bold)
 * - "Subtitle" (normal)
 */
function formatChapterHeadings($: cheerio.CheerioAPI): void {
  // Find chapter headings in various locations
  const selectors = [
    '.chapter h1',
    '.chapter h2', 
    '.chapter h3',
    '.chapter .heading',
    '.chapter .title',
    'h1.heading',
    'h2.heading',
    'h3.heading'
  ];
  
  selectors.forEach(selector => {
    $(selector).each(function() {
      const $heading = $(this);
      const text = $heading.text().trim();
      
      // Check if heading contains a colon
      const colonIndex = text.indexOf(':');
      if (colonIndex > 0) {
        // Split at first colon
        const chapterPart = text.substring(0, colonIndex).trim();
        const subtitlePart = text.substring(colonIndex + 1).trim();
        
        // Create new structure with chapter-heading wrapper
        const newHtml = `<div class="chapter-heading-wrapper"><div><strong>${chapterPart}</strong></div>${subtitlePart}</div>`;
        
        $heading.replaceWith(newHtml);
      }
    });
  });
}

/**
 * Adds page breaks before chapters
 */
function addChapterPageBreaks($: cheerio.CheerioAPI): void {
  // Common chapter selectors
  $('.chapter, [class*="chapter"], h1, h2, .chapter-heading-wrapper').each(function(index) {
    if (index > 0) { // Don't add page break before first chapter
      $(this).css('page-break-before', 'always');
    }
  });
}

/**
 * Finds and marks the element containing "Chapter 1" for page numbering
 */
function markChapterOne($: cheerio.CheerioAPI): void {
  // Search for "Chapter 1" (case insensitive) in various elements
  const selectors = [
    '.chapter', '.chapter-heading-wrapper', 
    'h1', 'h2', 'h3', 
    '[class*="chapter"]',
    'div', 'section'
  ];
  
  let found = false;
  
  for (const selector of selectors) {
    if (found) break;
    
    $(selector).each(function() {
      if (found) return;
      
      const $el = $(this);
      const text = $el.text().trim();
      
      // Check if text contains "chapter 1" (case insensitive)
      if (/chapter\s*1(?:\s|:|$)/i.test(text)) {
        $el.addClass('chapter-one-start');
        found = true;
        return false; // Break the loop
      }
    });
  }
}

/**
 * Clean up unnecessary br tags
 */
function cleanupBrTags($: cheerio.CheerioAPI): void {
  // Remove br tags that have no text content on one side
  $('p, div').find('br').each(function() {
    const $br = $(this);
    const $parent = $br.parent();
    
    // Get all text before and after the br within the paragraph
    const $p = $br.closest('p, div');
    if (!$p.length) return;
    
    // Get the HTML and split by the br to check if there's text on both sides
    let html = $p.html() || '';
    
    // Check if there's any actual text before this br (excluding tags)
    let beforeBr = '';
    let currentNode = $br[0];
    
    // Walk backwards through siblings and parents to get text before br
    while (currentNode) {
      let prev = currentNode.previousSibling;
      while (prev) {
        if (prev.nodeType === 3) { // Text node
          beforeBr = (prev.nodeValue || '') + beforeBr;
        } else if (prev.nodeType === 1) { // Element node
          beforeBr = $(prev).text() + beforeBr;
        }
        prev = prev.previousSibling;
      }
      
      // Move up to parent if not at paragraph level
      currentNode = currentNode.parentNode as any;
      if (!currentNode || $(currentNode).is('p, div')) {
        break;
      }
    }
    
    // Get text after br
    let afterBr = '';
    currentNode = $br[0];
    
    // Walk forwards through siblings and parents to get text after br
    while (currentNode) {
      let next = currentNode.nextSibling;
      while (next) {
        if (next.nodeType === 3) { // Text node
          afterBr = afterBr + (next.nodeValue || '');
        } else if (next.nodeType === 1) { // Element node
          afterBr = afterBr + $(next).text();
        }
        next = next.nextSibling;
      }
      
      // Move up to parent if not at paragraph level
      currentNode = currentNode.parentNode as any;
      if (!currentNode || $(currentNode).is('p, div')) {
        break;
      }
    }
    
    // Remove br if there's no text on one side
    if (beforeBr.trim() === '' || afterBr.trim() === '') {
      $br.remove();
    }
  });
  
  // Replace multiple consecutive br tags with a single one
  $('br').each(function() {
    const $br = $(this);
    let $next = $br.next();
    
    // Remove consecutive br tags
    while ($next.length && $next.is('br')) {
      const $toRemove = $next;
      $next = $next.next();
      $toRemove.remove();
    }
  });
}

/**
 * Removes all empty elements throughout the document
 */
function removeAllEmptyElements($: cheerio.CheerioAPI): void {
  // Tags that should be removed if empty
  const tagsToClean = ['p', 'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'blockquote', 'pre', 'em', 'strong', 'i', 'b', 'u'];
  
  // Keep running until no more empty elements are found (some become empty after children are removed)
  let removedAny = true;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  while (removedAny && iterations < maxIterations) {
    removedAny = false;
    iterations++;
    
    tagsToClean.forEach(tag => {
      $(tag).each(function() {
        const $elem = $(this);
        const text = $elem.text().trim();
        const html = $elem.html()?.trim() || '';
        
        // Skip elements that are intentionally empty (like blank pages)
        if ($elem.hasClass('blank-page-after-title') || $elem.hasClass('blank-page-after-preface')) {
          return;
        }
        
        // Remove if completely empty or only contains whitespace/empty tags
        if (text === '' || text.length === 0) {
          // Check if it only contains other empty elements (like <br>, empty spans, etc)
          const hasOnlyEmptyChildren = !html.match(/[a-zA-Z0-9]/);
          if (hasOnlyEmptyChildren || html === '' || html === '&nbsp;') {
            $elem.remove();
            removedAny = true;
          }
        }
      });
    });
  }
}

/**
 * Trims trailing empty elements to prevent blank pages at the end
 */
function trimTrailingEmptyElements($: cheerio.CheerioAPI): void {
  const body = $('body');
  let children = body.children();
  
  // Work backwards from the end, removing empty elements
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children.eq(i);
    const text = child.text().trim();
    
    // If the element is empty or only contains whitespace, remove it
    if (text === '' || text.length === 0) {
      child.remove();
    } else {
      // Stop when we hit a non-empty element
      break;
    }
  }
  
  // Also remove trailing <br> tags
  body.find('br').each(function() {
    const $br = $(this);
    // Check if this br is at the end (has no meaningful siblings after it)
    let hasContentAfter = false;
    let next = $br.next();
    
    while (next.length > 0) {
      if (next.text().trim().length > 0) {
        hasContentAfter = true;
        break;
      }
      next = next.next();
    }
    
    if (!hasContentAfter) {
      $br.remove();
    }
  });
}

/**
 * Generates the final HTML with styling for PDF generation
 */
function generateStyledHtml(bodyContent: string, options: CleanHtmlOptions, title: string = '', author: string = ''): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${!options.useAlternatingMargins ? `
        @page {
          size: ${options.pageWidth}${options.pageUnit} ${options.pageHeight}${options.pageUnit};
          margin-top: ${options.marginTop}${options.marginUnit};
          margin-right: ${options.marginRight}${options.marginUnit};
          margin-bottom: ${options.marginBottom}${options.marginUnit};
          margin-left: ${options.marginLeft}${options.marginUnit};
          ${options.showPageNumbers ? `
          @bottom-center {
            content: counter(page);
            font-size: ${options.fontSize * 0.9}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            margin-top: -0.2in;
          }
          ` : ''}
        }
        
        ${options.showHeaders ? `
        /* Left pages (even) - show author */
        @page :left {
          @top-center {
            content: "${author.replace(/"/g, '\\"')}";
            font-size: ${options.fontSize * 0.8}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            font-style: italic;
            margin-bottom: -0.2in;
          }
        }
        
        /* Right pages (odd) - show title */
        @page :right {
          @top-center {
            content: "${title.replace(/"/g, '\\"')}";
            font-size: ${options.fontSize * 0.8}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            font-style: italic;
            margin-bottom: -0.15in;
          }
        }
        ` : ''}
        ` : `
        @page {
          size: ${options.pageWidth}${options.pageUnit} ${options.pageHeight}${options.pageUnit};
          margin-top: ${options.marginTop}${options.marginUnit};
          margin-bottom: ${options.marginBottom}${options.marginUnit};
          ${options.showPageNumbers ? `
          @bottom-center {
            content: counter(page);
            font-size: ${options.fontSize * 0.9}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            margin-top: -0.25in;
          }
          ` : ''}
        }
        
        /* Left pages (even) - outer margin on left, inner on right */
        @page :left {
          margin-left: ${options.outerMargin}${options.marginUnit};
          margin-right: ${options.innerMargin}${options.marginUnit};
          ${options.showHeaders ? `
          @top-center {
            content: "${author.replace(/"/g, '\\"')}";
            font-size: ${options.fontSize * 0.8}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            font-style: italic;
            margin-bottom: -0.15in;
          }
          ` : ''}
        }
        
        /* Right pages (odd) - inner margin on left, outer on right */
        @page :right {
          margin-left: ${options.innerMargin}${options.marginUnit};
          margin-right: ${options.outerMargin}${options.marginUnit};
          ${options.showHeaders ? `
          @top-center {
            content: "${title.replace(/"/g, '\\"')}";
            font-size: ${options.fontSize * 0.8}pt;
            font-family: 'Garamond', 'Times New Roman', serif;
            font-style: italic;
            margin-bottom: -0.15in;
          }
          ` : ''}
        }
        `}
        
        ${(options.showPageNumbers && options.hidePageNumbersUntilChapter1) || (options.showHeaders && options.hideHeadersUntilChapter1) ? `
        /* Hide page numbers and/or headers until Chapter 1 */
        .title-page,
        .blank-page-after-title,
        .preface:not(.chapter),
        .blank-page-after-preface {
          page: frontmatter-page;
        }
        
        @page frontmatter-page {
          ${options.showPageNumbers && options.hidePageNumbersUntilChapter1 ? `
          @bottom-center {
            content: '';
          }
          ` : ''}
          ${options.showHeaders && options.hideHeadersUntilChapter1 ? `
          @top-center {
            content: '';
          }
          ` : ''}
        }
        
        @page frontmatter-page:left {
          ${options.showHeaders && options.hideHeadersUntilChapter1 ? `
          @top-center {
            content: '';
          }
          ` : ''}
        }
        
        @page frontmatter-page:right {
          ${options.showHeaders && options.hideHeadersUntilChapter1 ? `
          @top-center {
            content: '';
          }
          ` : ''}
        }
        ` : ''}
        
        body {
          font-family: 'Garamond', 'Times New Roman', serif !important;
          font-size: ${options.fontSize}pt;
          line-height: ${options.lineSpacing};
          color: #000;
          max-width: 100%;
        }
        
        h1, h2, h3, h4, h5, h6 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          page-break-after: avoid;
        }
        
        h1 {
          font-size: ${options.fontSize * 1.8}pt;
          text-align: center;
        }
        
        h2 {
          font-size: ${options.fontSize * 1.5}pt;
          text-align: center;
        }
        
        h3 {
          font-size: ${options.fontSize * 1.3}pt;
        }
        
        p {
          margin-bottom: ${options.removeParagraphSpacing ? '0' : '0.5em'};
          margin-top: ${options.removeParagraphSpacing ? '0' : '0.5em'};
          text-align: justify;
          text-indent: ${options.indentParagraphs ? '2em' : '0'};
          orphans: 2;
          widows: 2;
        }
        
        /* Preserve center alignment */
        .keep-center,
        [align="center"],
        p[align="center"],
        center {
          text-align: center !important;
          text-indent: 0 !important;
        }
        
        blockquote {
          margin: 1em 2em;
          font-style: italic;
        }
        
        .chapter {
          page-break-before: always;
        }
        
        /* Chapter headings start 1/3 down the page */
        .chapter h1,
        .chapter h2,
        .chapter h3,
        .chapter .title,
        h2[class*="chapter"],
        h3[class*="chapter"] {
          padding-top: 33vh;
        }
        
        /* First heading in a chapter div */
        .chapter > h1:first-child,
        .chapter > h2:first-child,
        .chapter > h3:first-child,
        .chapter > .title:first-child {
          padding-top: 33vh;
          margin-bottom: 2rem;
        }
        
        /* New chapter heading wrapper format */
        .chapter-heading-wrapper {
          padding-top: 33vh;
          text-align: center;
          font-size: ${options.fontSize * 1.5}pt;
          page-break-after: avoid;
          page-break-inside: avoid;
          margin-bottom: 2rem;
        }
        
        .chapter-heading-wrapper strong {
          font-weight: bold;
        }
        
        /* AO3-specific styles */
        .preface, .summary {
          font-style: normal;
          margin-bottom: 2em;
        }
        
        /* Summary gets its own page when kept */
        .summary {
          page-break-before: always;
          page-break-after: always;
        }
        
        /* Page 3: Style preface content as regular body text, centered */
        /* Only apply to the first preface (title/author), not chapter prefaces */
        body > div.preface:not(.chapter),
        #chapters > .preface:not(.chapter) {
          text-align: center;
          page-break-after: always;
          padding-top: 40vh;
          margin: 0;
          box-sizing: border-box;
        }
        
        /* Page 4: Blank page after preface */
        .blank-page-after-preface {
          page-break-after: always;
        }
        
        body > div.preface:not(.chapter) h2,
        body > div.preface:not(.chapter) h3,
        body > div.preface:not(.chapter) .title,
        body > div.preface:not(.chapter) .byline,
        body > div.preface:not(.chapter) p,
        #chapters > .preface:not(.chapter) h2,
        #chapters > .preface:not(.chapter) h3,
        #chapters > .preface:not(.chapter) .title,
        #chapters > .preface:not(.chapter) .byline,
        #chapters > .preface:not(.chapter) p {
          font-size: ${options.fontSize}pt;
          font-weight: normal;
          font-style: normal;
          text-align: center !important;
          margin: 0.5em 0;
          text-indent: 0 !important;
        }
        
        /* Chapter prefaces should not have page breaks */
        .chapter.preface {
          page-break-after: avoid;
        }
        
        .meta {
          font-size: ${options.fontSize * 0.9}pt;
          color: #666;
        }
        
        .author {
          font-style: italic;
          text-align: center !important;
          text-indent: 0 !important;
          margin-bottom: 0;
        }
        
        /* Page 1: Title page - wrapper for h1 and author, centered */
        .title-page {
          text-align: center;
          page-break-after: always;
          padding-top: 40vh;
          margin: 0;
          box-sizing: border-box;
        }
        
        .title-page h1,
        .title-page .author {
          margin: 0.5em 0;
        }
        
        /* Page 2: Copyright/metadata page after title */
        .blank-page-after-title {
          page-break-after: always;
          padding-top: 70vh;
        }
        
        .copyright-item {
          font-size: ${options.fontSize}pt;
          font-family: 'Garamond', 'Times New Roman', serif;
          font-weight: normal;
          font-style: normal;
          text-align: left;
          text-indent: 0 !important;
          margin: 0.2em 0;
          line-height: 1.2;
        }
        
        .copyright-title,
        .copyright-author {
          font-weight: bold;
        }
        
        
        /* Center title and author-like elements */
        body > h1:first-child,
        .title {
          text-align: center;
        }
        
        /* Dinkus (section break) */
        .dinkus {
          text-align: center;
          margin: 0.75em 0;
          font-size: ${options.fontSize}pt;
        }
        
        /* Remove AO3 UI elements */
        .navigation, .header, .footer, .kudos, .comments {
          display: none;
        }
      </style>
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
  `;
}

