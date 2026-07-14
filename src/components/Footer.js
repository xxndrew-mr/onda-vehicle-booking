// Ikon LinkedIn inline (lucide-react versi ini tidak menyertakan ikon brand).
function LinkedinIcon({ size = 16, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export default function Footer() {
  // Kredit "Andre" tersembunyi — muncul melebar saat kursor mengarah ke footer
  // (atau saat tautannya difokus via keyboard, agar tetap aksesibel).
  return (
    <footer className="footer-surface mt-16 group cursor-default">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-center gap-0 transition-all duration-300 group-hover:gap-3">
        {/* Copyright permanen */}
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-white/85">
          © 2025 — PT Onda Mega Integra
        </span>

        {/* Bagian yang melebar saat hover / fokus keyboard */}
        <div className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out group-hover:max-w-[340px] group-hover:opacity-100 group-focus-within:max-w-[340px] group-focus-within:opacity-100">
          <a
            href="https://www.linkedin.com/in/andre-marshandito/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 pl-1 mono text-[11px] uppercase tracking-[0.14em] text-white/75 hover:text-white transition-colors"
          >
            <span>— Created by Andre Marshandito</span>
            <LinkedinIcon size={14} className="transition-transform group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
