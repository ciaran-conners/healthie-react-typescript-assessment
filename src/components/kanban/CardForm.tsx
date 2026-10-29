import { useId, useState, type FormEvent } from 'react'
import { isCompleteDraft } from './boardLogic'
import { CharacterPicker } from './CharacterPicker'
import { inputClass, primaryButton, secondaryButton } from './styles'
import type { CardDraft, CompleteDraft, SearchCharacters } from './types'

const EMPTY_DRAFT: CardDraft = { title: '', description: '', character: null }

interface CardFormProps {
  searchCharacters: SearchCharacters
  onSubmit: (draft: CompleteDraft) => void
  submitLabel: string
  initialDraft?: CardDraft
  onCancel?: () => void
  resetOnSubmit?: boolean
  disabled?: boolean
}

export function CardForm({
  searchCharacters,
  onSubmit,
  submitLabel,
  initialDraft = EMPTY_DRAFT,
  onCancel,
  resetOnSubmit = false,
  disabled = false,
}: CardFormProps) {
  const ids = { title: useId(), description: useId(), character: useId() }
  const errorIds = { title: useId(), character: useId() }
  const [draft, setDraft] = useState<CardDraft>(initialDraft)
  const [showErrors, setShowErrors] = useState(false)

  const errors = {
    title: draft.title.trim() ? null : 'Give the card a title.',
    character: draft.character ? null : 'Every card needs a Rick and Morty character.',
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isCompleteDraft(draft)) {
      setShowErrors(true)
      return
    }
    onSubmit(draft)
    if (resetOnSubmit) {
      setDraft(EMPTY_DRAFT)
      setShowErrors(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={ids.title} className="text-sm font-medium text-slate-300">
            Title
          </label>
          <input
            id={ids.title}
            type="text"
            maxLength={80}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            aria-invalid={(showErrors && !!errors.title) || undefined}
            aria-describedby={showErrors && errors.title ? errorIds.title : undefined}
            className={inputClass(showErrors && !!errors.title)}
            placeholder="Pick up Morty from school"
          />
          {showErrors && errors.title && <FieldError id={errorIds.title}>{errors.title}</FieldError>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={ids.description} className="text-sm font-medium text-slate-300">
            Description <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={ids.description}
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className={`${inputClass()} resize-y`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={ids.character} className="text-sm font-medium text-slate-300">
            Character
          </label>
          <CharacterPicker
            id={ids.character}
            value={draft.character}
            onChange={(character) => setDraft((d) => ({ ...d, character }))}
            searchCharacters={searchCharacters}
            invalid={showErrors && !!errors.character}
            describedBy={showErrors && errors.character ? errorIds.character : undefined}
          />
          {showErrors && errors.character && (
            <FieldError id={errorIds.character}>{errors.character}</FieldError>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {onCancel && (
            <button type="button" onClick={onCancel} className={secondaryButton}>
              Cancel
            </button>
          )}
          <button type="submit" className={primaryButton}>
            {submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-sm text-rose-300">
      {children}
    </p>
  )
}
