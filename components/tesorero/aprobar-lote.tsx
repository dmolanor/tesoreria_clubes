"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { aprobarPendientesDelMesAction, type AprobacionLoteResult } from "@/app/actions/comprobantes"

/** Aprueba en lote los pendientes del mes cuando el extracto los respalda. El resultado queda en pantalla. */
export function AprobarLote({ mes, pendientes }: { mes: string; pendientes: number }) {
  const [pending, start] = useTransition()
  const [resultado, setResultado] = useState<AprobacionLoteResult>(null)

  return (
    <div className={pendientes > 0 || resultado ? "space-y-2" : "contents"}>
      {pendientes > 0 ? (
        <Button
          type="button"
          disabled={pending}
          className="bg-raza text-white hover:bg-raza/90"
          onClick={() =>
            start(async () => {
              const r = await aprobarPendientesDelMesAction(mes)
              setResultado(r)
              if (r && !r.ok) toast.error(r.error)
              else if (r?.message) toast.success(r.message)
            })
          }
        >
          {pending ? "Aprobando…" : `Aprobar ${pendientes === 1 ? "1 comprobante pendiente" : `${pendientes} comprobantes pendientes`}`}
        </Button>
      ) : null}
      <div role="status" className="text-[13px]">
        {resultado?.ok ? (
          <>
            <p className="font-medium">{resultado.message}</p>
            {resultado.revision.length ? (
              <>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {resultado.revision.map((r) => (
                    <li key={r.id}>
                      {r.miembro}: {r.motivo}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/tesorero/comprobantes"
                  className="mt-1 inline-block font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none"
                >
                  Revisarlos en Comprobantes
                </Link>
              </>
            ) : null}
          </>
        ) : resultado && !resultado.ok ? (
          <p className="font-medium text-warn">{resultado.error}</p>
        ) : null}
      </div>
    </div>
  )
}
