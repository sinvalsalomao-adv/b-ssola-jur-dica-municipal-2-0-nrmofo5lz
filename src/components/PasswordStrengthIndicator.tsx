import React from 'react'
import { Check, X } from 'lucide-react'

export interface PasswordRequirements {
  minLen: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
  allValid: boolean
  strength: 'fraca' | 'media' | 'forte'
}

export function validatePasswordStrength(password: string): PasswordRequirements {
  const minLen = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[@$!%*?&]/.test(password)

  const validCount = [minLen, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length

  let strength: 'fraca' | 'media' | 'forte' = 'fraca'
  if (validCount === 5) {
    strength = 'forte'
  } else if (validCount >= 3) {
    strength = 'media'
  }

  const allValid = minLen && hasUpper && hasLower && hasNumber && hasSpecial

  return {
    minLen,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    allValid,
    strength,
  }
}

interface PasswordStrengthIndicatorProps {
  password?: string
  showChecklist?: boolean
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password = '',
  showChecklist = true,
}) => {
  if (!password) return null

  const { minLen, hasUpper, hasLower, hasNumber, hasSpecial, strength } =
    validatePasswordStrength(password)

  const strengthColor =
    strength === 'forte' ? 'bg-emerald-500' : strength === 'media' ? 'bg-amber-500' : 'bg-red-500'

  const strengthLabel = strength === 'forte' ? 'Forte' : strength === 'media' ? 'Média' : 'Fraca'

  const strengthWidth = strength === 'forte' ? 'w-full' : strength === 'media' ? 'w-2/3' : 'w-1/3'

  return (
    <div className="space-y-2 mt-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Força da senha:</span>
          <span
            className={`font-semibold ${
              strength === 'forte'
                ? 'text-emerald-600'
                : strength === 'media'
                  ? 'text-amber-600'
                  : 'text-red-500'
            }`}
          >
            {strengthLabel}
          </span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${strengthColor} ${strengthWidth}`}
          />
        </div>
      </div>

      {showChecklist && (
        <div className="space-y-1 text-[11px] bg-slate-50 p-2.5 rounded-md border border-slate-100">
          <p className="font-medium text-gray-600 mb-1">Requisitos de segurança:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <RequirementItem met={minLen} label="Mínimo 8 caracteres" />
            <RequirementItem met={hasUpper} label="1 letra maiúscula (A-Z)" />
            <RequirementItem met={hasLower} label="1 letra minúscula (a-z)" />
            <RequirementItem met={hasNumber} label="1 número (0-9)" />
            <RequirementItem met={hasSpecial} label="1 caractere especial (@$!%*?&)" />
          </div>
        </div>
      )}
    </div>
  )
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 transition-colors ${
        met ? 'text-emerald-700 font-medium' : 'text-gray-400'
      }`}
    >
      {met ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
      ) : (
        <X className="w-3.5 h-3.5 text-gray-300 shrink-0 stroke-[2]" />
      )}
      <span>{label}</span>
    </div>
  )
}
