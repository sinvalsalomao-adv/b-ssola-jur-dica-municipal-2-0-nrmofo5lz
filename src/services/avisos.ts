import pb from '@/lib/pocketbase/client'
import type {
  AvisoRecord,
  AvisosConfigRecord,
  FeriadoRecord,
  AvisosIndicadores,
  FaixasUrgencia,
} from '@/types/avisos'

export const DEFAULT_FAIXAS_URGENCIA: FaixasUrgencia = {
  baixa_dias: 5,
  media_dias_min: 3,
  media_dias_max: 5,
  alta_dias_min: 1,
  alta_dias_max: 2,
  critica_dias: 0,
}

export const DEFAULT_AVISOS_CONFIG: Omit<AvisosConfigRecord, 'id' | 'tenant'> = {
  horario_aviso_diario: '08:00',
  dias_antecedencia: 2,
  horario_limite_confirmacao: '12:00',
  intervalo_lembrete_horas: 3,
  max_lembretes: 2,
  bloqueio_automatico: true,
  exigir_confirmacao_sem_demandas: false,
  alerta_extraordinario_critica_vencida: true,
  tipo_contagem_dias: 'dias_uteis',
  faixas_urgencia: DEFAULT_FAIXAS_URGENCIA,
  mensagem_padrao: 'BÚSSOLA JURÍDICA — AVISO DIÁRIO',
  ativo: true,
}

export function normalizeAviso(record: any): AvisoRecord {
  let demandas: any[] = []
  try {
    if (typeof record.demandas_vinculadas === 'string') {
      demandas = JSON.parse(record.demandas_vinculadas)
    } else if (Array.isArray(record.demandas_vinculadas)) {
      demandas = record.demandas_vinculadas
    }
  } catch {
    demandas = []
  }

  return {
    id: record.id,
    codigo: record.codigo || '',
    user: record.user || '',
    userName: record.expand?.user?.name || record.expand?.user?.email || 'Servidor',
    userEmail: record.expand?.user?.email || '',
    tenant: record.tenant || '',
    tenantName: record.expand?.tenant?.name || '',
    telegram_id: record.telegram_id || record.expand?.user?.telegram_id || '',
    data_hora_envio: record.data_hora_envio || '',
    tipo: record.tipo || 'diario',
    demandas_vinculadas: demandas,
    qtd_demandas: record.qtd_demandas ?? demandas.length,
    status: record.status || 'pendente_envio',
    data_hora_confirmacao: record.data_hora_confirmacao || '',
    tentativas_envio: record.tentativas_envio ?? 1,
    ultimo_erro: record.ultimo_erro || '',
    telegram_message_id: record.telegram_message_id || '',
    parent_aviso: record.parent_aviso || '',
    created: record.created,
    updated: record.updated,
  }
}

