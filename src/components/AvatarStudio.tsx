import { Check, Sparkles } from 'lucide-react'

export const avatarChoices = [
  ['#0b8058','#d9f8e8','#173c2d'], ['#4658d8','#e6e9ff','#20255f'], ['#db6b45','#ffe6d9','#74301e'], ['#8256bd','#f0e4ff','#402260'], ['#17869c','#dcf7fb','#123f4c'], ['#c18a28','#fff0cd','#63450d'],
] as const

export function systemAvatarUrl(seed: number, initials: string) {
  const [base, accent, ink] = avatarChoices[seed % avatarChoices.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="48" fill="${base}"/><circle cx="80" cy="70" r="34" fill="${accent}"/><path d="M31 151c8-33 29-49 49-49s41 16 49 49" fill="${accent}"/><circle cx="67" cy="68" r="4" fill="${ink}"/><circle cx="93" cy="68" r="4" fill="${ink}"/><path d="M66 84c9 8 19 8 28 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><text x="80" y="137" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="800" fill="${ink}">${initials.slice(0,2)}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function AvatarStudio({ initials, selected, onSelect }: { initials: string; selected?: string | null; onSelect: (value: string) => void }) {
  return <section className="avatar-studio"><header><span><Sparkles size={16} /></span><div><small>AVATAR MOVELYA</small><h3>Escolha seu estilo</h3><p>Ele aparecerá no seu painel e na Comunidade.</p></div></header><div className="avatar-studio__choices">{avatarChoices.map((_, index) => { const url = systemAvatarUrl(index, initials); const active = selected === url; return <button key={index} className={active ? 'is-active' : ''} onClick={() => onSelect(url)} aria-label={`Escolher avatar ${index + 1}`}><img src={url} alt="" />{active && <i><Check size={13} /></i>}</button> })}</div></section>
}
