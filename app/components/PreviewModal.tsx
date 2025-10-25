interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
}

export const PreviewModal = ({ isOpen, onClose, htmlContent }: PreviewModalProps) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Preview - First 5 Pages</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-3xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="flex-1 overflow-hidden p-6">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full border border-slate-200 rounded-lg bg-white"
            title="Preview"
          />
        </div>
        
        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

