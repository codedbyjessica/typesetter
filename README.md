# Typesetter

A modern web application for creating beautiful PDF typesets from HTML files or Archive of Our Own (AO3) stories.

## Features

- 📄 **Upload HTML Files** - Upload any HTML file to convert to PDF
- 📚 **Fetch from AO3** - Pull stories directly from Archive of Our Own
- 🧹 **Content Cleaning** - Remove endnotes, footnotes, and images
- ✨ **Customizable Formatting** - Adjust font size (8-20pt)
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
- Margins - Set individual margins for top, right, bottom, and left in inches or cm (default: 1 in all sides)

**Formatting:**
- Font Size - Adjust from 6pt to 16pt
- Add page breaks after chapters - Automatically inserts page breaks between chapters
- Indent paragraphs - Adds a 2em indent to the first line of each paragraph
- Remove spacing between paragraphs - Removes the spacing between paragraphs (works well with indentation)
- Dinkus Symbol - Customize the symbol used for section breaks (replaces `<hr>` elements, default: ***)

### Choose Download Format and Generate

1. Once content is loaded and settings are configured
2. Choose your download format:
   - **PDF** (default) - Generate the final formatted PDF document
   - **HTML** - Download the cleaned HTML for debugging/preview
3. Click the "Generate PDF" or "Generate HTML" button
4. The selected file will be automatically downloaded

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Puppeteer** - PDF generation
- **Cheerio** - HTML parsing and cleaning
- **Axios** - HTTP requests

## Project Structure

```
typesetter/
├── app/
│   ├── api/
│   │   ├── fetch-ao3/      # API route for fetching AO3 content
│   │   ├── generate-pdf/   # API route for PDF generation
│   │   └── preview-html/   # API route for cleaned HTML preview
│   ├── page.tsx            # Main UI component
│   └── layout.tsx          # Root layout
├── lib/
│   └── html-cleaner.ts     # HTML cleaning and formatting utilities
├── public/                 # Static assets
└── package.json           # Dependencies
```

## Notes

- AO3 fetching works by adding `?view_full_work=true` to the URL to get the complete story in one page
- PDF generation uses Puppeteer with headless Chrome for high-quality output
- Default page size is 5.5 × 8.5 inches (Half Letter) with 1-inch margins, but fully customizable
- Serif fonts (Georgia) are used for body text, sans-serif (Helvetica) for headings
- Center-aligned elements are automatically detected and preserved, even with paragraph indentation or justification enabled
- "Chapter Text" headings from AO3 are automatically removed
- All hyperlinks are automatically converted to plain text (links removed but content preserved)
- "by " prefix is automatically removed from author elements
- Horizontal rules (`<hr>`) are replaced with a customizable centered dinkus (default: ***) with spacing before and after

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
