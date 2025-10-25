// Reusable Form Components

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const Checkbox = ({ checked, onChange, label }: CheckboxProps) => (
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

export const NumberInput = ({ label, value, onChange, step = 0.1, min, max }: NumberInputProps) => (
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

export const TextInput = ({ label, value, onChange, placeholder, helperText }: TextInputProps) => (
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
  step?: number;
}

export const RangeSlider = ({ label, value, onChange, min, max, unit = 'pt', step = 1 }: RangeSliderProps) => (
  <div>
    <label className="block text-slate-700 mb-2">
      {label}: {value}{unit}
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
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

export const SectionHeader = ({ children, level = 2 }: SectionHeaderProps) => {
  const className = level === 2 
    ? "text-2xl font-semibold text-slate-800 mb-6"
    : "text-lg font-medium text-slate-700 mb-4";
  
  return level === 2 ? (
    <h2 className={className}>{children}</h2>
  ) : (
    <h3 className={className}>{children}</h3>
  );
};

