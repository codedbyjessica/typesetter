# Typesetter

A modern web application for creating beautiful PDF typesets from HTML files or Archive of Our Own (AO3) stories.

## Features

- 📄 **Upload HTML Files** - Upload any HTML file to convert to PDF
- 📚 **Fetch from AO3** - Pull stories directly from Archive of Our Own
- 🧹 **Content Cleaning** - Remove endnotes, footnotes, and images
- ✨ **Customizable Formatting** - Adjust font size (6-16pt, in 0.5pt steps)
- 📖 **Chapter Page Breaks** - Automatically add page breaks between chapters
- 🎨 **Beautiful UI** - Modern, responsive interface built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Upload HTML File

1. Click on the "Upload HTML File" section
2. Select an HTML file from your computer
3. The file will be automatically loaded

### Fetch from AO3

1. Go to an AO3 work (e.g., `https://archiveofourown.org/works/12345678`)
2. Copy the URL
3. Paste it into the "Fetch from AO3" input field
4. Click the "Fetch" button

### Customize Settings

**Content Cleaning:**
- Remove endnotes - Removes "Chapter End Notes" sections that appear at the end of chapters
- Remove footnotes - Removes footnotes and footnote references
- Remove chapter notes - Removes "Chapter Notes" and author's notes at the beginning of chapters
- Remove images - Strips all images from the content AND removes image source attributions (e.g., "Source: ...")

**Page Size & Margins:**
- Page Size - Customize page width and height in inches or centimeters (default: 5.5 × 8.5 in)
- Margins - Set individual margins for top, right, bottom, and left in inches or cm (default: 0.5 in all sides), or separate inner/outer margins for binding

**Formatting:**
- Font Size - Adjust from 6pt to 16pt in 0.5pt steps
- Add page breaks after chapters - Automatically inserts page breaks between chapters
- Indent paragraphs - Adds a 2em indent to the first line of each paragraph
- Remove spacing between paragraphs - Removes the spacing between paragraphs (works well with indentation)
- Dinkus Symbol - Customize the symbol used for section breaks (replaces `<hr>` elements, default: ***)

### Choose Download Format and Generate

1. Once content is loaded and settings are configured
2. Choose your download format:
   - **PDF** (default) - Generate the final formatted PDF document
   - **HTML** - Download the cleaned HTML for debugging
3. Optionally click "Preview First 5 Pages" to see the start of the real PDF
4. Click the "Generate PDF" or "Generate HTML" button
5. The selected file will be automatically downloaded

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **pdf-lib** + **@pdf-lib/fontkit** - PDF generation in the browser (EB Garamond)
- **Cheerio** - HTML parsing and cleaning

## Project Structure

```
typesetter/
├── app/
│   ├── api/
│   │   └── fetch-ao3/      # Proxies the raw AO3 page (AO3 blocks cross-origin requests)
│   ├── components/         # Form controls, margin preview, preview modal
│   ├── page.tsx            # Main UI component
│   └── layout.tsx          # Root layout
├── lib/
│   ├── html-cleaner.ts     # HTML processing, cleaning, and copyright-page content
│   └── pdf-generator.ts    # Client-side PDF layout with pdf-lib
├── public/fonts/           # EB Garamond (regular, bold, italic, bold italic)
└── package.json           # Dependencies
```

## Notes

- AO3 fetching adds `view_full_work=true` and `view_adult=true` to the URL to get the complete story in one page
- Fetched and uploaded HTML go through the same processing in the browser
- PDFs are generated entirely in the browser with pdf-lib; nothing is sent to a server except the AO3 URL
- Default page size is 5.5 × 8.5 inches (Half Letter) with 0.5-inch margins, but fully customizable
- EB Garamond is used for all PDF text
- Center-aligned elements are automatically detected and preserved, even with paragraph indentation or justification enabled
- "Chapter Text" headings from AO3 are automatically removed
- All hyperlinks are automatically converted to plain text (links removed but content preserved)
- "by " prefix is automatically removed from author elements
- Horizontal rules (`<hr>`) are replaced with a customizable centered dinkus (default: ***) with spacing before and after

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
