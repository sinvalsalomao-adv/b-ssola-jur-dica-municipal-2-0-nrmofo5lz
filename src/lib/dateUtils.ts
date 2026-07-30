/**
 * Utility functions for robust date formatting and normalization.
 */

/**
 * Safely formats any date input into a DD/MM/YYYY string in pt-BR locale.
 * Never produces "Invalid Date". Returns fallback (default: "Sem prazo") when missing or unparseable.
 */
export function formatDate(
  dateValue: string | Date | null | undefined,
  fallback = 'Sem prazo',
): string {
  if (!dateValue) return fallback

  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
        return fallback
      }

      // If already formatted as DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed
      }

      // Handle YYYY-MM-DD or YYYY-MM-DD... ISO strings
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const datePart = trimmed.substring(0, 10)
        const [yearStr, monthStr, dayStr] = datePart.split('-')
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10) - 1
        const day = parseInt(dayStr, 10)

        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const d = new Date(year, month, day)
          if (!isNaN(d.getTime())) {
            const formattedDay = String(d.getDate()).padStart(2, '0')
            const formattedMonth = String(d.getMonth() + 1).padStart(2, '0')
            const formattedYear = d.getFullYear()
            return `${formattedDay}/${formattedMonth}/${formattedYear}`
          }
        }
      }

      // Fallback parse for other valid ISO date strings
      const parsed = new Date(trimmed)
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0')
        const month = String(parsed.getMonth() + 1).padStart(2, '0')
        const year = parsed.getFullYear()
        return `${day}/${month}/${year}`
      }

      return fallback
    }

    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      const day = String(dateValue.getDate()).padStart(2, '0')
      const month = String(dateValue.getMonth() + 1).padStart(2, '0')
      const year = dateValue.getFullYear()
      return `${day}/${month}/${year}`
    }

    return fallback
  } catch {
    return fallback
  }
}

/**
 * Normalizes a date value into YYYY-MM-DD format for HTML date inputs (<input type="date" />).
 */
export function normalizeDateForInput(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return ''

  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
        return ''
      }

      // If YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed
      }

      // If YYYY-MM-DD...
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10)
      }

      // If DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/')
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }

      const parsed = new Date(trimmed)
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear()
        const month = String(parsed.getMonth() + 1).padStart(2, '0')
        const day = String(parsed.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }

    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      const year = dateValue.getFullYear()
      const month = String(dateValue.getMonth() + 1).padStart(2, '0')
      const day = String(dateValue.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return ''
  } catch {
    return ''
  }
}
