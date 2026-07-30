import { createContext, useContext, ReactNode } from 'react'
import { useEducationStore } from '@/stores/useEducationStore'

type EducationStore = ReturnType<typeof useEducationStore>

const EducationContext = createContext<EducationStore | undefined>(undefined)

export const EducationProvider = ({ children }: { children: ReactNode }) => {
  const store = useEducationStore()
  return <EducationContext.Provider value={store}>{children}</EducationContext.Provider>
}

export const useEducation = () => {
  const context = useContext(EducationContext)
  if (!context) throw new Error('useEducation must be used within an EducationProvider')
  return context
}
