"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { getCities } from "@/lib/api/cities"

export interface CityOption {
	id: number
	name: string
	latitude?: number
	longitude?: number
}

interface CityComboboxProps {
	value?: number
	onChange?: (cityId: number | undefined) => void
	className?: string
	placeholder?: string
	size?: "sm" | "md"
	variant?: "searchbar" | "form"
}

export function CityCombobox({
	value,
	onChange,
	className,
	placeholder = "Stadt",
	size = "md",
	variant = "searchbar",
}: CityComboboxProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [loading, setLoading] = useState(false)
	const [cities, setCities] = useState<CityOption[]>([])

	const selectedName = useMemo(() => {
		const found = value ? cities.find((c) => c.id === value) : undefined
		return found?.name
	}, [cities, value])
	const displayLabel = selectedName || "Alle Städte"

	// Load full list of 80 German cities (static list, no API limit)
	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				setLoading(true)
				const list = await getCities()
				if (cancelled) return
				const items: CityOption[] = list.map((c) => ({
					id: c.id,
					name: c.name,
					latitude: undefined,
					longitude: undefined,
				}))
				setCities(items)
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	// Client-side filter by search query (no extra API call)
	const filteredCities = useMemo(() => {
		if (!query || query.trim().length === 0) return cities
		const q = query.trim().toLowerCase()
		return cities.filter((c) => c.name.toLowerCase().includes(q))
	}, [cities, query])

	const heightClasses = size === "sm" ? "h-9 text-sm" : "h-10"
	const paddingClasses = size === "sm" ? "pl-2 pr-2.5" : "pl-2.5 pr-3"
	const baseButtonClasses =
		variant === "searchbar"
			? "gap-2 bg-transparent rounded-none border-l border-neutral-300 text-neutral-900 hover:bg-transparent"
			: "gap-2 bg-transparent rounded-sm border border-border text-foreground hover:bg-muted"

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					role="combobox"
					aria-expanded={open}
					className={cn(
						baseButtonClasses,
						"justify-start text-left",
						heightClasses,
						paddingClasses,
						className,
					)}
				>
					<MapPin className="h-4 w-4 opacity-80" />
					<span className="truncate">{displayLabel}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent side="bottom" align="start" avoidCollisions={false} className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]">
				<Command>
					<CommandInput
						placeholder="Stadt suchen..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{loading ? (
							<div className="p-2 text-xs text-muted-foreground">Lädt…</div>
						) : (
							<CommandEmpty>Keine Ergebnisse.</CommandEmpty>
						)}
						<CommandGroup>
							<CommandItem
								value="all"
								onSelect={() => {
									onChange?.(undefined)
									setOpen(false)
								}}
							>
								Alle Städte
							</CommandItem>
							{filteredCities.map((c) => (
								<CommandItem
									key={c.id}
									value={c.name}
									onSelect={(val) => {
										const picked = cities.find(
											(x) => x.name.toLowerCase() === val.toLowerCase(),
										)
										onChange?.(picked?.id)
										setQuery("")
										setOpen(false)
									}}
								>
									{c.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}


