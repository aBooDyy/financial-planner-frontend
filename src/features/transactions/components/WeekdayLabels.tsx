export function WeekdayLabels({ labels }: { labels: string[] }) {
  return (
    <div className="mb-[6px] grid grid-cols-7 gap-[6px]">
      {labels.map((w) => (
        <div
          key={w}
          className="text-center text-[10.5px] font-bold uppercase tracking-[0.03em] text-fp-text-3"
        >
          {w}
        </div>
      ))}
    </div>
  )
}
