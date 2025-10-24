import { NextRequest, NextResponse } from 'next/server';
import { cleanHtml, CleanHtmlOptions } from '@/lib/html-cleaner';

export async function POST(request: NextRequest) {
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

    // Return the cleaned HTML as a downloadable file
    return new NextResponse(cleanedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="cleaned-preview.html"',
      },
    });
  } catch (error) {
    console.error('Error generating HTML preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate HTML preview' },
      { status: 500 }
    );
  }
}

