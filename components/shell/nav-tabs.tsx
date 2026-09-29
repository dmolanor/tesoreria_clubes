"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NavItem {
  href: string
  label: string
  badge?: number
  icon?: "settings"
}

export function NavTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  // El ítem activo es el de prefijo más largo que coincide (así "Inicio" no queda activo en subrutas).
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Principal">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active === item.href ? "page" : undefined}
          aria-label={item.icon ? item.label : undefined}
          className={cn(
            "flex h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none",
            active === item.href && "border-ink text-foreground",
            item.icon && "ml-auto",
          )}
        >
          {item.icon === "settings" ? <Settings className="size-4" /> : item.label}
          {item.badge ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-raza px-1.5 text-[11px] font-bold text-white">
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
