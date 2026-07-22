import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextInput({ id, label, hint, error, className = "", ...props }: TextInputProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`text-input ${error ? "text-input-error" : ""} ${className}`.trim()}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <p className="field-message field-error" id={`${id}-error`}>{error}</p>
      ) : hint ? (
        <p className="field-message" id={`${id}-hint`}>{hint}</p>
      ) : null}
    </div>
  );
}
