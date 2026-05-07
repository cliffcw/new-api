import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export type ComboboxSelectOption = {
  value: string
  label: string
  icon?: React.ReactNode
}

interface ComboboxSelectProps {
  options: ComboboxSelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  id?: string
}

export function ComboboxSelect(props: ComboboxSelectProps) {
  const selectedOption = React.useMemo(
    () => props.options.find((o) => o.value === (props.value ?? '')),
    [props.options, props.value]
  )

  const [open, setOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  const filteredOptions = React.useMemo(() => {
    const search = query.toLowerCase().trim()
    if (!search) return props.options
    return props.options.filter((option) => {
      const label = option.label.toLowerCase()
      const value = option.value.toLowerCase()
      return label.includes(search) || value.includes(search)
    })
  }, [props.options, query])

  React.useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions])

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = (selectedValue: string) => {
    props.onValueChange(selectedValue)
    setOpen(false)
    setQuery('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }

    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setQuery('')
        break
    }
  }

  React.useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[highlightedIndex] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const displayValue = open ? query : selectedOption?.label ?? ''
  const displayPlaceholder =
    open && props.searchPlaceholder ? props.searchPlaceholder : props.placeholder

  return (
    <div ref={containerRef} className='relative'>
      <Input
        ref={inputRef}
        id={props.id}
        type='text'
        role='combobox'
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-autocomplete='list'
        autoComplete='off'
        placeholder={displayPlaceholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onKeyDown={handleKeyDown}
        className={cn('pr-9', props.className)}
      />
      <ChevronsUpDown className='pointer-events-none absolute top-1/2 right-3 size-4 shrink-0 -translate-y-1/2 opacity-50' />

      {open && (
        <div className='bg-popover text-popover-foreground absolute top-full z-100 mt-1 w-full rounded-md border shadow-md'>
          {filteredOptions.length > 0 ? (
            <ul
              ref={listRef}
              role='listbox'
              className='max-h-[200px] overflow-y-auto p-1'
            >
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role='option'
                  aria-selected={(props.value ?? '') === option.value}
                  data-highlighted={index === highlightedIndex}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
                    index === highlightedIndex &&
                      'bg-accent text-accent-foreground',
                    (props.value ?? '') === option.value && 'font-medium'
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(option.value)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      (props.value ?? '') === option.value
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {option.icon && <span>{option.icon}</span>}
                  <span className='truncate'>{option.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className='px-2 py-6 text-center text-sm'>
              {props.emptyText ?? 'No option found.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
