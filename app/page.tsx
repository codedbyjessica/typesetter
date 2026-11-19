'use client';

import { useState } from 'react';
import { Checkbox, NumberInput, TextInput, RangeSlider, SectionHeader } from './components/FormControls';
import { PageMarginPreview } from './components/PageMarginPreview';
import { PreviewModal } from './components/PreviewModal';

const PREVIEW_PAGES = 5;

type StoryMetadata = { wordCount?: string; fandom?: string; warning?: string; publishDate?: string; completedDate?: string; ao3Url?: string };

interface RadioGroupProps {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  falseLabel: string;
  trueLabel: string;
}

// Two radio options backed by a boolean (used for "show on all pages / hide until Chapter 1").
const RadioGroup = ({ name, value, onChange, falseLabel, trueLabel }: RadioGroupProps) => (
  <div className="ml-6 mt-3 space-y-2">
    {[false, true].map((option) => (
      <label key={String(option)} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={name}
          checked={value === option}
          onChange={() => onChange(option)}
          className="w-4 h-4 text-slate-700 focus:ring-2 focus:ring-slate-500"
        />
        <span className="text-sm text-slate-700">{option ? trueLabel : falseLabel}</span>
      </label>
    ))}
  </div>
);

export default function Home() {
  // Color palette for sections - easily customizable
  const colors = {
    primary: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-700',
      hover: 'hover:bg-slate-100'
    },
    secondary: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-100'
    },
    tertiary: {
      bg: 'bg-slate-100',
      border: 'border-slate-300',
      text: 'text-slate-800',
      hover: 'hover:bg-slate-200'
    }
  };

  const [htmlContent, setHtmlContent] = useState<string>('');
  const [ao3Url, setAo3Url] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'html'>('pdf');
  const [showOverrideSection, setShowOverrideSection] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [metadata, setMetadata] = useState<StoryMetadata>({});
  
  // Structured settings state
  const [settings, setSettings] = useState({
    // Content cleaning
    removeEndnotes: true,
    removeImages: true,
    removeAfterword: true,
    removeChapterNotes: true,
    removeSummary: true,
    
    // Formatting
    fontSize: 9,
    lineSpacing: 1.6,
    pageBreaks: true,
    indentParagraphs: true,
    removeParagraphSpacing: true,
    dinkusSymbol: '* * *',
    
    // Page numbers
    showPageNumbers: true,
    hidePageNumbersUntilChapter1: true,
    
    // Headers
    showHeaders: true,
    hideHeadersUntilChapter1: true,
    
    // Title customization (for styling only)
    customTitle: '',
    customAuthor: '',
    
    // Copyright page
    binderName: '',
    
    // Page settings
    pageWidth: 5.5,
    pageHeight: 8.5,
    pageUnit: 'in' as 'in' | 'cm',
    marginTop: 0.5,
    marginRight: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.5,
    marginUnit: 'in' as 'in' | 'cm',
    
    // Alternating margins for book binding
    useAlternatingMargins: false,
    innerMargin: 0.75,
    outerMargin: 0.5,
  });

  // Helper to update a single setting
  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Settings configuration for UI rendering
  const cleaningOptions = [
    { key: 'removeSummary' as const, label: 'Remove summary' },
    { key: 'removeChapterNotes' as const, label: 'Remove chapter notes' },
    { key: 'removeEndnotes' as const, label: 'Remove chapter endnotes' },
    { key: 'removeAfterword' as const, label: 'Remove afterword' },
    { key: 'removeImages' as const, label: 'Remove images' },
  ];

  const formattingCheckboxes = [
    { key: 'pageBreaks' as const, label: 'Add page breaks after chapters' },
    { key: 'indentParagraphs' as const, label: 'Indent paragraphs' },
    { key: 'removeParagraphSpacing' as const, label: 'Remove spacing between paragraphs' },
  ];

  // Generate filename from title
  const getFilename = (extension: string): string => {
    const title = settings.customTitle;
    if (!title) {
      return `typeset.${extension}`;
    }
    
    // Convert title to filename-safe format
    // Replace spaces with underscores, remove special characters
    const safeName = title
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^\w\-_.]/g, '')  // Remove special characters except underscore, hyphen, period
      .replace(/_+/g, '_')  // Replace multiple underscores with single
      .replace(/^_|_$/g, '')  // Remove leading/trailing underscores
      .substring(0, 100);  // Limit length to 100 characters
    
    return safeName ? `${safeName}_typeset.${extension}` : `typeset.${extension}`;
  };
  // Fetched and uploaded HTML both land here, so they go through the exact same processing.
  const loadStory = async (rawHtml: string, sourceUrl?: string) => {
    const { processAO3Html } = await import('@/lib/html-cleaner');
    const { html, title, author, ...storyMetadata } = processAO3Html(rawHtml, sourceUrl);
    setHtmlContent(html);
    updateSetting('customTitle', title);
    updateSetting('customAuthor', author);
    setMetadata(storyMetadata);
    setMetadataLoaded(true);
  };

  // Settings plus the story's metadata (word count, fandom, dates…) for the copyright page.
  const buildOptions = () => ({ ...settings, ...metadata });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['text/html', 'application/xhtml+xml'];
    const validExtensions = ['.html', '.htm', '.xhtml'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setError('Please upload a valid HTML file (.html, .htm, or .xhtml)');
      e.target.value = ''; // Reset file input
      return;
    }

    setLoading(true);
    setError('');

    try {
      const content = await file.text();

      // Validate it's actually HTML content
      const lower = content.trim().toLowerCase();
      if (!lower.includes('<html') && !lower.includes('<!doctype')) {
        setError('The uploaded file does not appear to be valid HTML');
        e.target.value = '';
        return;
      }

      await loadStory(content);
      setUploadedFileName(file.name);
      // Clear AO3 URL since we're now using uploaded file
      setAo3Url('');
    } catch (err) {
      console.error('Error processing uploaded HTML:', err);
      setError('Failed to process HTML file');
      e.target.value = '';
    } finally {
      setLoading(false);
    }
  };

  const handleAo3Fetch = async () => {
    if (!ao3Url) {
      setError('Please enter an AO3 URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fetch-ao3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ao3Url }),
      });

      if (!response.ok) {
        // Prefer the API's specific message; gateway timeouts (504) come back as non-JSON.
        let message = '';
        try {
          message = (await response.json())?.error ?? '';
        } catch {}
        if (!message && response.status === 504) {
          message = 'AO3 took too long to respond. Try again in a moment, or: On AO3, use Download → HTML, then upload that file here instead.';
        }
        throw new Error(message || 'Failed to fetch from AO3');
      }

      await loadStory(await response.text(), ao3Url);

      // Clear any uploaded file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      setUploadedFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch from AO3');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!htmlContent) {
      setError('Please upload HTML or fetch from AO3 first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { cleanHtml } = await import('@/lib/html-cleaner');
      const options = buildOptions();
      const cleanedHtml = cleanHtml(htmlContent, options);

      if (downloadFormat === 'pdf') {
        const { generatePdf } = await import('@/lib/pdf-generator');
        const pdfBytes = await generatePdf(cleanedHtml, options);
        downloadBlob(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), getFilename('pdf'));
      } else {
        downloadBlob(new Blob([cleanedHtml], { type: 'text/html;charset=utf-8' }), getFilename('html'));
      }
    } catch (err) {
      console.error('Error generating file:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate file');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!htmlContent) {
      setError('Please upload HTML or fetch from AO3 first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { cleanHtml } = await import('@/lib/html-cleaner');
      const { generatePdf } = await import('@/lib/pdf-generator');
      const options = buildOptions();
      // Same layout as the real PDF, stopped after the first pages
      const pdfBytes = await generatePdf(cleanHtml(htmlContent, options), options, PREVIEW_PAGES);
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl(window.URL.createObjectURL(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })));
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            AO3 Typesetter
          </h1>
          <p className="text-slate-600 mb-8">
            Create clean typesets of AO3 stories
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Input Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* File Upload */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-slate-400 transition-colors">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">
                Upload HTML File
              </h2>
              <label className="block">
                <input
                  type="file"
                  accept=".html,.htm,.xhtml,text/html,application/xhtml+xml"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-slate-700 file:text-white
                    hover:file:bg-slate-800 file:cursor-pointer"
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">Accepts: .html, .htm, .xhtml files only</p>
              {htmlContent && !ao3Url && (
                <p className="text-green-600 text-sm mt-3">✓ {uploadedFileName}</p>
              )}
            </div>

            {/* AO3 Fetch */}
            <div className="border-2 border-slate-300 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">
                Fetch from AO3
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://archiveofourown.org/works/..."
                  value={ao3Url}
                  onChange={(e) => setAo3Url(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <button
                  onClick={handleAo3Fetch}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-400 transition-colors font-medium"
                >
                  Fetch
                </button>
              </div>
              {htmlContent && ao3Url && (
                <p className="text-green-600 text-sm mt-2">✓ Story loaded</p>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="border-t-2 border-slate-300 pt-8 mb-8 mt-8">
            <SectionHeader level={2}>Settings</SectionHeader>

            {/* Page Size and Margins */}
            <div className={`mb-8 p-6 ${colors.primary.bg} rounded-xl border ${colors.primary.border}`}>
              <SectionHeader level={3}>Page Size & Margins</SectionHeader>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Page Size</h4>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <NumberInput
                        label="Width"
                        value={settings.pageWidth}
                        onChange={(value) => updateSetting('pageWidth', value)}
                      />
                    </div>
                    <div className="flex-1">
                      <NumberInput
                        label="Height"
                        value={settings.pageHeight}
                        onChange={(value) => updateSetting('pageHeight', value)}
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-600 mb-1">Unit</label>
                      <select
                        value={settings.pageUnit}
                        onChange={(e) => updateSetting('pageUnit', e.target.value as 'in' | 'cm')}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="in">in</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Default: 5.5 × 8.5 in (Half Letter)</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Margins</h4>
                  
                  <div className="mb-3">
                    <Checkbox
                      checked={settings.useAlternatingMargins}
                      onChange={(checked) => updateSetting('useAlternatingMargins', checked)}
                      label="Different margins for even and odd pages"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <NumberInput label="Top" value={settings.marginTop} onChange={(value) => updateSetting('marginTop', value)} />
                    <NumberInput label="Bottom" value={settings.marginBottom} onChange={(value) => updateSetting('marginBottom', value)} />
                    {!settings.useAlternatingMargins ? (
                      <>
                        <NumberInput label="Left" value={settings.marginLeft} onChange={(value) => updateSetting('marginLeft', value)} />
                        <NumberInput label="Right" value={settings.marginRight} onChange={(value) => updateSetting('marginRight', value)} />
                      </>
                    ) : (
                      <>
                        <NumberInput label="Inner (binding)" value={settings.innerMargin} onChange={(value) => updateSetting('innerMargin', value)} />
                        <NumberInput label="Outer (edge)" value={settings.outerMargin} onChange={(value) => updateSetting('outerMargin', value)} />
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.marginUnit}
                      onChange={(e) => updateSetting('marginUnit', e.target.value as 'in' | 'cm')}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="in">inches</option>
                      <option value="cm">cm</option>
                    </select>
                    <p className="text-xs text-slate-500">Default: 0.5 in all sides</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Preview</h4>
                  <div className="flex items-center justify-center gap-2" style={{ height: '180px' }}>
                    <PageMarginPreview
                      pageWidth={settings.pageWidth}
                      pageHeight={settings.pageHeight}
                      pageUnit={settings.pageUnit}
                      marginTop={settings.marginTop}
                      marginBottom={settings.marginBottom}
                      marginLeft={settings.marginLeft}
                      marginRight={settings.marginRight}
                      marginUnit={settings.marginUnit}
                      useAlternatingMargins={settings.useAlternatingMargins}
                      innerMargin={settings.innerMargin}
                      outerMargin={settings.outerMargin}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    {settings.useAlternatingMargins ? (
                      <>
                        <span className="inline-block w-3 h-3 bg-blue-200 border border-blue-400 mr-1"></span>
                        Outer · 
                        <span className="inline-block w-3 h-3 bg-green-200 border border-green-500 mx-1"></span>
                        Inner · 
                        <span className="inline-block w-3 h-3 bg-red-200 border border-red-400 mx-1"></span>
                        Top/Bottom
                      </>
                    ) : (
                      'Red areas show margins'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Title Override Section - Accordion */}
            <div className="mb-10 pb-8 border-b border-slate-200">
              <button
                onClick={() => setShowOverrideSection(!showOverrideSection)}
                className={`w-full flex items-center justify-between p-4 border-2 ${colors.secondary.border} rounded-xl ${colors.secondary.bg} ${colors.secondary.hover} transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">✏️</span>
                  <h3 className="text-lg font-medium text-slate-700">
                    Title & Author Override (Optional)
                  </h3>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform ${showOverrideSection ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showOverrideSection && (
                <div className={`mt-4 p-6 ${colors.secondary.bg} border ${colors.secondary.border} rounded-xl`}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className={`text-base font-medium ${colors.tertiary.text} mb-1`}>
                        Warning: For Styling Purposes Only
                      </h4>
                      <p className={`text-sm ${colors.primary.text}`}>
                        <strong>Never use this to remove credit or claim someone else&apos;s work as your own.</strong> These fields 
                        only adjust how the title and author appear in your PDF for personal styling preferences.
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <TextInput
                        label="Custom Title"
                        value={settings.customTitle}
                        onChange={(value) => updateSetting('customTitle', value)}
                        placeholder=""
                      />
                      {metadataLoaded && !settings.customTitle && (
                        <p className={`${colors.secondary.text} text-xs mt-1`}>Title not found in HTML</p>
                      )}
                    </div>
                    <div>
                      <TextInput
                        label="Custom Author"
                        value={settings.customAuthor}
                        onChange={(value) => updateSetting('customAuthor', value)}
                        placeholder=""
                      />
                      {metadataLoaded && !settings.customAuthor && (
                        <p className={`${colors.secondary.text} text-xs mt-1`}>Author not found in HTML</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>


            <div className={`mb-8 p-6 ${colors.secondary.bg} rounded-xl border ${colors.secondary.border}`}>
              <TextInput
                label="Binder Name (Optional)"
                value={settings.binderName}
                onChange={(value) => updateSetting('binderName', value)}
                placeholder="Your name"
                helperText="Add 'Binded by: [name]' to the copyright page"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Cleaning Options */}
              <div className={`p-6 ${colors.primary.bg} rounded-xl border ${colors.primary.border}`}>
                <SectionHeader level={3}>Content Cleaning</SectionHeader>
                <div className="space-y-3">
                  {cleaningOptions.map(option => (
                    <Checkbox
                      key={option.key}
                      checked={settings[option.key]}
                      onChange={(checked) => updateSetting(option.key, checked)}
                      label={option.label}
                    />
                  ))}
                </div>
              </div>

              {/* Formatting Options */}
              <div className={`p-6 ${colors.primary.bg} rounded-xl border ${colors.primary.border}`}>
                <SectionHeader level={3}>Formatting</SectionHeader>
                <div className="space-y-4">
                  <RangeSlider
                    label="Font Size"
                    value={settings.fontSize}
                    onChange={(value) => updateSetting('fontSize', value)}
                    min={6}
                    max={16}
                    step={0.5}
                  />
                  <RangeSlider
                    label="Line Spacing"
                    value={settings.lineSpacing}
                    onChange={(value) => updateSetting('lineSpacing', value)}
                    min={1.0}
                    max={2.5}
                    step={0.1}
                    unit=""
                  />
                  {formattingCheckboxes.map(option => (
                    <Checkbox
                      key={option.key}
                      checked={settings[option.key]}
                      onChange={(checked) => updateSetting(option.key, checked)}
                      label={option.label}
                    />
                  ))}
                  <TextInput
                    label="Dinkus Symbol (section break)"
                    value={settings.dinkusSymbol}
                    onChange={(value) => updateSetting('dinkusSymbol', value)}
                    placeholder="***"
                  />


                  {/* Headers */}
                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <Checkbox
                      checked={settings.showHeaders}
                      onChange={(checked) => updateSetting('showHeaders', checked)}
                      label="Show Headers (title on odd pages, author on even pages)"
                    />
                    {settings.showHeaders && (
                      <RadioGroup
                        name="headerOption"
                        value={settings.hideHeadersUntilChapter1}
                        onChange={(value) => updateSetting('hideHeadersUntilChapter1', value)}
                        falseLabel="Show on all pages"
                        trueLabel="Hide until Chapter 1"
                      />
                    )}
                  </div>
                  
                  {/* Page Numbers */}
                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <Checkbox
                      checked={settings.showPageNumbers}
                      onChange={(checked) => updateSetting('showPageNumbers', checked)}
                      label="Show Page Numbers"
                    />
                    {settings.showPageNumbers && (
                      <RadioGroup
                        name="pageNumberOption"
                        value={settings.hidePageNumbersUntilChapter1}
                        onChange={(value) => updateSetting('hidePageNumbersUntilChapter1', value)}
                        falseLabel="Start from page 1"
                        trueLabel="Hide until Chapter 1 (shows actual page #)"
                      />
                    )}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          {/* Download Format Selection */}
          <div className="border-t-2 border-slate-300 pt-8 mb-8 mt-8">
            <SectionHeader>Download Format</SectionHeader>
            <div className="flex gap-4">
              <label className="flex items-center gap-3 cursor-pointer px-4 py-3 border-2 rounded-lg transition-colors hover:bg-slate-50 flex-1">
                <input
                  type="radio"
                  name="downloadFormat"
                  value="pdf"
                  checked={downloadFormat === 'pdf'}
                  onChange={(e) => setDownloadFormat(e.target.value as 'pdf' | 'html')}
                  className="w-5 h-5 text-slate-700 focus:ring-2 focus:ring-slate-500"
                />
                <div>
                  <span className="text-slate-700 font-medium">PDF</span>
                  <p className="text-sm text-slate-500">Generate formatted PDF document</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer px-4 py-3 border-2 rounded-lg transition-colors hover:bg-slate-50 flex-1">
                <input
                  type="radio"
                  name="downloadFormat"
                  value="html"
                  checked={downloadFormat === 'html'}
                  onChange={(e) => setDownloadFormat(e.target.value as 'pdf' | 'html')}
                  className="w-5 h-5 text-slate-700 focus:ring-2 focus:ring-slate-500"
                />
                <div>
                  <span className="text-slate-700 font-medium">HTML</span>
                  <p className="text-sm text-slate-500">Download cleaned HTML</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t-2 border-slate-300 pt-8 mt-8">
            <div className="flex gap-4">
              <button
                onClick={handlePreview}
                disabled={loading || !htmlContent}
                className="flex-1 py-4 bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
              >
                Preview First 5 Pages
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={loading || !htmlContent}
                className="flex-1 py-4 bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
              >
                {loading ? 'Processing...' : `Generate ${downloadFormat.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-600 text-sm">
          <p>Upload an HTML file or fetch a story from AO3 to get started</p>
        </div>
      </main>

      {/* Preview Modal */}
      <PreviewModal 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        pdfUrl={previewUrl}
      />
    </div>
  );
}
