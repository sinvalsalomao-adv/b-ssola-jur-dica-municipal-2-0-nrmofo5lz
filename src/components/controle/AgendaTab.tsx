import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MOCK_CALENDAR_EVENTS } from '@/data/mockControle'

interface AgendaTabProps {
  proximityDays: number
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function getEventColor(dateStr: string, proximityDays: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(dateStr + 'T12:00:00')
  const diff = Math.floor((event.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'bg-red-500'
  if (diff <= proximityDays) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export const AgendaTab: React.FC<AgendaTabProps> = ({ proximityDays }) => {
  const navigate = useNavigate()
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const cells: (number | null)[] = useMemo(() => {
    const arr: (number | null)[] = []
    for (let i = 0; i < firstDayOfWeek; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [firstDayOfWeek, daysInMonth])

  const formatDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const selectedEvents = selectedDate
    ? MOCK_CALENDAR_EVENTS.filter((e) => e.date === selectedDate)
    : []

  const todayStr = formatDateStr(today.getDate())

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-[#1c2a3e]">
              {MONTH_NAMES[month]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[10px] font-bold text-gray-400 uppercase py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />
              const dateStr = formatDateStr(day)
              const dayEvents = MOCK_CALENDAR_EVENTS.filter((e) => e.date === dateStr)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[44px] rounded-lg p-1.5 flex flex-col items-center gap-1 transition-colors border ${
                    isSelected
                      ? 'bg-[#3b82f6] border-[#3b82f6] text-white'
                      : isToday
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-transparent hover:bg-gray-100'
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-700'}`}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : getEventColor(e.date, proximityDays)}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Futuro
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Próximo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Vencido
            </span>
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-[#1c2a3e]">
                Eventos —{' '}
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                })}
              </h4>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                onClick={() => navigate('/bussola', { state: { filterDate: selectedDate } })}
              >
                Ver pipeline <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            {selectedEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventColor(e.date, proximityDays)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1c2a3e] truncate">
                        {e.projectTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {e.responsible} • {e.column}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum evento nesta data.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
