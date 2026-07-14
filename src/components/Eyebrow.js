/** Label mono biru + garis pendek (kategori/eyebrow). */
export function Eyebrow({ children, className = '' }) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

/**
 * Section header bernomor: 01 — Judul ———— tag. `num` opsional (untuk konten
 * berurutan). `tag` opsional (label kanan). `right` untuk elemen aksi.
 */
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
