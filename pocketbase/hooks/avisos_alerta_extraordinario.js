// Hook: Alerta Extraordinário para Demandas Críticas ou Vencidas
// Disparado imediatamente após a criação ou atualização de um Projeto ou DFD
// quando o prazo for crítico (0 dias) ou vencido (<0 dias) e o tenant tiver alerta_extraordinario_critica_vencida = true

onRecordAfterCreateSuccess((e) => {
  let token = ($os.getenv('TELEGRAM_AVISOS_BOT_TOKEN') || '').trim()
  if (!token) {
    try {
      const rec = $app.findFirstRecordByData(
        'security_audit_markers',
        'marker_key',
        'telegram_avisos_bot_token',
      )
      const details = rec.get('details')
      if (details && typeof details === 'object' && details.token) {
        token = String(details.token).trim()
      } else if (typeof details === 'string') {
        const parsed = JSON.parse(details)
        if (parsed && parsed.token) token = String(parsed.token).trim()
      }
    } catch (_) {}
  }
  if (!token) return

  const record = e.record
  if (!record) return

  const tenantId = record.getString('tenant')
  const respUserId = record.getString('responsible_user')
  const prazoStr = record.getString('prazo')
  if (!tenantId || !respUserId || !prazoStr) return

  // Verificar se o tenant tem alerta extraordinário ativo
  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('avisos_config', 'tenant', tenantId)
    if (!cfg.getBool('ativo') || !cfg.getBool('alerta_extraordinario_critica_vencida')) {
      return
    }
  } catch (_) {
    return
  }

  // Calcular diferença de dias
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  const now = new Date()
  const todayYMD = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const pDate = new Date(prazoStr.substring(0, 10) + 'T00:00:00')
  const sDate = new Date(todayYMD + 'T00:00:00')
  const diffDays = Math.round((pDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))

  // Apenas crítica (0) ou vencida (<0)
  if (diffDays > 0) return

  // Buscar usuário responsável
  let usr = null
  try {
    usr = $app.findFirstRecordByData('users', 'id', respUserId)
  } catch (_) {
    return
  }

  const tgId = usr.getString('telegram_id')
  if (!tgId || !usr.getBool('receber_avisos_telegram')) return

  // Gerar código único para o alerta
  const yearStr = String(now.getFullYear())
  let seqNum = 1
  try {
    seqNum = $app.countRecords('avisos') + 1
  } catch (_) {}
  const seqStr = String(seqNum).padStart(6, '0')
  const codigoAviso = 'AVS-' + yearStr + '-' + seqStr

  const demTitulo = record.getString('titulo') || record.getString('objeto') || 'Projeto'
  const demData = [
    {
      id: record.id,
      tipo: 'projeto',
      titulo: demTitulo,
      prazo: prazoStr.substring(0, 10),
      dias: diffDays,
      urgencia: diffDays < 0 ? 'VENCIDA' : 'CRÍTICA',
      icone: '🔴',
    },
  ]

  // Criar registro na coleção avisos
  let avisoRec = null
  try {
    const colAvisos = $app.findCollectionByNameOrId('avisos')
    avisoRec = new Record(colAvisos)
    avisoRec.set('codigo', codigoAviso)
    avisoRec.set('user', usr.id)
    avisoRec.set('tenant', tenantId)
    avisoRec.set('telegram_id', tgId)
    avisoRec.set('tipo', 'alerta_extraordinario')
    avisoRec.set('demandas_vinculadas', demData)
    avisoRec.set('qtd_demandas', 1)
    avisoRec.set('status', 'pendente_envio')
    avisoRec.set('tentativas_envio', 1)
    $app.save(avisoRec)
  } catch (_) {
    return
  }

  const prazoFmt = prazoStr.substring(0, 10).split('-').reverse().join('/')
  const situacao = diffDays < 0 ? '🚨 *DEMANDA VENCIDA*' : '🚨 *PRAZO CRÍTICO (VENCE HOJE)*'
  const msg =
    '🚨 *ALERTA EXTRAORDINÁRIO DE PRAZO*\n\n' +
    'Olá, *' +
    (usr.getString('name') || 'Servidor') +
    '*!\n\n' +
    'Uma demanda urgente foi atribuída a você com prazo imediato:\n\n' +
    '• *Projeto:* ' +
    demTitulo +
    '\n' +
    '• *Situação:* ' +
    situacao +
    '\n' +
    '• *Prazo Fatal:* `' +
    prazoFmt +
    '`\n\n' +
    'Por favor, confirme a ciência da leitura abaixo para registrar sua ciência oficial.'

  try {
    const res = $http.send({
      url: 'https://api.telegram.org/bot' + token + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ CONFIRMAR LEITURA E CIÊNCIA',
                callback_data: 'confirmar_aviso:' + avisoRec.id,
              },
            ],
          ],
        },
      }),
      timeout: 10,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      avisoRec.set('status', 'aguardando_confirmacao')
      avisoRec.set('data_hora_envio', new Date().toISOString())
      $app.save(avisoRec)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRec = new Record(auditCol)
        auditRec.set('user_name', usr.getString('name') || 'Servidor')
        auditRec.set('action_type', 'Alerta extraordinário enviado')
        auditRec.set(
          'description',
          'Alerta extraordinário ' + codigoAviso + ' enviado para projeto urgente.',
        )
        auditRec.set('tenant', tenantId)
        $app.save(auditRec)
      } catch (_) {}
    }
  } catch (_) {}
}, 'projects')

