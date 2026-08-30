import { Project } from '@/types/project'
import { formatDate } from '@/lib/dateUtils'

export function exportProjectsToPdf(
  projects: Project[],
  title: string = 'Relatório Geral de Projetos',
  prefeituraName: string = 'Todas as Prefeituras',
) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const altaCount = projects.filter((p) => p.priority === 'Alta').length
  const mediaCount = projects.filter((p) => p.priority === 'Média').length
  const baixaCount = projects.filter((p) => p.priority === 'Baixa').length

  const rowsHtml = projects
    .map(
      (p, idx) => `
    <tr class="${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b; max-width: 220px;">
        ${p.title}
        ${p.objeto ? `<br/><span style="font-size: 11px; font-weight: normal; color: #475569;"><strong>Objeto:</strong> ${p.objeto.slice(0, 120)}${p.objeto.length > 120 ? '...' : ''}</span>` : p.description ? `<br/><span style="font-size: 11px; font-weight: normal; color: #64748b;">${p.description.slice(0, 100)}${p.description.length > 100 ? '...' : ''}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">
        ${p.prefeitura || '-'}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">
        ${p.responsible || 'Não atribuído'}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <span style="
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          background-color: ${p.priority === 'Alta' ? '#ef4444' : p.priority === 'Média' ? '#f59e0b' : '#10b981'};
        ">
          ${p.priority}
        </span>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">
        ${p.column}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">
        ${formatDate(p.deadline, 'Sem prazo')}
      </td>
    </tr>
  `,
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${title} - ${prefeituraName}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 24px;
          color: #0f172a;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-box {
          width: 40px;
          height: 40px;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 20px;
        }
        .title-area h1 {
          margin: 0;
          font-size: 20px;
          color: #1e293b;
        }
        .title-area p {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #64748b;
        }
        .meta-info {
          text-align: right;
          font-size: 12px;
          color: #64748b;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }
        .stat-card .num {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
        }
        .stat-card .label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          background-color: #0f172a;
          color: #ffffff;
          text-align: left;
          padding: 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; text-align: right;">
        <button onclick="window.print()" style="
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        ">Imprimir / Salvar como PDF</button>
      </div>

      <div class="header">
        <div class="brand">
          <div class="logo-box">BJ</div>
          <div class="title-area">
            <h1>Bússola Jurídica Municipal</h1>
            <p>Relatório Consolidado de Projetos • ${prefeituraName}</p>
          </div>
        </div>
        <div class="meta-info">
          <p><strong>Emissão:</strong> ${currentDate}</p>
          <p><strong>Total Exibido:</strong> ${projects.length} projeto(s)</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="num">${projects.length}</div>
          <div class="label">Total de Projetos</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #ef4444;">
          <div class="num" style="color: #ef4444;">${altaCount}</div>
          <div class="label">Alta Prioridade</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #f59e0b;">
          <div class="num" style="color: #d97706;">${mediaCount}</div>
          <div class="label">Média Prioridade</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #10b981;">
          <div class="num" style="color: #059669;">${baixaCount}</div>
          <div class="label">Baixa Prioridade</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Projeto / Objeto</th>
            <th>Prefeitura</th>
            <th>Responsável</th>
            <th>Prioridade</th>
            <th>Etapa Atual</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum projeto encontrado com os filtros selecionados.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Documento gerado automaticamente pelo Sistema Bússola Jurídica Municipal.
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
