/** "38/47 · 81% · 5 en acuerdo" con barra de tres tramos: pagado, en acuerdo, pendiente. */
export function ProgressBar({
  value,
  committed = 0,
  total,
  className,
  unidad = "pagados",
}: {
  value: number
  committed?: number
  total: number
  className?: string
  unidad?: string
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  const pctComm = total === 0 ? 0 : Math.round((committed / total) * 100)
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[13px] font-medium">
        <span>
          {value}/{total} {unidad}
          {committed > 0 ? <span className="text-warn"> · {committed} en acuerdo</span> : null}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div
        className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${value} de ${total} ${unidad}, ${committed} en acuerdo de pago`}
      >
        <div className="h-full bg-raza transition-[width] duration-200" style={{ width: `${pct}%` }} />
        <div className="h-full bg-warn transition-[width] duration-200" style={{ width: `${pctComm}%` }} />
      </div>
    </div>
  )
}
