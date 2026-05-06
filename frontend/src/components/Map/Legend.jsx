export default function Legend({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-3 z-[400] bg-white/95 backdrop-blur border border-edena-secondary rounded shadow-sm px-3 py-2 max-w-[260px]">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Légende</div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-gray-800">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.color, opacity: 0.85 }} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
