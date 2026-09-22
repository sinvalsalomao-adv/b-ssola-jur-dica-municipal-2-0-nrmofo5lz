// Hook: Desbloqueio Manual de Usuário pelo Painel Admin & Envio Manual de Teste
// Rota segura para admin ou superadmin desbloquear manualmente usuário e registrar em auditoria

routerAdd(
  'POST',
  '/backend/v1/avisos/desbloquear-usuario',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const targetUserId = String(body.userId || '').trim()
    const targetTenantId = String(body.tenantId || body.tenant || '').trim()

    if (!targetUserId) {
      return e.json(400, { code: 400, message: 'ID do usuário é obrigatório.' })
    }

    // Validar se o requisitante é superadmin ou admin do tenant
    let isAllowed = authRole === 'superadmin'
    if (!isAllowed && targetTenantId) {
      try {
        const mems = $app.findRecordsByFilter(
          'user_memberships',
          "user = {:uid} && tenant = {:tid} && role = 'admin' && status = 'ativo'",
          '',
          1,
          0,
          { uid: auth.id, tid: targetTenantId },
        )
        if (mems.length > 0) isAllowed = true
      } catch (_) {}
    }

    if (!isAllowed) {
      return e.json(403, { code: 403, message: 'Permissão negada. Requer Administrador.' })
    }

    let targetUser = null
    try {
      targetUser = $app.findFirstRecordByData('users', 'id', targetUserId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }

    targetUser.set('status_bloqueio', 'ativo')
    $app.save(targetUser)

    // Atualizar memberships do usuário
    if (targetTenantId) {
      try {
        const mems = $app.findRecordsByFilter(
          'user_memberships',
          'user = {:uid} && tenant = {:tid}',
          '',
          5,
          0,
          { uid: targetUserId, tid: targetTenantId },
        )
        for (let i = 0; i < mems.length; i++) {
          mems[i].set('status_bloqueio', 'ativo')
          $app.save(mems[i])
        }
      } catch (_) {}
    }

    // Atualizar avisos com status bloqueado para expirado ou confirmado manualmente
    try {
      const avList = $app.findRecordsByFilter(
        'avisos',
        "user = {:uid} && status = 'bloqueado'",
        '',
        20,
        0,
        { uid: targetUserId },
      )
      for (let j = 0; j < avList.length; j++) {
        avList[j].set('status', 'confirmado')
        avList[j].set('data_hora_confirmacao', new Date().toISOString())
        $app.save(avList[j])
      }
    } catch (_) {}

    // Registrar log de auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_name', auth.getString('name') || 'Administrador')
      auditRec.set('action_type', 'Usuário desbloqueado por ciência')
      auditRec.set(
        'description',
        'Desbloqueio manual realizado pelo administrador para o usuário ' +
          (targetUser.getString('name') || targetUser.getString('email')),
      )
      auditRec.set('tenant', targetTenantId || targetUser.getString('tenant') || '')
      $app.save(auditRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: 'Usuário desbloqueado com sucesso.',
    })
  },
  $apis.requireAuth(),
)

// Rota para disparo manual imediato de aviso (útil para testes ou reenvio)

