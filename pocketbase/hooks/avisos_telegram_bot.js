// Hook: Callback e Comandos do Telegram para o Bot de Avisos & Ciência
// Implementa polling leve / webhook para processar mensagens recebidas:
// - Vínculo automático de e-mail ao Telegram ID
// - Callback de confirmação de ciência e desbloqueio
// - Comandos: /start, /demandas, /urgentes, /hoje, /semana, /status

// Rota para Webhook do Telegram (se configurado) ou chamada manual
routerAdd('POST', '/backend/v1/telegram-avisos/webhook', (e) => {
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
  if (!token) {
    return e.json(200, { ok: true, message: 'Bot token não configurado.' })
  }

  const update = e.requestInfo().body || {}
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  const now = new Date()
  const todayYMD = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())

  const sendTelegramMsg = (chatId, text, inlineKeyboard) => {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }
      if (inlineKeyboard) {
        payload.reply_markup = inlineKeyboard
      }
      return $http.send({
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10,
      })
    } catch (err) {
      return null
    }
  }

  const answerCallback = (callbackId, text, showAlert) => {
    try {
      return $http.send({
        url: 'https://api.telegram.org/bot' + token + '/answerCallbackQuery',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: text,
          show_alert: Boolean(showAlert),
        }),
        timeout: 10,
      })
    } catch (err) {
      return null
    }
  }

  // 1. Processar CALLBACK QUERY (clique no botão Inline)
  if (update.callback_query) {
    const cb = update.callback_query
    const fromId = String(cb.from.id)
    const data = String(cb.data || '')
    const callbackId = cb.id

    if (data.indexOf('confirmar_aviso:') === 0) {
      const avisoId = data.replace('confirmar_aviso:', '').trim()
      let avisoRec = null
      try {
        avisoRec = $app.findFirstRecordByData('avisos', 'id', avisoId)
      } catch (_) {
        answerCallback(callbackId, 'Aviso não encontrado no sistema.', true)
        return e.json(200, { ok: true })
      }

      const avisoUserId = avisoRec.getString('user')
      let userRec = null
      try {
        userRec = $app.findFirstRecordByData('users', 'id', avisoUserId)
      } catch (_) {
        answerCallback(callbackId, 'Usuário não localizado.', true)
        return e.json(200, { ok: true })
      }

      // Validar se o Telegram ID bate com o usuário vinculado
      const userTgId = userRec.getString('telegram_id')
      if (userTgId !== fromId) {
        answerCallback(callbackId, 'Seu Telegram ID não corresponde ao usuário deste aviso.', true)
        return e.json(200, { ok: true })
      }

      // Atualizar status do aviso para confirmado
      const nowIso = new Date().toISOString()
      avisoRec.set('status', 'confirmado')
      avisoRec.set('data_hora_confirmacao', nowIso)
      $app.save(avisoRec)

      // Se o usuário estava bloqueado por ciência, desbloquear
      const wasBlocked = userRec.getString('status_bloqueio') === 'bloqueado_ciencia'
      if (wasBlocked) {
        userRec.set('status_bloqueio', 'ativo')
        $app.save(userRec)

        // Atualizar também na membership
        const tenantId = avisoRec.getString('tenant')
        try {
          const mems = $app.findRecordsByFilter(
            'user_memberships',
            'user = {:userId} && tenant = {:tenantId}',
            '',
            1,
            0,
            { userId: userRec.id, tenantId: tenantId },
          )
          if (mems.length > 0) {
            mems[0].set('status_bloqueio', 'ativo')
            $app.save(mems[0])
          }
        } catch (_) {}

        // Auditoria: desbloqueado
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const auditRec = new Record(auditCol)
          auditRec.set('user_name', userRec.getString('name') || 'Servidor')
          auditRec.set('action_type', 'Usuário desbloqueado por ciência')
          auditRec.set(
            'description',
            'Usuário desbloqueado automaticamente após confirmar ciência do aviso ' +
              avisoRec.getString('codigo'),
          )
          auditRec.set('tenant', tenantId)
          $app.save(auditRec)
        } catch (_) {}
      }

      // Auditoria: confirmação de ciência registrada
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRec = new Record(auditCol)
        auditRec.set('user_name', userRec.getString('name') || 'Servidor')
        auditRec.set('action_type', 'Confirmação de ciência registrada')
        auditRec.set(
          'description',
          'Confirmação registrada para o aviso ' +
            avisoRec.getString('codigo') +
            ' com ' +
            avisoRec.getInt('qtd_demandas') +
            ' demanda(s) vinculadas.',
        )
        auditRec.set('tenant', avisoRec.getString('tenant'))
        $app.save(auditRec)
      } catch (_) {}

      answerCallback(callbackId, 'Ciência confirmada com sucesso!', false)
      sendTelegramMsg(
        fromId,
        '✅ *CIÊNCIA CONFIRMADA COM SUCESSO!*\n\n' +
          'Aviso: *' +
          avisoRec.getString('codigo') +
          '*\n' +
          'Data/Hora: `' +
          new Date().toLocaleString('pt-BR') +
          '`\n\n' +
          (wasBlocked
            ? '🔓 *Seu acesso ao Bússola Jurídica foi restabelecido e desbloqueado!*'
            : 'Seu registro de leitura e ciência foi arquivado com conformidade jurídica.'),
      )

      return e.json(200, { ok: true })
    }
  }

  // 2. Processar MENSAGEM DE TEXTO / COMANDOS
  if (update.message && update.message.text) {
    const msg = update.message
    const fromId = String(msg.from.id)
    const text = String(msg.text).trim()

    // A. Vínculo automático por e-mail: se o texto contém '@' e tem formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (emailRegex.test(text.toLowerCase())) {
      const emailInput = text.toLowerCase()
      let matchedUsers = []
      try {
        matchedUsers = $app.findRecordsByFilter('users', 'email = {:em}', '', 5, 0, {
          em: emailInput,
        })
      } catch (_) {}

      if (matchedUsers.length === 0) {
        sendTelegramMsg(
          fromId,
          '❌ *E-mail não localizado.*\n\nO endereço `' +
            emailInput +
            '` não foi encontrado entre os servidores cadastrados no Bússola Jurídica.\n\nVerifique a digitação ou contate o administrador da sua prefeitura.',
        )
        return e.json(200, { ok: true })
      }

      const targetUser = matchedUsers[0]
      targetUser.set('telegram_id', fromId)
      targetUser.set('receber_avisos_telegram', true)
      $app.save(targetUser)

      // Atualizar também na membership ativa para consistência
      try {
        const mems = $app.findRecordsByFilter('user_memberships', 'user = {:uid}', '', 10, 0, {
          uid: targetUser.id,
        })
        for (let m = 0; m < mems.length; m++) {
          mems[m].set('receber_avisos_telegram', true)
          $app.save(mems[m])
        }
      } catch (_) {}

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRec = new Record(auditCol)
        auditRec.set('user_name', targetUser.getString('name') || emailInput)
        auditRec.set('action_type', 'Telegram pareado com sucesso')
        auditRec.set('description', 'Telegram ID ' + fromId + ' vinculado ao e-mail ' + emailInput)
        auditRec.set('tenant', targetUser.getString('tenant') || '')
        $app.save(auditRec)
      } catch (_) {}

      sendTelegramMsg(
        fromId,
        '🎉 *CONEXÃO REALIZADA COM SUCESSO!*\n\n' +
          'Olá, *' +
          (targetUser.getString('name') || 'Servidor') +
          '*!\n' +
          'Seu Telegram foi vinculado à sua conta no Bússola Jurídica Municipal.\n\n' +
          'A partir de agora você receberá seus avisos diários de prazos aqui e poderá confirmar a ciência com 1 clique.\n\n' +
          'Experimente digitar:\n' +
          '• /demandas — Ver todas as suas demandas abertas\n' +
          '• /urgentes — Apenas demandas críticas e vencidas\n' +
          '• /hoje — Prazos que vencem hoje\n' +
          '• /semana — Prazos para os próximos 7 dias\n' +
          '• /status — Verificar status do seu cadastro e avisos',
      )
      return e.json(200, { ok: true })
    }

    // B. Buscar usuário pelo telegram_id vinculado
    let userLinked = null
    try {
      const uList = $app.findRecordsByFilter('users', 'telegram_id = {:tgId}', '', 1, 0, {
        tgId: fromId,
      })
      if (uList.length > 0) {
        userLinked = uList[0]
      }
    } catch (_) {}

    // Se o usuário ainda não está vinculado: orientar a vincular
    if (!userLinked) {
      sendTelegramMsg(
        fromId,
        '🏛️ *BÚSSOLA JURÍDICA MUNICIPAL — AVISOS E CIÊNCIA*\n\n' +
          'Olá! Este é o canal oficial de notificações e confirmação de ciência de prazos da sua prefeitura.\n\n' +
          'Para começar a receber seus avisos diários, por favor *envie o seu e-mail cadastrado* no sistema (ex: `seu.nome@prefeitura.gov.br`).',
      )
      return e.json(200, { ok: true })
    }

    // Identificar prefeitura / tenant vinculado
    const userTenantId = userLinked.getString('tenant')
    const userName = userLinked.getString('name') || 'Servidor'

    // COMANDO /start
    if (text === '/start') {
      sendTelegramMsg(
        fromId,
        '👋 Olá, *' +
          userName +
          '*!\n\n' +
          'Seu cadastro está conectado ao Bússola Jurídica.\n\n' +
          'Comandos disponíveis:\n' +
          '• /demandas — Ver todas as suas demandas atribuídas\n' +
          '• /urgentes — Ver demandas críticas ou vencidas\n' +
          '• /hoje — Demandas que vencem hoje\n' +
          '• /semana — Demandas com prazo nos próximos 7 dias\n' +
          '• /status — Status da conta e último aviso',
      )
      return e.json(200, { ok: true })
    }

    // COMANDO /status
    if (text === '/status') {
      const bloqStatus = userLinked.getString('status_bloqueio') || 'ativo'
      let statusTxt = '🟢 *CONTA REGULAR / ATIVA*'
      if (bloqStatus === 'bloqueado_ciencia') {
        statusTxt = '🔴 *BLOQUEADO POR FALTA DE CONFIRMAÇÃO*'
      }

      // Buscar último aviso
      let ultAvisoTxt = 'Nenhum aviso registrado recentemente.'
      try {
        const ultAvisos = $app.findRecordsByFilter('avisos', 'user = {:uid}', '-created', 1, 0, {
          uid: userLinked.id,
        })
        if (ultAvisos.length > 0) {
          const av = ultAvisos[0]
          ultAvisoTxt =
            '• Código: *' +
            av.getString('codigo') +
            '*\n' +
            '• Status: *' +
            av.getString('status') +
            '*\n' +
            '• Demandas: ' +
            av.getInt('qtd_demandas')
        }
      } catch (_) {}

      sendTelegramMsg(
        fromId,
        '📊 *STATUS DA CONTA — BÚSSOLA JURÍDICA*\n\n' +
          '• Servidor: *' +
          userName +
          '*\n' +
          '• Situação: ' +
          statusTxt +
          '\n' +
          '• Telegram ID: `' +
          fromId +
          '`\n\n' +
          '📋 *Último Aviso Enviado:*\n' +
          ultAvisoTxt,
      )
      return e.json(200, { ok: true })
    }

    // Função de listagem de demandas do usuário
    const listarDemandas = (modo) => {
      let items = []

      // Projetos
      try {
        const projs = $app.findRecordsByFilter(
          'projects',
          'responsible_user = {:uid}',
          'prazo',
          100,
          0,
          { uid: userLinked.id },
        )
        for (let p = 0; p < projs.length; p++) {
          const pr = projs[p]
          const prazoStr = pr.getString('prazo')
          let dias = 999
          if (prazoStr) {
            const pDate = new Date(prazoStr.substring(0, 10) + 'T00:00:00')
            const sDate = new Date(todayYMD + 'T00:00:00')
            dias = Math.round((pDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))
          }
          items.push({
            tipo: 'Projeto',
            titulo: pr.getString('titulo') || pr.getString('objeto') || 'Projeto',
            prazo: prazoStr ? prazoStr.substring(0, 10) : null,
            dias: dias,
          })
        }
      } catch (_) {}

      // DFDs
      try {
        const dfdsList = $app.findRecordsByFilter(
          'dfds',
          'responsible_user = {:uid}',
          'prazo',
          100,
          0,
          { uid: userLinked.id },
        )
        for (let d = 0; d < dfdsList.length; d++) {
          const df = dfdsList[d]
          const prazoStr = df.getString('prazo')
          let dias = 999
          if (prazoStr) {
            const pDate = new Date(prazoStr.substring(0, 10) + 'T00:00:00')
            const sDate = new Date(todayYMD + 'T00:00:00')
            dias = Math.round((pDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))
          }
          items.push({
            tipo: 'DFD',
            titulo: df.getString('titulo') || df.getString('objeto') || 'DFD',
            prazo: prazoStr ? prazoStr.substring(0, 10) : null,
            dias: dias,
          })
        }
      } catch (_) {}

      // Filtrar pelo modo
      if (modo === 'urgentes') {
        items = items.filter((it) => it.dias <= 0)
      } else if (modo === 'hoje') {
        items = items.filter((it) => it.dias === 0)
      } else if (modo === 'semana') {
        items = items.filter((it) => it.dias >= 0 && it.dias <= 7)
      }

      return items
    }

    if (text === '/demandas' || text === '/urgentes' || text === '/hoje' || text === '/semana') {
      const modo = text.replace('/', '')
      const list = listarDemandas(modo)

      let tituloMsg = '📋 *SUAS DEMANDAS*'
      if (modo === 'urgentes') tituloMsg = '🚨 *DEMANDAS CRÍTICAS E VENCIDAS*'
      if (modo === 'hoje') tituloMsg = '⏳ *DEMANDAS COM PRAZO HOJE*'
      if (modo === 'semana') tituloMsg = '📅 *DEMANDAS DOS PRÓXIMOS 7 DIAS*'

      if (list.length === 0) {
        sendTelegramMsg(
          fromId,
          tituloMsg + '\n\nNenhuma demanda encontrada para este filtro no momento! 🎉',
        )
        return e.json(200, { ok: true })
      }

      let resp = tituloMsg + ' (' + list.length + '):\n\n'
      for (let i = 0; i < list.length; i++) {
        const it = list[i]
        let icone = '🟢'
        if (it.dias < 0) icone = '🔴 VENCIDA'
        else if (it.dias === 0) icone = '🔴 HOJE'
        else if (it.dias <= 2) icone = '🟠 ALTA'
        else if (it.dias <= 5) icone = '🟡 MÉDIA'

        const prazoFmt = it.prazo ? it.prazo.split('-').reverse().join('/') : 'Sem prazo'
        resp += String(i + 1) + '. *' + it.titulo + '* (' + it.tipo + ')\n'
        resp += '   • Prazo: `' + prazoFmt + '` | ' + icone + '\n'
      }

      sendTelegramMsg(fromId, resp)
      return e.json(200, { ok: true })
    }

    // Mensagem não reconhecida
    sendTelegramMsg(
      fromId,
      'Comando não reconhecido. Digite /start para ver os comandos disponíveis ou /demandas para ver seus prazos.',
    )
    return e.json(200, { ok: true })
  }

  return e.json(200, { ok: true })
})

