/**
 * Header halaman konsisten: chip ikon biru + judul + subjudul opsional,
 * dengan slot kanan (mis. tombol aksi).
 */
export default function PageHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-blue-50 text-blue-700 shrink-0">
            <Icon size={22} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
