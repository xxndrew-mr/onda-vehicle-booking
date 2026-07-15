export function Eyebrow({ children, className = '' }) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

export function SectionHead({ num, title, tag, right }) {
  return (
    <div className="section-head">
      {num && <span className="section-head__num">{num}</span>}
      <span className="section-head__title">{title}</span>
      <span className="section-head__rule" />
      {tag && <span className="section-head__tag">{tag}</span>}
      {right}
    </div>
  );
}