export async function getAvisos(options?: {
  tenantId?: string
  status?: string
  tipo?: string
  userId?: string
  page?: number
  perPage?: number
}): Promise<{ items: AvisoRecord[]; totalItems: number; totalPages: number }> {
  const page = options?.page || 1
  const perPage = options?.perPage || 30
  const filters: string[] = []

  if (options?.tenantId) {
    filters.push(`tenant = "${options.tenantId}"`)
  }
  if (options?.status && options.status !== 'todos') {
    filters.push(`status = "${options.status}"`)
  }
  if (options?.tipo && options.tipo !== 'todos') {
    filters.push(`tipo = "${options.tipo}"`)
  }
  if (options?.userId && options.userId !== 'todos') {
    filters.push(`user = "${options.userId}"`)
  }

  const filterStr = filters.join(' && ')

  try {
    const res = await pb.collection('avisos').getList(page, perPage, {
      filter: filterStr,
      sort: '-created',
      expand: 'user,tenant',
    })

    return {
      items: res.items.map(normalizeAviso),
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  } catch (err) {
    console.warn('Erro ao listar avisos:', err)
    return { items: [], totalItems: 0, totalPages: 0 }
  }
}

export async function getAvisosIndicadores(tenantId?: string): Promise<AvisosIndicadores> {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  const now = new Date()
  const todayStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`

  try {
    const tenantFilter = tenantId ? `tenant = "${tenantId}" && ` : ''

    const hojeAvisos = await pb.collection('avisos').getFullList({
      filter: `${tenantFilter}created >= "${todayStart}"`,
      fields: 'id,status,qtd_demandas,demandas_vinculadas',
    })

    const enviadosHoje = hojeAvisos.length
    const confirmadosHoje = hojeAvisos.filter((a) => a.status === 'confirmado').length
    const aguardandoHoje = hojeAvisos.filter((a) => a.status === 'aguardando_confirmacao').length

    // Usuários com status_bloqueio = bloqueado_ciencia
    const userBlockFilter = tenantId
      ? `status_bloqueio = "bloqueado_ciencia" && tenant = "${tenantId}"`
      : 'status_bloqueio = "bloqueado_ciencia"'
    let blockedCount = 0
    try {
      const blockedUsers = await pb.collection('users').getFullList({
        filter: userBlockFilter,
        fields: 'id',
      })
      blockedCount = blockedUsers.length
    } catch {
      blockedCount = 0
    }

    // Contar demandas críticas e vencidas em projetos e DFDs do tenant
    let demandasCriticas = 0
    let demandasVencidas = 0
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

    try {
      const pFilter = tenantId ? `tenant = "${tenantId}"` : ''
      const projects = await pb.collection('projects').getFullList({
        filter: pFilter,
        fields: 'id,prazo',
      })
      for (const pr of projects) {
        if (!pr.prazo) continue
        const pDate = pr.prazo.substring(0, 10)
        if (pDate === todayStr) demandasCriticas++
        else if (pDate < todayStr) demandasVencidas++
      }
    } catch {
      // ignore
    }

    const taxa = enviadosHoje > 0 ? Math.round((confirmadosHoje / enviadosHoje) * 100) : 100

    return {
      enviadosHoje,
      confirmadosHoje,
      aguardandoHoje,
      usuariosBloqueados: blockedCount,
      demandasCriticas,
      demandasVencidas,
      taxaConfirmacao: taxa,
    }
  } catch (err) {
    console.warn('Erro ao carregar indicadores de avisos:', err)
    return {
      enviadosHoje: 0,
      confirmadosHoje: 0,
      aguardandoHoje: 0,
      usuariosBloqueados: 0,
      demandasCriticas: 0,
      demandasVencidas: 0,
      taxaConfirmacao: 100,
    }
  }
}

export async function getAvisosConfig(tenantId: string): Promise<AvisosConfigRecord | null> {
  try {
    const rec = await pb.collection('avisos_config').getFirstListItem(`tenant = "${tenantId}"`)
    let faixas = DEFAULT_FAIXAS_URGENCIA
    try {
      if (typeof rec.faixas_urgencia === 'string') {
        faixas = JSON.parse(rec.faixas_urgencia)
      } else if (rec.faixas_urgencia && typeof rec.faixas_urgencia === 'object') {
        faixas = { ...DEFAULT_FAIXAS_URGENCIA, ...rec.faixas_urgencia }
      }
    } catch {
      faixas = DEFAULT_FAIXAS_URGENCIA
    }

    return {
      id: rec.id,
      tenant: rec.tenant,
      horario_aviso_diario: rec.horario_aviso_diario || '08:00',
      dias_antecedencia: rec.dias_antecedencia ?? 2,
      horario_limite_confirmacao: rec.horario_limite_confirmacao || '12:00',
      intervalo_lembrete_horas: rec.intervalo_lembrete_horas ?? 3,
      max_lembretes: rec.max_lembretes ?? 2,
      bloqueio_automatico: Boolean(rec.bloqueio_automatico),
      exigir_confirmacao_sem_demandas: Boolean(rec.exigir_confirmacao_sem_demandas),
      alerta_extraordinario_critica_vencida: Boolean(rec.alerta_extraordinario_critica_vencida),
      tipo_contagem_dias: rec.tipo_contagem_dias || 'dias_uteis',
      faixas_urgencia: faixas,
      mensagem_padrao: rec.mensagem_padrao || 'BÚSSOLA JURÍDICA — AVISO DIÁRIO',
      ativo: rec.ativo !== false,
      created: rec.created,
      updated: rec.updated,
    }
  } catch {
    return null
  }
}

export async function saveAvisosConfig(
  tenantId: string,
  data: Partial<Omit<AvisosConfigRecord, 'id' | 'tenant'>>,
  existingId?: string,
): Promise<AvisosConfigRecord> {
  const payload = {
    ...data,
    tenant: tenantId,
    faixas_urgencia: data.faixas_urgencia ? JSON.stringify(data.faixas_urgencia) : undefined,
  }

  if (existingId) {
    const updated = await pb.collection('avisos_config').update(existingId, payload)
    return getAvisosConfig(tenantId) as Promise<AvisosConfigRecord>
  } else {
    try {
      const existing = await pb
        .collection('avisos_config')
        .getFirstListItem(`tenant = "${tenantId}"`)
      await pb.collection('avisos_config').update(existing.id, payload)
      return getAvisosConfig(tenantId) as Promise<AvisosConfigRecord>
    } catch {
      await pb.collection('avisos_config').create(payload)
      return getAvisosConfig(tenantId) as Promise<AvisosConfigRecord>
    }
  }
}

export async function getFeriados(tenantId?: string): Promise<FeriadoRecord[]> {
  try {
    const filter = tenantId ? `tenant = "" || tenant = "${tenantId}"` : ''
    const list = await pb.collection('feriados').getFullList({
      filter,
      sort: 'data',
    })
    return list.map((r) => ({
      id: r.id,
      tenant: r.tenant,
      data: r.data?.substring(0, 10) || '',
      descricao: r.descricao,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    console.warn('Erro ao listar feriados:', err)
    return []
  }
}

export async function createFeriado(data: {
  tenant?: string
  data: string
  descricao: string
}): Promise<FeriadoRecord> {
  const created = await pb.collection('feriados').create(data)
  return {
    id: created.id,
    tenant: created.tenant,
    data: created.data?.substring(0, 10) || '',
    descricao: created.descricao,
  }
}

export async function deleteFeriado(id: string): Promise<boolean> {
  return await pb.collection('feriados').delete(id)
}

export async function desbloquearUsuarioManual(userId: string, tenantId?: string): Promise<any> {
  return await pb.send('/backend/v1/avisos/desbloquear-usuario', {
    method: 'POST',
    body: JSON.stringify({ userId, tenantId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function dispararAvisoTeste(userId: string, tenantId?: string): Promise<any> {
  return await pb.send('/backend/v1/avisos/disparar-teste', {
    method: 'POST',
    body: JSON.stringify({ userId, tenantId }),
    headers: { 'Content-Type': 'application/json' },
  })
}
