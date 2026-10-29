import { useId, useRef, useState, type ReactNode } from 'react'
import { inputClass } from './styles'
import type { Character, SearchCharacters } from './types'
import { useCharacterSearch } from './useCharacterSearch'

interface CharacterPickerProps {
  id: string
  value: Character | null
  onChange: (character: Character | null) => void
  searchCharacters: SearchCharacters
  invalid?: boolean
  describedBy?: string
}

function Avatar({ character, size = 'size-8' }: { character: Character; size?: string }) {
  return <img src={character.image} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
}

/** Accessible combobox (ARIA 1.2 pattern) for picking a character. */
export function CharacterPicker({
  id,
  value,
  onChange,
  searchCharacters,
  invalid,
  describedBy,
}: CharacterPickerProps) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const { characters, isLoading, error, retry } = useCharacterSearch(searchCharacters, query, open)

  const active = Math.min(activeIndex, characters.length - 1)
  const optionId = (index: number) => `${listboxId}-option-${index}`

  function select(character: Character) {
    onChange(character)
    setOpen(false)
    setQuery('')
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10">
        <Avatar character={value} size="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          {value.species && <p className="truncate text-xs text-slate-400">{value.species}</p>}
        </div>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm text-portal hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-portal"
          onClick={() => {
            onChange(null)
            setOpen(true)
            // The input mounts on the next render.
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Search the multiverse…"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIndex(Math.min(active + 1, characters.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(Math.max(active - 1, 0))
          } else if (e.key === 'Enter' && open) {
            // Don't submit the surrounding form while choosing.
            e.preventDefault()
            if (characters[active]) select(characters[active])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={inputClass(invalid)}
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Characters"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg bg-slate-900 p-1 shadow-xl ring-1 ring-white/10"
        >
          {characters.map((character, index) => (
            <li
              key={character.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // mousedown + preventDefault keeps focus in the input so onBlur doesn't close us first.
              onMouseDown={(e) => {
                e.preventDefault()
                select(character)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 ${
                index === active ? 'bg-portal/15' : ''
              }`}
            >
              <Avatar character={character} />
              <span className="min-w-0 flex-1 truncate">{character.name}</span>
              {character.species && <span className="text-xs text-slate-400">{character.species}</span>}
            </li>
          ))}
          {isLoading && <StatusRow>Opening a portal…</StatusRow>}
          {!isLoading && error && (
            <StatusRow>
              Couldn’t reach that dimension.{' '}
              <button
                type="button"
                className="text-portal underline"
                onMouseDown={(e) => {
                  e.preventDefault()
                  retry()
                }}
              >
                Try again
              </button>
            </StatusRow>
          )}
          {!isLoading && !error && characters.length === 0 && (
            <StatusRow>Nobody by that name in this dimension.</StatusRow>
          )}
        </ul>
      )}
    </div>
  )
}

function StatusRow({ children }: { children: ReactNode }) {
  return (
    <li role="presentation" className="px-2 py-2 text-sm text-slate-400">
      {children}
    </li>
  )
}
