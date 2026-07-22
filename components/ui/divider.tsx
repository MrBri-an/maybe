type DividerProps = {
  label?: string;
};

export function Divider({ label }: DividerProps) {
  if (!label) {
    return <hr className="divider" />;
  }

  return (
    <div className="divider-with-label" role="separator" aria-label={label}>
      <span aria-hidden="true" />
      <p>{label}</p>
      <span aria-hidden="true" />
    </div>
  );
}
