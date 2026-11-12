interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/** iOS-style toggle switch. */
export default function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-green" : "bg-fill"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-pill transition-all duration-200 ${
          checked ? "left-[18px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}