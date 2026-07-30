import { NotificationItem, CalendarEvent, DocumentItem, AuditLogEntry } from '@/types/controle'

const today = new Date()

const isoDate = (offset: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

const isoDateTime = (offset: number, h: number, m: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const MOCK_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    projectTitle: 'Reforma do Paço Municipal',
    column: 'Execução',
    daysIdle: 12,
    responsible: 'Ana',
    alertDate: isoDate(-2),
    alertType: 'Gargalo',
    prefeitura: 'Florânia',
  },
  {
    id: 'n2',
    projectTitle: 'Aquisição de Ambulância 0km',
    column: 'Procedimentos Internos',
    daysIdle: 8,
    responsible: 'Carlos',
    alertDate: isoDate(-1),
    alertType: 'Prazo Fatal',
    prefeitura: 'Parazinho',
  },
  {
    id: 'n3',
    projectTitle: 'Asfaltamento de Ruas Centrais',
    column: 'Projeto Executivo',
    daysIdle: 6,
    responsible: 'Mariana',
    alertDate: isoDate(0),
    alertType: 'Gargalo',
    prefeitura: 'Tangará',
  },
  {
    id: 'n4',
    projectTitle: 'Construção da Praça Central',
    column: 'Prestação de Contas',
    daysIdle: 15,
    responsible: 'Sofia',
    alertDate: isoDate(-3),
    alertType: 'Prazo Fatal',
    prefeitura: 'Parazinho',
  },
]

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    date: isoDate(-5),
    projectTitle: 'Reforma do Paço Municipal',
    responsible: 'Ana',
    column: 'Execução',
  },
  {
    id: 'e2',
    date: isoDate(-1),
    projectTitle: 'Aquisição de Ambulância 0km',
    responsible: 'Carlos',
    column: 'Procedimentos Internos',
  },
  {
    id: 'e3',
    date: isoDate(2),
    projectTitle: 'Asfaltamento de Ruas Centrais',
    responsible: 'Mariana',
    column: 'Projeto Executivo',
  },
  {
    id: 'e4',
    date: isoDate(5),
    projectTitle: 'Portal da Transparência Jurídica',
    responsible: 'Mariana',
    column: 'Elaborar DFD',
  },
  {
    id: 'e5',
    date: isoDate(-2),
    projectTitle: 'Reforma da Unidade Básica de Saúde',
    responsible: 'Ana',
    column: 'Prestação de Contas',
  },
  {
    id: 'e6',
    date: isoDate(10),
    projectTitle: 'Regularização Fundiária Urbana',
    responsible: 'Pedro',
    column: 'Execução',
  },
]

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'd1',
    fileName: 'termo-referencia-reforma-paco.pdf',
    fileSize: 250880,
    projectTitle: 'Reforma do Paço Municipal',
    uploadDate: isoDate(-5),
    uploader: 'Ana',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd2',
    fileName: 'edital-licitacao-ambulancia.pdf',
    fileSize: 524288,
    projectTitle: 'Aquisição de Ambulância 0km',
    uploadDate: isoDate(-8),
    uploader: 'Carlos',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd3',
    fileName: 'projeto-engenharia-asfaltamento.pdf',
    fileSize: 1258291,
    projectTitle: 'Asfaltamento de Ruas Centrais',
    uploadDate: isoDate(-3),
    uploader: 'Mariana',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd4',
    fileName: 'especificacao-tecnica-portal.pdf',
    fileSize: 348160,
    projectTitle: 'Portal da Transparência Jurídica',
    uploadDate: isoDate(-10),
    uploader: 'Mariana',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd5',
    fileName: 'relatorio-prestacao-contas-ubs.pdf',
    fileSize: 911360,
    projectTitle: 'Reforma da Unidade Básica de Saúde',
    uploadDate: isoDate(-7),
    uploader: 'Ana',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd6',
    fileName: 'planta-praca-central.pdf',
    fileSize: 2202009,
    projectTitle: 'Construção da Praça Central',
    uploadDate: isoDate(-15),
    uploader: 'Sofia',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd7',
    fileName: 'contrato-coleta-seletiva.pdf',
    fileSize: 184320,
    projectTitle: 'Implantação de Coleta Seletiva',
    uploadDate: isoDate(-4),
    uploader: 'Carlos',
    pdfUrl: MOCK_PDF_URL,
  },
  {
    id: 'd8',
    fileName: 'laudo-tecnico-saneamento.pdf',
    fileSize: 665600,
    projectTitle: 'Saneamento do Bairro Alto',
    uploadDate: isoDate(-12),
    uploader: 'Mariana',
    pdfUrl: MOCK_PDF_URL,
  },
]

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 'a1',
    actionType: 'Criou card',
    userName: 'Ana',
    projectTitle: 'Reforma do Paço Municipal',
    dateTime: isoDateTime(-1, 14, 30),
    description: 'Card criado na coluna "Execução".',
  },
  {
    id: 'a2',
    actionType: 'Moveu card',
    userName: 'Carlos',
    projectTitle: 'Aquisição de Ambulância 0km',
    dateTime: isoDateTime(-1, 10, 15),
    description: 'Movido de "Elaborar DFD" para "Procedimentos Internos".',
  },
  {
    id: 'a3',
    actionType: 'Editou card',
    userName: 'Mariana',
    projectTitle: 'Asfaltamento de Ruas Centrais',
    dateTime: isoDateTime(-2, 16, 0),
    description: 'Prazo atualizado para novo valor.',
  },
  {
    id: 'a4',
    actionType: 'Criou card',
    userName: 'Pedro',
    projectTitle: 'Revisão do Código de Posturas',
    dateTime: isoDateTime(-2, 9, 30),
    description: 'Card criado na coluna "Ideação".',
  },
  {
    id: 'a5',
    actionType: 'Moveu card',
    userName: 'Sofia',
    projectTitle: 'Campanha de Conscientização Tributária',
    dateTime: isoDateTime(-3, 11, 45),
    description: 'Movido de "Prestação de Contas" para "Marketing".',
  },
  {
    id: 'a6',
    actionType: 'Editou card',
    userName: 'Ana',
    projectTitle: 'Reforma da Unidade Básica de Saúde',
    dateTime: isoDateTime(-3, 15, 20),
    description: 'Responsável alterado para Ana.',
  },
  {
    id: 'a7',
    actionType: 'Criou card',
    userName: 'Carlos',
    projectTitle: 'Contratação do Sistema de Iluminação LED',
    dateTime: isoDateTime(-4, 8, 50),
    description: 'Card criado na coluna "Elaborar DFD".',
  },
  {
    id: 'a8',
    actionType: 'Moveu card',
    userName: 'Mariana',
    projectTitle: 'Saneamento do Bairro Alto',
    dateTime: isoDateTime(-4, 14, 10),
    description: 'Movido de "Elaborar DFD" para "Projeto Executivo".',
  },
  {
    id: 'a9',
    actionType: 'Editou card',
    userName: 'Pedro',
    projectTitle: 'Regularização Fundiária Urbana',
    dateTime: isoDateTime(-5, 10, 30),
    description: 'Descrição do projeto atualizada.',
  },
  {
    id: 'a10',
    actionType: 'Criou card',
    userName: 'Sofia',
    projectTitle: 'Implantação de Totens de Autoatendimento',
    dateTime: isoDateTime(-5, 17, 0),
    description: 'Card criado na coluna "Ideação".',
  },
]
