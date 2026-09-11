import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface UnsavedChangesGuard {
  id: string
  isDirty: () => boolean
  onSave?: () => Promise<boolean | void>
  onDiscard?: () => void
}

interface UnsavedChangesContextType {
  registerGuard: (guard: UnsavedChangesGuard) => () => void
  hasUnsavedChanges: () => boolean
  confirmTenantSwitch: (onProceed: () => void) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined)

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const guardsRef = useRef<Map<string, UnsavedChangesGuard>>(new Map())
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [saving, setSaving] = useState(false)

  const registerGuard = useCallback((guard: UnsavedChangesGuard) => {
    guardsRef.current.set(guard.id, guard)
    return () => {
      guardsRef.current.delete(guard.id)
    }
  }, [])

  const hasUnsavedChanges = useCallback(() => {
    for (const guard of guardsRef.current.values()) {
      try {
        if (guard.isDirty()) return true
      } catch (e) {
        console.error('Erro ao verificar guarda de alterações não salvas:', e)
      }
    }
    return false
  }, [])

  const confirmTenantSwitch = useCallback(
    (onProceed: () => void) => {
      if (hasUnsavedChanges()) {
        setPendingAction(() => onProceed)
        setModalOpen(true)
      } else {
        onProceed()
      }
    },
    [hasUnsavedChanges],
  )

  const handleDiscard = () => {
    // Chama o descarte de cada guarda registrado
    for (const guard of guardsRef.current.values()) {
      try {
        guard.onDiscard?.()
      } catch (e) {
        console.error('Erro no descarte de alterações:', e)
      }
    }
    setModalOpen(false)
    if (pendingAction) {
      const act = pendingAction
      setPendingAction(null)
      act()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    let allSucceeded = true
    try {
      for (const guard of guardsRef.current.values()) {
        if (guard.isDirty() && guard.onSave) {
          try {
            const res = await guard.onSave()
            if (res === false) {
              allSucceeded = false
            }
          } catch (e) {
            allSucceeded = false
            console.error('Erro ao salvar formulário:', e)
          }
        }
      }
      if (allSucceeded) {
        setModalOpen(false)
        if (pendingAction) {
          const act = pendingAction
          setPendingAction(null)
          act()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <UnsavedChangesContext.Provider
      value={{ registerGuard, hasUnsavedChanges, confirmTenantSwitch }}
    >
      {children}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-amber-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">Alterações não salvas</h3>
                <p className="text-xs text-gray-500">Há um formulário com dados não gravados.</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Você está alterando de prefeitura ou voltando para a visão global, mas existem dados
              não salvos em tela. Deseja salvar as alterações agora ou descartá-las?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar troca
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                Descartar dados
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
              >
                {saving ? 'Salvando...' : 'Salvar antes de sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  )
}

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    return {
      registerGuard: () => () => {},
      hasUnsavedChanges: () => false,
      confirmTenantSwitch: (onProceed: () => void) => onProceed(),
    }
  }
  return context
}
