import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { cleanHtml, CleanHtmlOptions } from '@/lib/html-cleaner';

export async function POST(request: NextRequest) {
  let browser;
  
  try {
    const { html, options } = await request.json() as {
      html: string;
      options: CleanHtmlOptions;
    };

    if (!html) {
      return NextResponse.json(
        { error: 'No HTML content provided' },
        { status: 400 }
      );
    }

    // Clean the HTML based on options
    const cleanedHtml = cleanHtml(html, options);

    // Launch puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(cleanedHtml, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF with custom page size and margins
    const pdf = await page.pdf({
      width: `${options.pageWidth}${options.pageUnit}`,
      height: `${options.pageHeight}${options.pageUnit}`,
      margin: {
        top: `${options.marginTop}${options.marginUnit}`,
        right: `${options.marginRight}${options.marginUnit}`,
        bottom: `${options.marginBottom}${options.marginUnit}`,
        left: `${options.marginLeft}${options.marginUnit}`,
      },
      printBackground: true,
    });

    await browser.close();

    // Return the PDF
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="typeset.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
