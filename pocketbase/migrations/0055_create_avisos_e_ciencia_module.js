migrate(
  (app) => {
    // 1. Obter IDs das coleções existentes necessárias para relações
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const usersCol = app.findCollectionByNameOrId('users')

    // 2. Adicionar novos campos à coleção users:
    // telegram_id (text), receber_avisos_telegram (bool), status_bloqueio (select: ativo, bloqueado_ciencia),
    // telegram_pairing_code (text)
    if (!usersCol.fields.getByName('telegram_id')) {
      usersCol.fields.add(new TextField({ name: 'telegram_id' }))
    }
    if (!usersCol.fields.getByName('receber_avisos_telegram')) {
      usersCol.fields.add(new BoolField({ name: 'receber_avisos_telegram' }))
    }
    if (!usersCol.fields.getByName('status_bloqueio')) {
      usersCol.fields.add(
        new SelectField({
          name: 'status_bloqueio',
          values: ['ativo', 'bloqueado_ciencia'],
          maxSelect: 1,
        }),
      )
    }
    if (!usersCol.fields.getByName('telegram_pairing_code')) {
      usersCol.fields.add(new TextField({ name: 'telegram_pairing_code' }))
    }
    try {
      usersCol.addIndex('idx_users_telegram_id', false, 'telegram_id', '')
    } catch (_) {}
    try {
      usersCol.addIndex('idx_users_status_bloqueio', false, 'status_bloqueio', '')
    } catch (_) {}
    app.save(usersCol)

    // 3. Adicionar campos em user_memberships para rastreio por tenant:
    const memCol = app.findCollectionByNameOrId('user_memberships')
    if (!memCol.fields.getByName('receber_avisos_telegram')) {
      memCol.fields.add(new BoolField({ name: 'receber_avisos_telegram' }))
    }
    if (!memCol.fields.getByName('status_bloqueio')) {
      memCol.fields.add(
        new SelectField({
          name: 'status_bloqueio',
          values: ['ativo', 'bloqueado_ciencia'],
          maxSelect: 1,
        }),
      )
    }
    app.save(memCol)

    // 4. Criar coleção feriados (tenant, data, descricao)
    // Se tenant for nulo/vazio pode ser feriado nacional padrão do sistema
    const feriadosCollection = new Collection({
      name: 'feriados',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = '' || tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      viewRule:
        "@request.auth.id != '' && (tenant = '' || tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      createRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      updateRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      deleteRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      fields: [
        { name: 'tenant', type: 'relation', collectionId: tenantsId, maxSelect: 1 },
        { name: 'data', type: 'date', required: true },
        { name: 'descricao', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_feriados_tenant ON feriados (tenant)',
        'CREATE INDEX idx_feriados_data ON feriados (data)',
      ],
    })
    app.save(feriadosCollection)

    // 5. Criar coleção avisos_config (por tenant)
    const avisosConfigCollection = new Collection({
      name: 'avisos_config',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      viewRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      createRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      updateRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      deleteRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      fields: [
        { name: 'tenant', type: 'relation', required: true, collectionId: tenantsId, maxSelect: 1 },
        { name: 'horario_aviso_diario', type: 'text' }, // padrão '08:00'
        { name: 'dias_antecedencia', type: 'number', onlyInt: true }, // padrão 2
        { name: 'horario_limite_confirmacao', type: 'text' }, // padrão '12:00'
        { name: 'intervalo_lembrete_horas', type: 'number', onlyInt: true }, // padrão 3
        { name: 'max_lembretes', type: 'number', onlyInt: true }, // padrão 2
        { name: 'bloqueio_automatico', type: 'bool' }, // padrão true
        { name: 'exigir_confirmacao_sem_demandas', type: 'bool' }, // padrão false
        { name: 'alerta_extraordinario_critica_vencida', type: 'bool' }, // padrão true
        {
          name: 'tipo_contagem_dias',
          type: 'select',
          values: ['dias_uteis', 'dias_corridos'],
          maxSelect: 1,
        }, // padrão 'dias_uteis'
        { name: 'faixas_urgencia', type: 'json' }, // faixas configuráveis
        { name: 'mensagem_padrao', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_avisos_config_tenant ON avisos_config (tenant)'],
    })
    app.save(avisosConfigCollection)

    // 6. Criar coleção avisos (identificador único sequencial por ano: AVS-2026-000001)
    const avisosCollection = new Collection({
      name: 'avisos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      viewRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      createRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      updateRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      fields: [
        { name: 'codigo', type: 'text', required: true }, // AVS-2026-000001
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'tenant', type: 'relation', required: true, collectionId: tenantsId, maxSelect: 1 },
        { name: 'telegram_id', type: 'text' },
        { name: 'data_hora_envio', type: 'date' },
        {
          name: 'tipo',
          type: 'select',
          values: ['diario', 'lembrete', 'alerta_extraordinario'],
          maxSelect: 1,
        },
        { name: 'demandas_vinculadas', type: 'json' }, // lista de [{ id, tipo: 'projeto'|'dfd', titulo, prazo, urgencia }]
        { name: 'qtd_demandas', type: 'number', onlyInt: true },
        {
          name: 'status',
          type: 'select',
          values: [
            'pendente_envio',
            'enviado',
            'entregue',
            'aguardando_confirmacao',
            'confirmado',
            'expirado',
            'bloqueado',
          ],
          maxSelect: 1,
        },
        { name: 'data_hora_confirmacao', type: 'date' },
        { name: 'tentativas_envio', type: 'number', onlyInt: true },
        { name: 'ultimo_erro', type: 'text' },
        { name: 'telegram_message_id', type: 'text' },
        { name: 'parent_aviso', type: 'text' }, // se for lembrete, ID do aviso original
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_avisos_codigo ON avisos (codigo)',
        'CREATE INDEX idx_avisos_tenant ON avisos (tenant)',
        'CREATE INDEX idx_avisos_user ON avisos (user)',
        'CREATE INDEX idx_avisos_telegram_id ON avisos (telegram_id)',
        'CREATE INDEX idx_avisos_status ON avisos (status)',
        'CREATE INDEX idx_avisos_tipo ON avisos (tipo)',
      ],
    })
    app.save(avisosCollection)

    // 7. Atualizar audit_logs action_type com as novas ações do módulo de avisos e ciência
    const auditLogsCol = app.findCollectionByNameOrId('audit_logs')
    const actionTypeField = auditLogsCol.fields.getByName('action_type')
    if (actionTypeField && actionTypeField.values) {
      const neededTypes = [
        'Aviso Telegram enviado',
        'Lembrete Telegram enviado',
        'Alerta extraordinário enviado',
        'Confirmação de ciência registrada',
        'Usuário bloqueado por ciência',
        'Usuário desbloqueado por ciência',
        'Telegram pareado com sucesso',
        'Falha no envio de aviso Telegram',
      ]
      let changed = false
      const curValues = actionTypeField.values.slice()
      for (let j = 0; j < neededTypes.length; j++) {
        if (curValues.indexOf(neededTypes[j]) === -1) {
          curValues.push(neededTypes[j])
          changed = true
        }
      }
      if (changed) {
        actionTypeField.values = curValues
        app.save(auditLogsCol)
      }
    }

    // 8. Inicializar configurações padrão de avisos para todos os tenants existentes
    try {
      const tenantsList = app.findRecordsByFilter('tenants', '', '', 100, 0)
      for (let t = 0; t < tenantsList.length; t++) {
        const tn = tenantsList[t]
        try {
          app.findFirstRecordByData('avisos_config', 'tenant', tn.id)
        } catch (_) {
          const cfg = new Record(avisosConfigCollection)
          cfg.set('tenant', tn.id)
          cfg.set('horario_aviso_diario', '08:00')
          cfg.set('dias_antecedencia', 2)
          cfg.set('horario_limite_confirmacao', '12:00')
          cfg.set('intervalo_lembrete_horas', 3)
          cfg.set('max_lembretes', 2)
          cfg.set('bloqueio_automatico', true)
          cfg.set('exigir_confirmacao_sem_demandas', false)
          cfg.set('alerta_extraordinario_critica_vencida', true)
          cfg.set('tipo_contagem_dias', 'dias_uteis')
          cfg.set('faixas_urgencia', {
            baixa_dias: 5,
            media_dias_min: 3,
            media_dias_max: 5,
            alta_dias_min: 1,
            alta_dias_max: 2,
            critica_dias: 0,
          })
          cfg.set('mensagem_padrao', 'BÚSSOLA JURÍDICA — AVISO DIÁRIO')
          cfg.set('ativo', true)
          app.save(cfg)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const a = app.findCollectionByNameOrId('avisos')
      if (a) app.delete(a)
    } catch (_) {}
    try {
      const ac = app.findCollectionByNameOrId('avisos_config')
      if (ac) app.delete(ac)
    } catch (_) {}
    try {
      const f = app.findCollectionByNameOrId('feriados')
      if (f) app.delete(f)
    } catch (_) {}
  },
)