routerAdd(
  'POST',
  '/backend/v1/avisos/disparar-teste',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }
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
      return e.json(400, {
        code: 400,
        message: 'Bot do Telegram não configurado (secret TELEGRAM_AVISOS_BOT_TOKEN ausente).',
      })
    }
    const body = e.requestInfo().body || {}
    const targetUserId = String(body.userId || auth.id).trim()

    let targetUser = null
    try {
      targetUser = $app.findFirstRecordByData('users', 'id', targetUserId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }

    const tgId = targetUser.getString('telegram_id')
    if (!tgId) {
      // Teste de conectividade bot (getMe e webhook info) caso usuário ainda não tenha telegram_id
      try {
        console.log('[AVISOS_ADMIN] Executando getMe na API do Telegram...')
        const getMeRes = $http.send({
          url: 'https://api.telegram.org/bot' + token + '/getMe',
          method: 'GET',
          timeout: 10,
        })
        console.log(
          '[AVISOS_ADMIN] getMe statusCode=' + getMeRes.statusCode + ', raw=' + getMeRes.raw,
        )
        const botInfo = getMeRes.statusCode === 200 ? JSON.parse(getMeRes.raw) : null
        const botUsername = botInfo?.result?.username || 'desconhecido'

        // Criar registro na coleção avisos documentando a tentativa de teste para o usuário sem pareamento
        let avisoTesteId = ''
        try {
          const colAvisos = $app.findCollectionByNameOrId('avisos')
          const avRec = new Record(colAvisos)
          const nowYear = new Date().getFullYear()
          const seqRand = String(Math.floor(Math.random() * 900000) + 100000)
          avRec.set('codigo', 'AVS-' + nowYear + '-' + seqRand)
          avRec.set('user', targetUser.id)
          avRec.set('tenant', targetUser.getString('tenant') || '')
          avRec.set('telegram_id', '')
          avRec.set('tipo', 'diario')
          avRec.set('demandas_vinculadas', [
            {
              id: 'teste-conectividade',
              tipo: 'projeto',
              titulo: 'Teste de Ativação do Bot @' + botUsername,
              prazo: new Date().toISOString().substring(0, 10),
              dias: 0,
              urgencia: 'CRÍTICA',
              icone: '🔴',
            },
          ])
          avRec.set('qtd_demandas', 1)
          avRec.set('status', 'pendente_envio')
          avRec.set('tentativas_envio', 1)
          avRec.set(
            'ultimo_erro',
            'Usuário sem telegram_id pareado. Bot ativo e validado (@' + botUsername + ').',
          )
          $app.save(avRec)
          avisoTesteId = avRec.id
        } catch (avErr) {
          console.log('[AVISOS_ADMIN] Erro ao gravar aviso de teste: ' + String(avErr))
        }

        // Registrar tentativa no log de auditoria
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const auditRec = new Record(auditCol)
          auditRec.set('user_name', auth.getString('name') || 'Administrador')
          auditRec.set('action_type', 'Falha no envio de aviso Telegram')
          auditRec.set(
            'description',
            'Teste de envio de aviso executado: bot Telegram ativo (@' +
              botUsername +
              '), handshake getMe confirmado com sucesso. Destinatário ' +
              (targetUser.getString('name') || targetUser.getString('email')) +
              ' não possui telegram_id pareado (pendente /start + e-mail).',
          )
          auditRec.set('tenant', targetUser.getString('tenant') || '')
          $app.save(auditRec)
        } catch (audErr) {
          console.log('[AVISOS_ADMIN] Erro ao gravar auditoria: ' + String(audErr))
        }

        return e.json(200, {
          success: true,
          tested: 'connectivity_only',
          aviso_id: avisoTesteId,
          bot: botInfo?.result
            ? {
                id: botInfo.result.id,
                username: botInfo.result.username,
                first_name: botInfo.result.first_name,
              }
            : null,
          message:
            'Bot ativo e conectado com sucesso no Telegram (@' +
            (botInfo?.result?.username || 'bot') +
            ')! Porém o usuário ' +
            (targetUser.getString('name') || targetUser.getString('email')) +
            ' ainda não possui Telegram ID vinculado. Para receber mensagens diretas, basta enviar o e-mail cadastrado no chat do bot.',
        })
      } catch (connErr) {
        console.log('[AVISOS_ADMIN] Falha no getMe: ' + String(connErr))
        return e.json(400, {
          code: 400,
          message:
            'Usuário não possui Telegram ID vinculado e houve falha no handshake com a API do Telegram: ' +
            String(connErr),
        })
      }
    }

    // Criar um aviso de teste
    const now = new Date()
    const seqStr = String(Math.floor(Math.random() * 900000) + 100000)
    const codigoAviso = 'AVS-' + now.getFullYear() + '-' + seqStr
    const tenantId = targetUser.getString('tenant') || body.tenantId || ''

    let avisoRec = null
    try {
      const colAvisos = $app.findCollectionByNameOrId('avisos')
      avisoRec = new Record(colAvisos)
      avisoRec.set('codigo', codigoAviso)
      avisoRec.set('user', targetUser.id)
      avisoRec.set('tenant', tenantId)
      avisoRec.set('telegram_id', tgId)
      avisoRec.set('tipo', 'diario')
      avisoRec.set('demandas_vinculadas', [
        {
          id: 'teste-1',
          tipo: 'projeto',
          titulo: 'Demanda de Demonstração / Teste',
          prazo: now.toISOString().substring(0, 10),
          dias: 0,
          urgencia: 'CRÍTICA',
          icone: '🔴',
        },
      ])
      avisoRec.set('qtd_demandas', 1)
      avisoRec.set('status', 'pendente_envio')
      avisoRec.set('tentativas_envio', 1)
      $app.save(avisoRec)
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao gerar registro de aviso: ' + String(err) })
    }

    const msg =
      '*BÚSSOLA JURÍDICA — AVISO DE TESTE*\n\n' +
      'Olá, *' +
      (targetUser.getString('name') || 'Servidor') +
      '*!\n\n' +
      'Esta é uma mensagem de verificação da integração do módulo de Avisos e Ciência.\n\n' +
      '1. 🔴 *Demanda de Demonstração / Teste* (PROJETO)\n' +
      '   • Prazo: `' +
      now.toLocaleDateString('pt-BR') +
      '` | Urgência: *CRÍTICA*\n\n' +
      'Clique no botão abaixo para testar a confirmação de ciência:'

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

        return e.json(200, {
          success: true,
          message: 'Aviso de teste enviado com sucesso para o Telegram!',
          codigo: codigoAviso,
        })
      } else {
        avisoRec.set('ultimo_erro', 'HTTP ' + res.statusCode + ': ' + res.raw)
        $app.save(avisoRec)
        return e.json(400, {
          code: 400,
          message: 'Falha ao enviar para o Telegram: HTTP ' + res.statusCode,
        })
      }
    } catch (err) {
      return e.json(500, {
        code: 500,
        message: 'Erro ao conectar à API do Telegram: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)
