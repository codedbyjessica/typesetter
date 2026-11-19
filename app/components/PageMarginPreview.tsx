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

const RED = { fill: 'rgba(239, 68, 68, 0.2)', line: '#ef4444' };
const BLUE = { fill: 'rgba(59, 130, 246, 0.2)', line: '#3b82f6' };
const GREEN = { fill: 'rgba(34, 197, 94, 0.2)', line: '#22c55e' };
type Swatch = typeof RED;

interface PageBoxProps {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  leftColor: Swatch;
  rightColor: Swatch;
  content: React.ReactNode;
  spaced?: boolean;
}

// One page with its four margin bands drawn as overlays (all sizes in px).
const PageBox = ({ width, height, top, bottom, left, right, leftColor, rightColor, content, spaced }: PageBoxProps) => (
  <div
    style={{
      width: `${width}px`,
      height: `${height}px`,
      position: 'relative',
      border: '2px solid #94a3b8',
      backgroundColor: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: spaced ? '4px' : undefined,
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${top}px`, backgroundColor: RED.fill, borderBottom: `1px dashed ${RED.line}` }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${bottom}px`, backgroundColor: RED.fill, borderTop: `1px dashed ${RED.line}` }} />
    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${left}px`, backgroundColor: leftColor.fill, borderRight: `1px dashed ${leftColor.line}` }} />
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: `${right}px`, backgroundColor: rightColor.fill, borderLeft: `1px dashed ${rightColor.line}` }} />
    <div
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        right: `${right}px`,
        bottom: `${bottom}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
        color: '#64748b',
        textAlign: 'center',
      }}
    >
      {content}
    </div>
  </div>
);

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
  outerMargin,
}: PageMarginPreviewProps) => {
  // Convert to inches, then scale to fit the preview (max 150px height)
  const toIn = (value: number, unit: 'in' | 'cm') => (unit === 'cm' ? value / 2.54 : value);
  const scale = Math.min(150 / (toIn(pageHeight, pageUnit) * 20), 1);
  const page = (value: number) => toIn(value, pageUnit) * 20 * scale;
  const margin = (value: number) => toIn(value, marginUnit) * 20 * scale;

  const size = { width: page(pageWidth), height: page(pageHeight), top: margin(marginTop), bottom: margin(marginBottom) };

  if (!useAlternatingMargins) {
    return (
      <PageBox
        {...size}
        left={margin(marginLeft)}
        right={margin(marginRight)}
        leftColor={RED}
        rightColor={RED}
        content={<div>Content<br />Area</div>}
      />
    );
  }

  // Two-page spread: even pages have the outer margin on the left, odd pages on the right
  const inner = margin(innerMargin);
  const outer = margin(outerMargin);
  return (
    <>
      {[true, false].map((isEven) => (
        <div key={String(isEven)} style={{ textAlign: 'center' }}>
          <PageBox
            {...size}
            left={isEven ? outer : inner}
            right={isEven ? inner : outer}
            leftColor={isEven ? BLUE : GREEN}
            rightColor={isEven ? GREEN : BLUE}
            content={<div>Content</div>}
            spaced
          />
          <p className="text-xs text-slate-600">{isEven ? 'Even' : 'Odd'}</p>
        </div>
      ))}
    </>
  );
};
