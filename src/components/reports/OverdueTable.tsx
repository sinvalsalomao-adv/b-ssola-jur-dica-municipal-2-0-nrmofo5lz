import { Building2, Calendar, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/dateUtils'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import type { Project } from '@/types/project'

interface Props {
  projects: Project[]
}

export function OverdueTable({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        Nenhum projeto atrasado. Tudo em dia!
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50/70">
          <TableRow>
            <TableHead className="text-xs font-semibold text-gray-600">Projeto</TableHead>
            <TableHead className="text-xs font-semibold text-gray-600">Prefeitura</TableHead>
            <TableHead className="text-xs font-semibold text-gray-600">Responsável</TableHead>
            <TableHead className="text-xs font-semibold text-gray-600">Coluna</TableHead>
            <TableHead className="text-xs font-semibold text-gray-600">Prazo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow
              key={p.id}
              className="bg-red-50/40 hover:bg-red-50/60 border-l-4 border-l-red-500"
            >
              <TableCell className="text-sm font-semibold text-[#1c2a3e] max-w-[200px] truncate">
                {p.title}
              </TableCell>
              <TableCell className="text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  {p.prefeitura}
                </span>
              </TableCell>
              <TableCell className="text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" />
                  {p.responsible || '—'}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                  {p.column}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <Calendar className="w-3 h-3" />
                  {formatDate(p.deadline)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
