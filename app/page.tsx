'use client';

import { useState } from 'react';

// Reusable Components
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const Checkbox = ({ checked, onChange, label }: CheckboxProps) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-5 h-5 rounded border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500"
    />
    <span className="text-slate-700">{label}</span>
  </label>
);

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

const NumberInput = ({ label, value, onChange, step = 0.1, min, max }: NumberInputProps) => (
  <div>
    <label className="block text-xs text-slate-600 mb-1">{label}</label>
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
    />
  </div>
);

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
}

const TextInput = ({ label, value, onChange, placeholder, helperText }: TextInputProps) => (
  <div>
    <label className="block text-slate-700 mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
    />
    {helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
  </div>
);

interface RangeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit?: string;
}

const RangeSlider = ({ label, value, onChange, min, max, unit = 'pt' }: RangeSliderProps) => (
  <div>
    <label className="block text-slate-700 mb-2">
      {label}: {value}{unit}
    </label>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
    />
    <div className="flex justify-between text-xs text-slate-500 mt-1">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

interface SectionHeaderProps {
  children: React.ReactNode;
  level?: 2 | 3;
}

const SectionHeader = ({ children, level = 2 }: SectionHeaderProps) => {
  const className = level === 2 
    ? "text-2xl font-semibold text-slate-800 mb-6"
    : "text-lg font-medium text-slate-700 mb-4";
  
  return level === 2 ? (
    <h2 className={className}>{children}</h2>
  ) : (
    <h3 className={className}>{children}</h3>
  );
};

export default function Home() {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [ao3Url, setAo3Url] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'html'>('pdf');
  const [showOverrideSection, setShowOverrideSection] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  
  // Structured settings state
  const [settings, setSettings] = useState({
    // Content cleaning
    removeEndnotes: true,
    removeImages: true,
    removeFootnotes: true,
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
    { key: 'removeFootnotes' as const, label: 'Remove afterword' },
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

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      
      // Validate it's actually HTML content
      if (!content.trim().toLowerCase().includes('<html') && !content.trim().toLowerCase().includes('<!doctype')) {
        setError('The uploaded file does not appear to be valid HTML');
        e.target.value = '';
        setLoading(false);
        return;
      }
      
      try {
        // Process through the same function as AO3 fetch
        const { processAO3Html } = await import('@/lib/html-cleaner');
        const { html, title, author } = processAO3Html(content);
        
        setHtmlContent(html);
        setError('');
        setUploadedFileName(file.name);
        setMetadataLoaded(false);
        
        // Auto-populate title and author
        updateSetting('customTitle', title);
        updateSetting('customAuthor', author);
        setMetadataLoaded(true);
        
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
    
    reader.onerror = () => {
      setError('Failed to read file');
      e.target.value = '';
      setLoading(false);
    };
    
    reader.readAsText(file);
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
        throw new Error('Failed to fetch from AO3');
      }

      const data = await response.json();
      setHtmlContent(data.html);
      
      // Clear any uploaded file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      setUploadedFileName('');
      
      // Use title/author from API (already extracted by shared processAO3Html function)
      updateSetting('customTitle', data.title || '');
      updateSetting('customAuthor', data.author || '');
      setMetadataLoaded(true);
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

    const options = settings;

    try {
      if (downloadFormat === 'pdf') {
        // Generate and download PDF
        const pdfResponse = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlContent,
            options,
          }),
        });

        if (!pdfResponse.ok) {
          throw new Error('Failed to generate PDF');
        }

        const pdfBlob = await pdfResponse.blob();
        const pdfUrl = window.URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = getFilename('pdf');
        document.body.appendChild(pdfLink);
        pdfLink.click();
        window.URL.revokeObjectURL(pdfUrl);
        document.body.removeChild(pdfLink);
      } else {
        // Download cleaned HTML
        const htmlResponse = await fetch('/api/preview-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlContent,
            options,
          }),
        });

        if (!htmlResponse.ok) {
          throw new Error('Failed to generate HTML');
        }

        const htmlBlob = await htmlResponse.blob();
        const htmlUrl = window.URL.createObjectURL(htmlBlob);
        const htmlLink = document.createElement('a');
        htmlLink.href = htmlUrl;
        htmlLink.download = getFilename('html');
        document.body.appendChild(htmlLink);
        htmlLink.click();
        window.URL.revokeObjectURL(htmlUrl);
        document.body.removeChild(htmlLink);
      }
    } catch (err) {
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

    const options = settings;

    try {
      const htmlResponse = await fetch('/api/preview-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlContent,
          options,
        }),
      });

      if (!htmlResponse.ok) {
        throw new Error('Failed to generate preview');
      }

      const htmlText = await htmlResponse.text();
      setPreviewHtml(htmlText);
      setShowPreview(true);
    } catch (err) {
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
            Typesetter
          </h1>
          <p className="text-slate-600 mb-8">
            Create beautiful PDFs from HTML files or AO3 stories
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
          <div className="border-t border-slate-200 pt-8 mb-8">
            <SectionHeader level={2}>Settings</SectionHeader>

            {/* Page Size and Margins */}
            <div className="mb-8 p-6 bg-slate-50 rounded-xl">
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
                      label="Alternating margins (for book binding)"
                    />
                  </div>
                  
                  {!settings.useAlternatingMargins ? (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <NumberInput label="Top" value={settings.marginTop} onChange={(value) => updateSetting('marginTop', value)} />
                      <NumberInput label="Bottom" value={settings.marginBottom} onChange={(value) => updateSetting('marginBottom', value)} />
                      <NumberInput label="Left" value={settings.marginLeft} onChange={(value) => updateSetting('marginLeft', value)} />
                      <NumberInput label="Right" value={settings.marginRight} onChange={(value) => updateSetting('marginRight', value)} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <NumberInput label="Top" value={settings.marginTop} onChange={(value) => updateSetting('marginTop', value)} />
                      <NumberInput label="Bottom" value={settings.marginBottom} onChange={(value) => updateSetting('marginBottom', value)} />
                      <NumberInput label="Inner (binding)" value={settings.innerMargin} onChange={(value) => updateSetting('innerMargin', value)} />
                      <NumberInput label="Outer (edge)" value={settings.outerMargin} onChange={(value) => updateSetting('outerMargin', value)} />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.marginUnit}
                      onChange={(e) => updateSetting('marginUnit', e.target.value as 'in' | 'cm')}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="in">inches</option>
                      <option value="cm">cm</option>
                    </select>
                    <p className="text-xs text-slate-500">Default: 1 in all sides</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Preview</h4>
                  <div className="flex items-center justify-center gap-2" style={{ height: '180px' }}>
                    {(() => {
                      // Convert all to same unit for calculation (inches)
                      const pageWidthIn = settings.pageUnit === 'cm' ? settings.pageWidth / 2.54 : settings.pageWidth;
                      const pageHeightIn = settings.pageUnit === 'cm' ? settings.pageHeight / 2.54 : settings.pageHeight;
                      const marginTopIn = settings.marginUnit === 'cm' ? settings.marginTop / 2.54 : settings.marginTop;
                      const marginBottomIn = settings.marginUnit === 'cm' ? settings.marginBottom / 2.54 : settings.marginBottom;
                      
                      // Scale factor to fit in preview (max 150px height)
                      const scale = Math.min(150 / (pageHeightIn * 20), 1);
                      const previewWidth = pageWidthIn * 20 * scale;
                      const previewHeight = pageHeightIn * 20 * scale;
                      const previewMarginTop = marginTopIn * 20 * scale;
                      const previewMarginBottom = marginBottomIn * 20 * scale;
                      
                      if (!settings.useAlternatingMargins) {
                        // Single page preview
                        const marginLeftIn = settings.marginUnit === 'cm' ? settings.marginLeft / 2.54 : settings.marginLeft;
                        const marginRightIn = settings.marginUnit === 'cm' ? settings.marginRight / 2.54 : settings.marginRight;
                        const previewMarginLeft = marginLeftIn * 20 * scale;
                        const previewMarginRight = marginRightIn * 20 * scale;
                        
                        return (
                          <div 
                            style={{
                              width: `${previewWidth}px`,
                              height: `${previewHeight}px`,
                              position: 'relative',
                              border: '2px solid #94a3b8',
                              backgroundColor: 'white',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                          >
                            {/* Margin overlays */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: `${previewMarginTop}px`,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              borderBottom: '1px dashed #ef4444'
                            }} />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${previewMarginBottom}px`,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              borderTop: '1px dashed #ef4444'
                            }} />
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width: `${previewMarginLeft}px`,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              borderRight: '1px dashed #ef4444'
                            }} />
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bottom: 0,
                              width: `${previewMarginRight}px`,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              borderLeft: '1px dashed #ef4444'
                            }} />
                            <div style={{
                              position: 'absolute',
                              top: `${previewMarginTop}px`,
                              left: `${previewMarginLeft}px`,
                              right: `${previewMarginRight}px`,
                              bottom: `${previewMarginBottom}px`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '8px',
                              color: '#64748b',
                              textAlign: 'center'
                            }}>
                              <div>Content<br/>Area</div>
                            </div>
                          </div>
                        );
                      } else {
                        // Two-page spread preview
                        const innerMarginIn = settings.marginUnit === 'cm' ? settings.innerMargin / 2.54 : settings.innerMargin;
                        const outerMarginIn = settings.marginUnit === 'cm' ? settings.outerMargin / 2.54 : settings.outerMargin;
                        const previewInnerMargin = innerMarginIn * 20 * scale;
                        const previewOuterMargin = outerMarginIn * 20 * scale;
                        
                        const PagePreview = ({ isEven }: { isEven: boolean }) => (
                          <div style={{ textAlign: 'center' }}>
                            <div 
                              style={{
                                width: `${previewWidth}px`,
                                height: `${previewHeight}px`,
                                position: 'relative',
                                border: '2px solid #94a3b8',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                marginBottom: '4px'
                              }}
                            >
                              {/* Top margin */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: `${previewMarginTop}px`,
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                borderBottom: '1px dashed #ef4444'
                              }} />
                              {/* Bottom margin */}
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${previewMarginBottom}px`,
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                borderTop: '1px dashed #ef4444'
                              }} />
                              {/* Left margin (outer for even, inner for odd) */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: `${isEven ? previewOuterMargin : previewInnerMargin}px`,
                                backgroundColor: isEven ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                borderRight: `1px dashed ${isEven ? '#3b82f6' : '#22c55e'}`
                              }} />
                              {/* Right margin (inner for even, outer for odd) */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: `${isEven ? previewInnerMargin : previewOuterMargin}px`,
                                backgroundColor: isEven ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                borderLeft: `1px dashed ${isEven ? '#22c55e' : '#3b82f6'}`
                              }} />
                              <div style={{
                                position: 'absolute',
                                top: `${previewMarginTop}px`,
                                left: `${isEven ? previewOuterMargin : previewInnerMargin}px`,
                                right: `${isEven ? previewInnerMargin : previewOuterMargin}px`,
                                bottom: `${previewMarginBottom}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                color: '#64748b',
                                textAlign: 'center'
                              }}>
                                <div>Content</div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600">{isEven ? 'Even' : 'Odd'}</p>
                          </div>
                        );
                        
                        return (
                          <>
                            <PagePreview isEven={true} />
                            <PagePreview isEven={false} />
                          </>
                        );
                      }
                    })()}
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
            <div className="mb-8">
              <button
                onClick={() => setShowOverrideSection(!showOverrideSection)}
                className="w-full flex items-center justify-between p-4 border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
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
                <div className="mt-4 p-6 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="text-base font-medium text-amber-900 mb-1">
                        Warning: For Styling Purposes Only
                      </h4>
                      <p className="text-sm text-amber-800">
                        <strong>Never use this to remove credit or claim someone else&apos;s work as your own.</strong> These fields 
                        only adjust how the title and author appear in your PDF for personal styling preferences.
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <TextInput
                        label="Custom Title"
                        value={settings.customTitle}
                        onChange={(value) => updateSetting('customTitle', value)}
                        placeholder=""
                      />
                      {metadataLoaded && !settings.customTitle && (
                        <p className="text-amber-600 text-xs mt-1">Title not found in HTML</p>
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
                        <p className="text-amber-600 text-xs mt-1">Author not found in HTML</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Cleaning Options */}
              <div>
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
              <div>
                <SectionHeader level={3}>Formatting</SectionHeader>
                <div className="space-y-4">
                  <RangeSlider
                    label="Font Size"
                    value={settings.fontSize}
                    onChange={(value) => updateSetting('fontSize', value)}
                    min={6}
                    max={16}
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Line Spacing: {settings.lineSpacing.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={settings.lineSpacing}
                      onChange={(e) => updateSetting('lineSpacing', parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>1.0 (tight)</span>
                      <span>2.5 (loose)</span>
                    </div>
                  </div>
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
                      label="Show Headers (Title on odd pages, Author on even pages)"
                    />
                    {settings.showHeaders && (
                      <div className="ml-6 mt-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="headerOption"
                            checked={!settings.hideHeadersUntilChapter1}
                            onChange={() => {
                              updateSetting('hideHeadersUntilChapter1', false);
                            }}
                            className="w-4 h-4 text-slate-700 focus:ring-2 focus:ring-slate-500"
                          />
                          <span className="text-sm text-slate-700">Show on all pages</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="headerOption"
                            checked={settings.hideHeadersUntilChapter1}
                            onChange={() => {
                              updateSetting('hideHeadersUntilChapter1', true);
                            }}
                            className="w-4 h-4 text-slate-700 focus:ring-2 focus:ring-slate-500"
                          />
                          <span className="text-sm text-slate-700">Hide until Chapter 1</span>
                        </label>
                      </div>
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
                      <div className="ml-6 mt-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pageNumberOption"
                            checked={!settings.hidePageNumbersUntilChapter1}
                            onChange={() => {
                              updateSetting('hidePageNumbersUntilChapter1', false);
                            }}
                            className="w-4 h-4 text-slate-700 focus:ring-2 focus:ring-slate-500"
                          />
                          <span className="text-sm text-slate-700">Start from page 1</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pageNumberOption"
                            checked={settings.hidePageNumbersUntilChapter1}
                            onChange={() => {
                              updateSetting('hidePageNumbersUntilChapter1', true);
                            }}
                            className="w-4 h-4 text-slate-700 focus:ring-2 focus:ring-slate-500"
                          />
                          <span className="text-sm text-slate-700">Hide until Chapter 1 (shows actual page #)</span>
                        </label>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          {/* Download Format Selection */}
          <div className="border-t border-slate-200 pt-8 mb-6">
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
                  <p className="text-sm text-slate-500">Preview cleaned HTML</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-slate-200 pt-8">
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
      {showPreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">Preview - First 5 Pages</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-3xl leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-hidden p-6">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border border-slate-200 rounded-lg bg-white"
                title="Preview"
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
