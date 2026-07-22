import type { CSSProperties } from "react";

type ProgressProps = {
  label: string;
  value: number;
  showValue?: boolean;
};

export function Progress({ label, value, showValue = true }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const style = { "--progress-value": `${clampedValue}%` } as CSSProperties;

  return (
    <div className="progress-group">
      <div className="progress-copy">
        <span>{label}</span>
        {showValue ? <span>{clampedValue}%</span> : null}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedValue}
      >
        <span className="progress-fill" style={style} />
      </div>
    </div>
  );
}
