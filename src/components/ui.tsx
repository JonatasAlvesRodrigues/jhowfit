import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`} {...props} />
}

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>
}

export function Progress({ value, color = 'green' }: { value: number; color?: 'green' | 'blue' | 'orange' }) {
  return <div className="progress" aria-label={`${Math.round(value)}%`}><span className={`progress__fill ${color}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal__header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
      {children}
    </div>
  </div>
}

export function LoadingState() {
  return <div className="loading-grid">{[1,2,3,4].map((item) => <div className="skeleton" key={item} />)}</div>
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="error-message">{message}</div>
}
