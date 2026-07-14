import Reveal from './Reveal';
import { Eyebrow } from './Eyebrow';

/**
 * Header halaman editorial: eyebrow mono + judul display besar + subjudul,
 * dengan slot kanan (mis. tombol aksi). Reveal saat masuk viewport.
 */
export default function PageHeader({ eyebrow, title, subtitle, right }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-10 sm:mb-12">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="mt-3 max-w-xl text-[var(--ink-2)] text-sm sm:text-[15px] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </Reveal>
  );
}
