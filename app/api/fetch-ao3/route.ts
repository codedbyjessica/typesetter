import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { processAO3Html } from '@/lib/html-cleaner';

// Allow longer runs where the host honors it (e.g. Vercel). Hosts behind a fixed
// gateway limit (CloudFront/Amplify ~30s) still cap us, so we also time out ourselves.
export const maxDuration = 60;

// Abort the upstream request before the gateway kills the function, so we can
// return a useful error instead of a bare 504.
const AO3_TIMEOUT_MS = 25_000;

const UPLOAD_HINT =
  'On AO3, use Download → HTML, then upload that file here instead.';

export async function POST(request: NextRequest) {
  let url: string | undefined;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || !url.includes('archiveofourown.org')) {
    return NextResponse.json({ error: 'Invalid AO3 URL' }, { status: 400 });
  }

  // Ensure we're using the full work view, and skip the adult-content interstitial
  // (otherwise AO3 returns only the warning page for rated works).
  let fetchUrl = url;
  if (url.includes('/works/')) {
    for (const param of ['view_full_work=true', 'view_adult=true']) {
      if (!fetchUrl.includes(param)) {
        fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + param;
      }
    }
  }

  try {
    const response = await axios.get(fetchUrl, {
      timeout: AO3_TIMEOUT_MS,
      headers: {
        // AO3 rate-limits generic "Bot" UAs (429) and rejects fake browser UAs from
        // servers (403); an honest app UA with a contact URL is accepted.
        'User-Agent': 'Typesetter/1.0 (+https://typeset.codedbyjessica.com)',
      },
    });

    const { html, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url } =
      processAO3Html(response.data, url);

    return NextResponse.json({ html, title, author, wordCount, fandom, warning, publishDate, completedDate, ao3Url });
  } catch (error) {
    console.error('Error fetching from AO3:', error);

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: `AO3 took too long to respond. Try again in a moment, or: ${UPLOAD_HINT}` },
          { status: 504 }
        );
      }
      const status = error.response?.status;
      if (status === 429) {
        return NextResponse.json(
          { error: `AO3 is rate limiting requests. Wait a minute and try again, or ${UPLOAD_HINT.charAt(0).toLowerCase()}${UPLOAD_HINT.slice(1)}` },
          { status: 429 }
        );
      }
      if (status === 404) {
        return NextResponse.json(
          { error: 'Work not found on AO3. It may be deleted, or restricted to logged-in users.' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch from AO3. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}
