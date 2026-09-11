import React from 'react'
import { Search, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface FilterBarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  children?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  totalCount?: number
  filteredCount?: number
  countLabel?: string
  className?: string
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  children,
  hasActiveFilters = false,
  onClearFilters,
  totalCount,
  filteredCount,
  countLabel = 'registro(s)',
  className = '',
}) => {
  return (
    <div
      className={`bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 bg-slate-50/50 border-gray-200 focus:bg-white"
              aria-label={searchPlaceholder}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 rounded-full"
                aria-label="Limpar campo de busca"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {children && (
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {children}
          </div>
        )}

        {hasActiveFilters && onClearFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 h-9 px-2.5 gap-1 shrink-0"
            aria-label="Limpar todos os filtros aplicados"
          >
            <X className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
            <span>Limpar filtros</span>
          </Button>
        )}
      </div>

      {(totalCount !== undefined || filteredCount !== undefined) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <span>
              {filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount ? (
                <>
                  Exibindo <strong className="text-gray-900">{filteredCount}</strong> de{' '}
                  <strong className="text-gray-900">{totalCount}</strong> {countLabel}
                </>
              ) : (
                <>
                  Total: <strong className="text-gray-900">{totalCount ?? filteredCount}</strong> {countLabel}
                </>
              )}
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Filtros ativos
            </span>
          )}
        </div>
      )}
    </div>
  )
}