// Cron de sincronização / polling para updates do Telegram
// Permite que o bot funcione no Skip Cloud mesmo se o webhook externo não estiver configurado
cronAdd('avisos_telegram_polling', '* * * * *', () => {
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

  let lastUpdateId = 0
  try {
    const marker = $app.findFirstRecordByData(
      'security_audit_markers',
      'marker_key',
      'telegram_avisos_last_offset',
    )
    const val = parseInt(marker.getString('version') || '0', 10)
    if (!isNaN(val)) lastUpdateId = val
  } catch (_) {}

  try {
    const res = $http.send({
      url:
        'https://api.telegram.org/bot' +
        token +
        '/getUpdates?offset=' +
        (lastUpdateId + 1) +
        '&limit=50',
      method: 'GET',
      timeout: 10,
    })

    console.log('[AVISOS_POLLING] Resposta getUpdates: status=' + res.statusCode)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = JSON.parse(res.raw)
      const updates = data.result || []
      console.log(
        '[AVISOS_POLLING] Resposta getUpdates: status=' +
          res.statusCode +
          ', updates=' +
          updates.length,
      )
      let highestId = lastUpdateId

      for (let i = 0; i < updates.length; i++) {
        const up = updates[i]
        if (up.update_id > highestId) {
          highestId = up.update_id
        }

        // Encaminhar update internamente para o processador do webhook
        try {
          $http.send({
            url:
              ($os.getenv('PB_INSTANCE_URL') || 'http://127.0.0.1:8090') +
              '/backend/v1/telegram-avisos/webhook',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(up),
            timeout: 10,
          })
        } catch (_) {}
      }

      if (highestId > lastUpdateId) {
        try {
          const col = $app.findCollectionByNameOrId('security_audit_markers')
          let rec = null
          try {
            rec = $app.findFirstRecordByData(
              'security_audit_markers',
              'marker_key',
              'telegram_avisos_last_offset',
            )
          } catch (_) {
            rec = new Record(col)
            rec.set('marker_key', 'telegram_avisos_last_offset')
          }
          rec.set('version', String(highestId))
          $app.save(rec)
        } catch (_) {}
      }
    }
  } catch (err) {
    console.log('[AVISOS_POLLING] Erro na requisição getUpdates: ' + String(err))
  }
})
