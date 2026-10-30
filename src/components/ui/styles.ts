export function inputClass(invalid?: boolean) {
  return `w-full rounded-lg bg-white/5 px-3 py-2 text-slate-100 placeholder:text-slate-500 ring-1 outline-none transition focus:ring-2 ${
    invalid ? 'ring-rose-400/70 focus:ring-rose-400' : 'ring-white/10 focus:ring-portal'
  }`
}

export const primaryButton =
  'rounded-lg bg-portal px-4 py-2 font-semibold text-space transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal disabled:opacity-50'

export const secondaryButton =
  'rounded-lg px-4 py-2 font-medium text-slate-300 ring-1 ring-white/15 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-portal'

export const dangerButton =
  'rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white transition hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400'