onRecordAfterCreateSuccess((e) => {
  let token = ($os.getenv('TELEGRAM_AVISOS_BOT_TOKEN') || '').trim()
  if (!token) {
    try {
      const rec = $app.findFirstRecordByData(
        'security_audit_markers',
        'marker_key',
        'telegram_avisos_bot_token',
      )
      const details = rec.get('details')
      if (details && typeof details === 'object' && details.token) {
        token = String(details.token).trim()
      } else if (typeof details === 'string') {
        const parsed = JSON.parse(details)
        if (parsed && parsed.token) token = String(parsed.token).trim()
      }
    } catch (_) {}
  }
  if (!token) return

  const record = e.record
  if (!record) return

  const tenantId = record.getString('tenant')
  const respUserId = record.getString('responsible_user')
  const prazoStr = record.getString('prazo')
  if (!tenantId || !respUserId || !prazoStr) return

  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('avisos_config', 'tenant', tenantId)
    if (!cfg.getBool('ativo') || !cfg.getBool('alerta_extraordinario_critica_vencida')) {
      return
    }
  } catch (_) {
    return
  }

  const pad = (n) => (n < 10 ? '0' + n : String(n))
  const now = new Date()
  const todayYMD = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const pDate = new Date(prazoStr.substring(0, 10) + 'T00:00:00')
  const sDate = new Date(todayYMD + 'T00:00:00')
  const diffDays = Math.round((pDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return

  let usr = null
  try {
    usr = $app.findFirstRecordByData('users', 'id', respUserId)
  } catch (_) {
    return
  }

  const tgId = usr.getString('telegram_id')
  if (!tgId || !usr.getBool('receber_avisos_telegram')) return

  const yearStr = String(now.getFullYear())
  let seqNum = 1
  try {
    seqNum = $app.countRecords('avisos') + 1
  } catch (_) {}
  const seqStr = String(seqNum).padStart(6, '0')
  const codigoAviso = 'AVS-' + yearStr + '-' + seqStr

  const demTitulo = record.getString('titulo') || record.getString('objeto') || 'DFD'
  const demData = [
    {
      id: record.id,
      tipo: 'dfd',
      titulo: demTitulo,
      prazo: prazoStr.substring(0, 10),
      dias: diffDays,
      urgencia: diffDays < 0 ? 'VENCIDA' : 'CRÍTICA',
      icone: '🔴',
    },
  ]

  let avisoRec = null
  try {
    const colAvisos = $app.findCollectionByNameOrId('avisos')
    avisoRec = new Record(colAvisos)
    avisoRec.set('codigo', codigoAviso)
    avisoRec.set('user', usr.id)
    avisoRec.set('tenant', tenantId)
    avisoRec.set('telegram_id', tgId)
    avisoRec.set('tipo', 'alerta_extraordinario')
    avisoRec.set('demandas_vinculadas', demData)
    avisoRec.set('qtd_demandas', 1)
    avisoRec.set('status', 'pendente_envio')
    avisoRec.set('tentativas_envio', 1)
    $app.save(avisoRec)
  } catch (_) {
    return
  }

  const prazoFmt = prazoStr.substring(0, 10).split('-').reverse().join('/')
  const situacao = diffDays < 0 ? '🚨 *DFD VENCIDO*' : '🚨 *DFD CRÍTICO (VENCE HOJE)*'
  const msg =
    '🚨 *ALERTA EXTRAORDINÁRIO DE PRAZO*\n\n' +
    'Olá, *' +
    (usr.getString('name') || 'Servidor') +
    '*!\n\n' +
    'Um DFD urgente foi atribuído a você com prazo imediato:\n\n' +
    '• *DFD:* ' +
    demTitulo +
    '\n' +
    '• *Situação:* ' +
    situacao +
    '\n' +
    '• *Prazo Fatal:* `' +
    prazoFmt +
    '`\n\n' +
    'Por favor, confirme a ciência da leitura abaixo para registrar sua ciência oficial.'

  try {
    const res = $http.send({
      url: 'https://api.telegram.org/bot' + token + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ CONFIRMAR LEITURA E CIÊNCIA',
                callback_data: 'confirmar_aviso:' + avisoRec.id,
              },
            ],
          ],
        },
      }),
      timeout: 10,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      avisoRec.set('status', 'aguardando_confirmacao')
      avisoRec.set('data_hora_envio', new Date().toISOString())
      $app.save(avisoRec)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRec = new Record(auditCol)
        auditRec.set('user_name', usr.getString('name') || 'Servidor')
        auditRec.set('action_type', 'Alerta extraordinário enviado')
        auditRec.set(
          'description',
          'Alerta extraordinário ' + codigoAviso + ' enviado para DFD urgente.',
        )
        auditRec.set('tenant', tenantId)
        $app.save(auditRec)
      } catch (_) {}
    }
  } catch (_) {}
}, 'dfds')
