import { ArrowUpRight } from 'lucide-react';

/**
 * Tombol pill editorial (Space Mono uppercase). Varian: primary | ghost | danger.
 * `arrow` menampilkan panah ↗ yang bergeser saat hover (khusus aksi utama/link).
 * Menerima semua prop button standar (onClick, disabled, type, dll).
 */
export default function Button({
  children,
  variant = 'primary',
  size,
  arrow = false,
  className = '',
  ...rest
}) {
  const cls = [
    'pill',
    `pill--${variant}`,
    size === 'sm' ? 'pill--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
      {arrow && <ArrowUpRight size={15} className="pill__arrow" />}
    </button>
  );
}
