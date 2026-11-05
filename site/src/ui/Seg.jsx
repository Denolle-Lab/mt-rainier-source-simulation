// Segmented control: one button per option, the chosen one marked.
export function Seg({ value, options, onChange, disabled = {}, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "on" : ""}
          disabled={!!disabled[k]} onClick={() => onChange(k)}>{text}</button>
      ))}
    </div>
  );
}
