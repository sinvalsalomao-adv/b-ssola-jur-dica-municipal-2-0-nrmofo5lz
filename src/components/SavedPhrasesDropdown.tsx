import React from 'react'
import { BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface SavedPhrasesDropdownProps {
  phrases: string[]
  onSelect: (phrase: string) => void
}

export const SavedPhrasesDropdown: React.FC<SavedPhrasesDropdownProps> = ({
  phrases,
  onSelect,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 border-gray-200 text-gray-600 hover:bg-slate-50 h-8"
        >
          <BookMarked className="w-3.5 h-3.5" />
          Frases salvas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-64 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-semibold text-gray-500">
          Frases Salvas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {phrases.length === 0 ? (
          <div className="px-2 py-3 text-xs text-gray-400 text-center">
            Nenhuma frase salva ainda
          </div>
        ) : (
          phrases.map((phrase, idx) => (
            <DropdownMenuItem
              key={idx}
              onClick={() => onSelect(phrase)}
              className="text-xs cursor-pointer py-2"
            >
              {phrase}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
