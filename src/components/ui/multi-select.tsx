import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { Button } from "./button"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { ScrollArea } from "./scroll-area"
import { Check, ChevronsUpDown } from "lucide-react"

export type Option = {
  value: string
  label: string
}

interface MultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: Option[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
}

export function MultiSelect({ options, value, onValueChange, placeholder = "Selecionar...", className }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const toggle = (v: string) => {
    if (value.includes(v)) onValueChange(value.filter((i) => i !== v))
    else onValueChange([...value, v])
  }

  return (
    <div className={cn("w-[280px]", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            <div className="flex gap-2 flex-wrap">
              {value.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
              {value.map((v) => {
                const opt = options.find((o) => o.value === v)
                return <Badge key={v} variant="secondary">{opt?.label ?? v}</Badge>
              })}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0">
          <Command>
            <CommandInput placeholder="Buscar..." value={search} onValueChange={setSearch} />
            <CommandList>
              <ScrollArea className="h-56">
                <CommandGroup>
                  {options
                    .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
                    .map((o) => (
                      <CommandItem key={o.value} onSelect={() => toggle(o.value)} className="flex items-center gap-2">
                        <Check className={cn("h-4 w-4", value.includes(o.value) ? "opacity-100" : "opacity-0")} />
                        <span>{o.label}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
