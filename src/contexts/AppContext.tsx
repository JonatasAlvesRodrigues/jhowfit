import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PageId } from '../types'

interface AppContextValue {
  page: PageId
  navigate: (page: PageId) => void
  modal: string | null
  openModal: (id: string) => void
  closeModal: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>('inicio')
  const [modal, setModal] = useState<string | null>(null)
  return (
    <AppContext.Provider value={{
      page, navigate: setPage, modal,
      openModal: setModal, closeModal: () => setModal(null),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp deve estar dentro de AppProvider')
  return context
}
