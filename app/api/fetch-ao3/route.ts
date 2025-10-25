import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { processAO3Html } from '@/lib/html-cleaner';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('archiveofourown.org')) {
      return NextResponse.json(
        { error: 'Invalid AO3 URL' },
        { status: 400 }
      );
    }

    // Ensure we're using the full work view
    let fetchUrl = url;
    if (url.includes('/works/') && !url.includes('?view_full_work=true')) {
      fetchUrl = url.includes('?') 
        ? `${url}&view_full_work=true` 
        : `${url}?view_full_work=true`;
    }

    // Fetch the HTML from AO3
    const response = await axios.get(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TypesetterBot/1.0)',
      },
    });

    // Process through shared function (same as uploads)
    const { html, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url } = processAO3Html(response.data, url);

    return NextResponse.json({ html, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url });
  } catch (error) {
    console.error('Error fetching from AO3:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from AO3. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}

