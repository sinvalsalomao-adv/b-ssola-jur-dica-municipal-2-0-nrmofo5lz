interface ReportData {
  usersByRole: Record<string, number>
  projectsByColumn: Record<string, number>
  notificationsSummary: {
    total: number
    unread: number
    read: number
    gargalo: number
    prazoFatal: number
  }
  tenantName?: string
}

export function exportReportToCsv(data: ReportData) {
  const lines: string[] = []
  const title = data.tenantName ? `Relatório Municipal - ${data.tenantName}` : 'Relatório Municipal'
  lines.push(title)
  lines.push(`Data de Emissão,${new Date().toLocaleDateString('pt-BR')}`)
  lines.push('')

  lines.push('USUÁRIOS POR PAPEL')
  lines.push('Papel,Quantidade')
  Object.entries(data.usersByRole).forEach(([role, count]) => {
    lines.push(`${role},${count}`)
  })
  lines.push('')

  lines.push('PROJETOS POR COLUNA KANBAN')
  lines.push('Coluna,Quantidade')
  Object.entries(data.projectsByColumn).forEach(([col, count]) => {
    lines.push(`${col},${count}`)
  })
  lines.push('')

  lines.push('RESUMO DE NOTIFICAÇÕES')
  lines.push('Métrica,Valor')
  lines.push(`Total,${data.notificationsSummary.total}`)
  lines.push(`Não Lidas,${data.notificationsSummary.unread}`)
  lines.push(`Lidas,${data.notificationsSummary.read}`)
  lines.push(`Gargalo,${data.notificationsSummary.gargalo}`)
  lines.push(`Prazo Fatal,${data.notificationsSummary.prazoFatal}`)

  const csvContent = lines.join('\n')
  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `relatorio-municipal-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportReportToPdf(data: ReportData) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const title = data.tenantName ? `Relatório Municipal - ${data.tenantName}` : 'Relatório Municipal'

  const usersByRoleRows = Object.entries(data.usersByRole)
    .map(
      ([role, count]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${role}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${count}</td></tr>`,
    )
    .join('')

  const projectsByColRows = Object.entries(data.projectsByColumn)
    .map(
      ([col, count]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${col}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${count}</td></tr>`,
    )
    .join('')

  const notifRows = [
    ['Total', data.notificationsSummary.total],
    ['Não Lidas', data.notificationsSummary.unread],
    ['Lidas', data.notificationsSummary.read],
    ['Gargalo', data.notificationsSummary.gargalo],
    ['Prazo Fatal', data.notificationsSummary.prazoFatal],
  ]
    .map(
      ([label, val]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${label}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${val}</td></tr>`,
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
        @media print { .no-print { display: none; } }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #3b82f6; padding-bottom:16px; margin-bottom:20px; }
        .logo-box { width:40px; height:40px; background:#3b82f6; color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:20px; }
        .brand { display:flex; align-items:center; gap:12px; }
        .brand h1 { margin:0; font-size:20px; color:#1e293b; }
        .brand p { margin:2px 0 0; font-size:12px; color:#64748b; }
        .meta { text-align:right; font-size:12px; color:#64748b; }
        table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:24px; }
        th { background:#0f172a; color:#fff; text-align:left; padding:10px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
        .section-title { font-size:14px; font-weight:700; color:#1e293b; margin:20px 0 8px; padding-bottom:4px; border-bottom:1px solid #e2e8f0; }
        .footer { margin-top:30px; padding-top:12px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8; }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">Imprimir / Salvar como PDF</button>
      </div>
      <div class="header">
        <div class="brand">
          <div class="logo-box">BJ</div>
          <div>
            <h1>Bússola Jurídica Municipal</h1>
            <p>${title}</p>
          </div>
        </div>
        <div class="meta">
          <p><strong>Emissão:</strong> ${currentDate}</p>
        </div>
      </div>
      <div class="section-title">Usuários por Papel</div>
      <table><thead><tr><th>Papel</th><th style="text-align:center;">Quantidade</th></tr></thead><tbody>${usersByRoleRows}</tbody></table>
      <div class="section-title">Projetos por Coluna Kanban</div>
      <table><thead><tr><th>Coluna</th><th style="text-align:center;">Quantidade</th></tr></thead><tbody>${projectsByColRows}</tbody></table>
      <div class="section-title">Resumo de Notificações</div>
      <table><thead><tr><th>Métrica</th><th style="text-align:center;">Valor</th></tr></thead><tbody>${notifRows}</tbody></table>
      <div class="footer">Documento gerado automaticamente pelo Sistema Bússola Jurídica Municipal.</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
