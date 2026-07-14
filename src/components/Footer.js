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
  return (
    <footer className="bg-blue-800 text-white text-center text-xs p-4 font-bold cursor-default group transition-all duration-300">
      <div className="flex items-center justify-center gap-0 group-hover:gap-3 transition-all duration-300">
        {/* Teks copyright permanen */}
        <span>© 2025 PT ONDA MEGA INTEGRA</span>

        {/* Bagian yang mengembang saat hover */}
        <div className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[300px] group-hover:opacity-100 transition-all duration-500 ease-in-out whitespace-nowrap">
          <a
            href="https://www.linkedin.com/in/andre-marshandito/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors duration-200"
          >
            <span className="font-medium">— Created by Andre Marshandito</span>
            <LinkedinIcon size={16} className="mb-0.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
