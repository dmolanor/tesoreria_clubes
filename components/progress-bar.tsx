/** "38/47 · 81%" con barra. */
export function ProgressBar({ value, total, className, unidad = "pagados" }: { value: number; total: number; className?: string; unidad?: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[13px] font-medium">
        <span>
          {value}/{total} {unidad}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-raza transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
