import { useRef, useEffect } from 'react';

/**
 * Reveal saat scroll (IntersectionObserver): opacity 0→1 + translateY(26px)→0.
 * Otomatis langsung tampil bila prefers-reduced-motion. Sekali reveal, berhenti diamati.
 */
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.revealed = 'true';
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.dataset.revealed = 'true';
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.14 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/**
 * Wrapper reveal. `delay` (ms) untuk stagger kecil antar item.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useReveal();
  return (
    <Tag ref={ref} data-reveal style={{ transitionDelay: delay ? `${delay}ms` : undefined }} className={className} {...rest}>
      {children}
    </Tag>
  );
}
