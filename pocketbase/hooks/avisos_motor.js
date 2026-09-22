// Hook: Avisos e Ciência - Motor Diário e Lembretes / Bloqueios
// Executa periodicamente a cada minuto para checar horário de aviso diário, lembretes e limite de bloqueio

cronAdd('avisos_motor_cron', '* * * * *', () => {
  let token = ($os.getenv('TELEGRAM_AVISOS_BOT_TOKEN') || '').trim()
  if (!token) {
    try {
      const rec = $app.findFirstRecordByData(
        'security_audit_markers',
        'marker_key',
        'telegram_avisos_bot_token',
      )
      const raw = rec.getString('details')
      const parsed = JSON.parse(raw)
      if (parsed && parsed.token) token = String(parsed.token).trim()
    } catch (_) {}
  }
  if (token) {
    console.log('[AVISOS_TOKEN] token carregado do banco (len=' + token.length + ')')
  } else {
    console.log('[AVISOS_TOKEN] token não encontrado')
  }
  if (!token) {
    return
  }

  const now = new Date()
  // Horário atual no formato HH:mm (fuso UTC / local do servidor)
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  const currentHHMM = pad(now.getHours()) + ':' + pad(now.getMinutes())
  const todayYMD = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const yearStr = String(now.getFullYear())

  // Carregar todos os tenants ativos que possuem avisos_config ativo
  let configs = []
  try {
    configs = $app.findRecordsByFilter('avisos_config', 'ativo = true', '', 100, 0)
  } catch (err) {
    return
  }

  for (let c = 0; c < configs.length; c++) {
    const cfg = configs[c]
    const tenantId = cfg.getString('tenant')
    if (!tenantId) continue

    // Checar se o tenant está ativo
    try {
      const tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
      if (tenantRec.getString('status') === 'inativa') {
        continue
      }
    } catch (_) {
      continue
    }

    const horarioAviso = cfg.getString('horario_aviso_diario') || '08:00'
    const horarioLimite = cfg.getString('horario_limite_confirmacao') || '12:00'
    const diasAntecedencia = cfg.getInt('dias_antecedencia') || 2
    const intervaloHoras = cfg.getInt('intervalo_lembrete_horas') || 3
    const maxLembretes = cfg.getInt('max_lembretes') || 2
    const bloqueioAuto = cfg.getBool('bloqueio_automatico')
    const exigirSemDemandas = cfg.getBool('exigir_confirmacao_sem_demandas')
    const tipoContagem = cfg.getString('tipo_contagem_dias') || 'dias_uteis'
    let faixas = {
      baixa_dias: 5,
      media_dias_min: 3,
      media_dias_max: 5,
      alta_dias_min: 1,
      alta_dias_max: 2,
      critica_dias: 0,
    }
    try {
      const parsed = cfg.get('faixas_urgencia')
      if (parsed && typeof parsed === 'object') {
        faixas = Object.assign(faixas, parsed)
      }
    } catch (_) {}
    const msgPadrao = cfg.getString('mensagem_padrao') || 'BÚSSOLA JURÍDICA — AVISO DIÁRIO'

    // Carregar feriados do tenant + nacionais para cálculo de dias úteis
    let feriadosSet = {}
    try {
      const fFilter = "tenant = '' || tenant = {:tenantId}"
      const feriadosList = $app.findRecordsByFilter('feriados', fFilter, '', 200, 0, {
        tenantId: tenantId,
      })
      for (let f = 0; f < feriadosList.length; f++) {
        const dStr = feriadosList[f].getString('data').substring(0, 10)
        feriadosSet[dStr] = true
      }
    } catch (_) {}

    // Função interna para cálculo de diferença de dias
    const calcularDias = (targetDateStr) => {
      if (!targetDateStr) return 999
      const target = new Date(targetDateStr.substring(0, 10) + 'T00:00:00')
      const start = new Date(todayYMD + 'T00:00:00')
      const diffMs = target.getTime() - start.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

      if (tipoContagem === 'dias_corridos') {
        return diffDays
      }

      // Contagem de dias úteis entre hoje e o prazo
      if (diffDays === 0) return 0
      const step = diffDays > 0 ? 1 : -1
      let businessDays = 0
      let cur = new Date(start.getTime())

      while (
        (step > 0 && cur.getTime() < target.getTime()) ||
        (step < 0 && cur.getTime() > target.getTime())
      ) {
        cur.setDate(cur.getDate() + step)
        const dayOfWeek = cur.getDay() // 0 = dom, 6 = sab
        const curYMD = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate())
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isFeriado = Boolean(feriadosSet[curYMD])
        if (!isWeekend && !isFeriado) {
          businessDays += step
        }
      }
      return businessDays
    }

    const classificarUrgencia = (dias) => {
      if (dias < 0) return { nivel: 'VENCIDA', icone: '🔴' }
      if (dias === 0) return { nivel: 'CRÍTICA', icone: '🔴' }
      if (dias <= (faixas.alta_dias_max || 2)) return { nivel: 'ALTA', icone: '🟠' }
      if (dias <= (faixas.media_dias_max || 5)) return { nivel: 'MÉDIA', icone: '🟡' }
      return { nivel: 'BAIXA', icone: '🟢' }
    }

    // Carregar usuários ativos do tenant com receber_avisos_telegram=true e telegram_id não vazio
    let eligibleUsers = []
    try {
      const uFilter =
        "status = 'ativo' && receber_avisos_telegram = true && telegram_id != '' && (tenant = {:tenantId} || id != '')"
      const allUsers = $app.findRecordsByFilter('users', uFilter, '', 200, 0, {
        tenantId: tenantId,
      })
      for (let u = 0; u < allUsers.length; u++) {
        const usr = allUsers[u]
        // Checar se o usuário tem vínculo ativo com o tenant
        try {
          const mems = $app.findRecordsByFilter(
            'user_memberships',
            "user = {:userId} && tenant = {:tenantId} && status = 'ativo'",
            '',
            1,
            0,
            { userId: usr.id, tenantId: tenantId },
          )
          if (mems.length > 0 || usr.getString('tenant') === tenantId) {
            eligibleUsers.push(usr)
          }
        } catch (_) {
          if (usr.getString('tenant') === tenantId) {
            eligibleUsers.push(usr)
          }
        }
      }
    } catch (_) {}

    // ==========================================
    // 1. CICLO DIÁRIO (no horario_aviso_diario)
    // ==========================================
    if (currentHHMM === horarioAviso) {
      for (let u = 0; u < eligibleUsers.length; u++) {
        const usr = eligibleUsers[u]
        const tgId = usr.getString('telegram_id')

        // Verificar se já foi gerado aviso diário hoje para este usuário neste tenant
        try {
          const existing = $app.findRecordsByFilter(
            'avisos',
            "tenant = {:tenantId} && user = {:userId} && tipo = 'diario' && created >= {:startToday}",
            '',
            1,
            0,
            { tenantId: tenantId, userId: usr.id, startToday: todayYMD + ' 00:00:00' },
          )
          if (existing.length > 0) {
            continue // Já enviado hoje
          }
        } catch (_) {}

        // Coletar projetos e DFDs do usuário
        let userDemandas = []

        // Projetos do tenant onde o usuário é responsável
        try {
          const pFilter = 'tenant = {:tenantId} && responsible_user = {:userId}'
          const projs = $app.findRecordsByFilter('projects', pFilter, 'prazo', 50, 0, {
            tenantId: tenantId,
            userId: usr.id,
          })
          for (let p = 0; p < projs.length; p++) {
            const pr = projs[p]
            const prazoStr = pr.getString('prazo')
            const dias = calcularDias(prazoStr)
            const urg = classificarUrgencia(dias)
            // Incluir se estiver dentro da janela de antecedência OU se for crítica/vencida
            if (dias <= diasAntecedencia || dias <= 0) {
              userDemandas.push({
                id: pr.id,
                tipo: 'projeto',
                titulo: pr.getString('titulo') || pr.getString('objeto') || 'Projeto sem título',
                prazo: prazoStr ? prazoStr.substring(0, 10) : 'Sem prazo',
                dias: dias,
                urgencia: urg.nivel,
                icone: urg.icone,
                coluna: pr.getString('coluna_kanban'),
              })
            }
          }
        } catch (_) {}

        // DFDs do tenant onde o usuário é responsável
        try {
          const dFilter = 'tenant = {:tenantId} && responsible_user = {:userId}'
          const dfdsList = $app.findRecordsByFilter('dfds', dFilter, 'prazo', 50, 0, {
            tenantId: tenantId,
            userId: usr.id,
          })
          for (let d = 0; d < dfdsList.length; d++) {
            const df = dfdsList[d]
            const prazoStr = df.getString('prazo')
            const dias = calcularDias(prazoStr)
            const urg = classificarUrgencia(dias)
            if (dias <= diasAntecedencia || dias <= 0) {
              userDemandas.push({
                id: df.id,
                tipo: 'dfd',
                titulo: df.getString('titulo') || df.getString('objeto') || 'DFD sem título',
                prazo: prazoStr ? prazoStr.substring(0, 10) : 'Sem prazo',
                dias: dias,
                urgencia: urg.nivel,
                icone: urg.icone,
                status: df.getString('status'),
              })
            }
          }
        } catch (_) {}

        // Se não houver demandas e NÃO exigir confirmação sem demandas: pula
        if (userDemandas.length === 0 && !exigirSemDemandas) {
          continue
        }

        // Gerar código sequencial do aviso: AVS-YYYY-NNNNNN
        let seqNum = 1
        try {
          const totalAvisosAno = $app.countRecords('avisos')
          seqNum = totalAvisosAno + 1
        } catch (_) {}
        const seqStr = String(seqNum).padStart(6, '0')
        const codigoAviso = 'AVS-' + yearStr + '-' + seqStr

        // Criar registro na coleção avisos
        const colAvisos = $app.findCollectionByNameOrId('avisos')
        const avisoRec = new Record(colAvisos)
        avisoRec.set('codigo', codigoAviso)
        avisoRec.set('user', usr.id)
        avisoRec.set('tenant', tenantId)
        avisoRec.set('telegram_id', tgId)
        avisoRec.set('tipo', 'diario')
        avisoRec.set('demandas_vinculadas', userDemandas)
        avisoRec.set('qtd_demandas', userDemandas.length)
        avisoRec.set('status', 'pendente_envio')
        avisoRec.set('tentativas_envio', 1)
        $app.save(avisoRec)

        // Montar mensagem no formato exato estipulado
        const nomeUsuario = usr.getString('name') || 'Servidor'
        let msg = '*' + msgPadrao + '*\n\n'
        msg += 'Olá, *' + nomeUsuario + '*.\n\n'

        if (userDemandas.length === 0) {
          msg += 'Não existem demandas disponíveis para você neste momento.\n\n'
          msg += 'Por favor, confirme a ciência abaixo.'
        } else {
          msg += 'Você possui *' + userDemandas.length + '* demanda(s) pendente(s) de atenção:\n\n'
          for (let i = 0; i < userDemandas.length; i++) {
            const dem = userDemandas[i]
            const prazoFormatado =
              dem.prazo && dem.prazo !== 'Sem prazo'
                ? dem.prazo.split('-').reverse().join('/')
                : 'Sem prazo'
            msg +=
              String(i + 1) +
              '. ' +
              dem.icone +
              ' *' +
              dem.titulo +
              '* (' +
              dem.tipo.toUpperCase() +
              ')\n'
            msg += '   • Prazo: `' + prazoFormatado + '` | Urgência: *' + dem.urgencia + '*\n'
          }
          msg +=
            '\nPor favor, confirme a ciência da leitura abaixo para registrar sua conformidade.'
        }

        // Inline keyboard com botão de confirmação com ID do aviso
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: '✅ CONFIRMAR LEITURA E CIÊNCIA',
                callback_data: 'confirmar_aviso:' + avisoRec.id,
              },
            ],
          ],
        }

        // Enviar via Telegram Bot API
        try {
          const res = $http.send({
            url: 'https://api.telegram.org/bot' + token + '/sendMessage',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgId,
              text: msg,
              parse_mode: 'Markdown',
              reply_markup: inlineKeyboard,
            }),
            timeout: 15,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            let resJson = {}
            try {
              resJson = JSON.parse(res.raw)
            } catch (_) {}
            const msgId = resJson.result ? String(resJson.result.message_id) : ''
            avisoRec.set('status', 'aguardando_confirmacao')
            avisoRec.set('data_hora_envio', new Date().toISOString())
            avisoRec.set('telegram_message_id', msgId)
            $app.save(avisoRec)

            // Registrar auditoria
            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const auditRec = new Record(auditCol)
              auditRec.set('user_name', nomeUsuario)
              auditRec.set('action_type', 'Aviso Telegram enviado')
              auditRec.set(
                'description',
                'Aviso diário ' +
                  codigoAviso +
                  ' enviado com ' +
                  userDemandas.length +
                  ' demanda(s).',
              )
              auditRec.set('tenant', tenantId)
              $app.save(auditRec)
            } catch (_) {}
          } else {
            avisoRec.set('status', 'pendente_envio')
            avisoRec.set('ultimo_erro', 'HTTP ' + res.statusCode + ': ' + res.raw)
            $app.save(avisoRec)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const auditRec = new Record(auditCol)
              auditRec.set('user_name', nomeUsuario)
              auditRec.set('action_type', 'Falha no envio de aviso Telegram')
              auditRec.set(
                'description',
                'Erro ao enviar aviso ' + codigoAviso + ': HTTP ' + res.statusCode,
              )
              auditRec.set('tenant', tenantId)
              $app.save(auditRec)
            } catch (_) {}
          }
        } catch (sendErr) {
          avisoRec.set('status', 'pendente_envio')
          avisoRec.set('ultimo_erro', String(sendErr))
          $app.save(avisoRec)
        }
      }
    }

    // ==============================================================
    // 2. LEMBRETES (a cada intervaloHoras) & BLOQUEIO AUTOMÁTICO
    // ==============================================================
    try {
      // Buscar avisos de hoje aguardando confirmação neste tenant
      const pFilter =
        "tenant = {:tenantId} && status = 'aguardando_confirmacao' && created >= {:startToday}"
      const avisosPendentes = $app.findRecordsByFilter('avisos', pFilter, 'created', 100, 0, {
        tenantId: tenantId,
        startToday: todayYMD + ' 00:00:00',
      })

      for (let a = 0; a < avisosPendentes.length; a++) {
        const av = avisosPendentes[a]
        const userId = av.getString('user')
        const tgId = av.getString('telegram_id')
        const cod = av.getString('codigo')
        const createdDate = new Date(av.getString('created'))
        const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
        const tentativas = av.getInt('tentativas_envio') || 1

        // Carregar registro do usuário
        let userRec = null
        try {
          userRec = $app.findFirstRecordByData('users', 'id', userId)
        } catch (_) {
          continue
        }

        // Checar BLOQUEIO AUTOMÁTICO se passou do horario_limite_confirmacao
        if (bloqueioAuto && currentHHMM >= horarioLimite) {
          // Bloquear o usuário
          av.set('status', 'bloqueado')
          $app.save(av)

          userRec.set('status_bloqueio', 'bloqueado_ciencia')
          $app.save(userRec)

          // Atualizar também na membership para coerência
          try {
            const mems = $app.findRecordsByFilter(
              'user_memberships',
              'user = {:userId} && tenant = {:tenantId}',
              '',
              1,
              0,
              { userId: userId, tenantId: tenantId },
            )
            if (mems.length > 0) {
              mems[0].set('status_bloqueio', 'bloqueado_ciencia')
              $app.save(mems[0])
            }
          } catch (_) {}

          // Auditoria de bloqueio
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const auditRec = new Record(auditCol)
            auditRec.set('user_name', userRec.getString('name') || 'Servidor')
            auditRec.set('action_type', 'Usuário bloqueado por ciência')
            auditRec.set(
              'description',
              'Usuário bloqueado automaticamente por ausência de confirmação do aviso ' + cod,
            )
            auditRec.set('tenant', tenantId)
            $app.save(auditRec)
          } catch (_) {}

          // Notificar no Telegram sobre o bloqueio
          if (tgId) {
            try {
              $http.send({
                url: 'https://api.telegram.org/bot' + token + '/sendMessage',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: tgId,
                  text:
                    '⚠️ *ACESSO TEMPORARIAMENTE BLOQUEADO*\n\n' +
                    'O horário limite (' +
                    horarioLimite +
                    ') expirou sem a confirmação de ciência do aviso *' +
                    cod +
                    '*.\n' +
                    'Seu acesso ao Bússola Jurídica foi pausado temporariamente.\n\n' +
                    'Clique no botão abaixo para confirmar a leitura e restabelecer imediatamente seu acesso:',
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: '✅ CONFIRMAR LEITURA E DESBLOQUEAR',
                          callback_data: 'confirmar_aviso:' + av.id,
                        },
                      ],
                    ],
                  },
                }),
                timeout: 10,
              })
            } catch (_) {}
          }
          continue
        }

        // Se ainda não atingiu o horário limite: verificar se cabe envio de lembrete
        // Lembrete disparado se diffHours >= intervaloHoras * tentativas E tentativas <= maxLembretes
        if (tentativas <= maxLembretes && diffHours >= intervaloHoras * tentativas) {
          av.set('tentativas_envio', tentativas + 1)
          $app.save(av)

          if (tgId) {
            try {
              const lembRes = $http.send({
                url: 'https://api.telegram.org/bot' + token + '/sendMessage',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: tgId,
                  text:
                    '⏰ *LEMBRETE DE CIÊNCIA DE PRAZOS (' +
                    tentativas +
                    '/' +
                    maxLembretes +
                    ')*\n\n' +
                    'Olá, *' +
                    (userRec.getString('name') || 'Servidor') +
                    '*.\n' +
                    'Identificamos que você ainda não confirmou o aviso diário *' +
                    cod +
                    '*.\n' +
                    'O horário limite para confirmação é às *' +
                    horarioLimite +
                    '*.\n\n' +
                    'Por favor, confirme a leitura no botão abaixo:',
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: '✅ CONFIRMAR LEITURA E CIÊNCIA',
                          callback_data: 'confirmar_aviso:' + av.id,
                        },
                      ],
                    ],
                  },
                }),
                timeout: 10,
              })

              if (lembRes.statusCode >= 200 && lembRes.statusCode < 300) {
                try {
                  const auditCol = $app.findCollectionByNameOrId('audit_logs')
                  const auditRec = new Record(auditCol)
                  auditRec.set('user_name', userRec.getString('name') || 'Servidor')
                  auditRec.set('action_type', 'Lembrete Telegram enviado')
                  auditRec.set(
                    'description',
                    'Lembrete #' + tentativas + ' do aviso ' + cod + ' enviado com sucesso.',
                  )
                  auditRec.set('tenant', tenantId)
                  $app.save(auditRec)
                } catch (_) {}
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }
})
