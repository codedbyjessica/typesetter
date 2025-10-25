interface PageMarginPreviewProps {
  pageWidth: number;
  pageHeight: number;
  pageUnit: 'in' | 'cm';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  marginUnit: 'in' | 'cm';
  useAlternatingMargins: boolean;
  innerMargin: number;
  outerMargin: number;
}

export const PageMarginPreview = ({
  pageWidth,
  pageHeight,
  pageUnit,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  marginUnit,
  useAlternatingMargins,
  innerMargin,
  outerMargin
}: PageMarginPreviewProps) => {
  // Convert all to same unit for calculation (inches)
  const pageWidthIn = pageUnit === 'cm' ? pageWidth / 2.54 : pageWidth;
  const pageHeightIn = pageUnit === 'cm' ? pageHeight / 2.54 : pageHeight;
  const marginTopIn = marginUnit === 'cm' ? marginTop / 2.54 : marginTop;
  const marginBottomIn = marginUnit === 'cm' ? marginBottom / 2.54 : marginBottom;
  
  // Scale factor to fit in preview (max 150px height)
  const scale = Math.min(150 / (pageHeightIn * 20), 1);
  const previewWidth = pageWidthIn * 20 * scale;
  const previewHeight = pageHeightIn * 20 * scale;
  const previewMarginTop = marginTopIn * 20 * scale;
  const previewMarginBottom = marginBottomIn * 20 * scale;
  
  if (!useAlternatingMargins) {
    // Single page preview
    const marginLeftIn = marginUnit === 'cm' ? marginLeft / 2.54 : marginLeft;
    const marginRightIn = marginUnit === 'cm' ? marginRight / 2.54 : marginRight;
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
  }
  
  // Two-page spread preview
  const innerMarginIn = marginUnit === 'cm' ? innerMargin / 2.54 : innerMargin;
  const outerMarginIn = marginUnit === 'cm' ? outerMargin / 2.54 : outerMargin;
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
};

