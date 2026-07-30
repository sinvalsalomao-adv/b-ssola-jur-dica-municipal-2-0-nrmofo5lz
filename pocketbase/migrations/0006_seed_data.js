migrate(
  (app) => {
    function tid(slug) {
      return app.findFirstRecordByData('tenants', 'slug', slug).id
    }
    function mk(colName, data) {
      var col = app.findCollectionByNameOrId(colName)
      var r = new Record(col)
      var k = Object.keys(data)
      for (var i = 0; i < k.length; i++) r.set(k[i], data[k[i]])
      app.save(r)
    }

    var f = tid('florania'),
      t = tid('tangara'),
      p = tid('parazinho')

    mk('projects', {
      title: 'Reforma do Paço Municipal',
      description: 'Restauração da fachada histórica',
      responsible: 'Ana',
      deadline: '2025-04-15',
      priority: 'Alta',
      column: 'Execução',
      tenant: f,
    })
    mk('projects', {
      title: 'Implantação de Coleta Seletiva',
      description: 'Plano municipal de resíduos',
      responsible: 'Carlos',
      deadline: '2025-05-01',
      priority: 'Média',
      column: 'Procedimentos Internos',
      tenant: f,
    })
    mk('projects', {
      title: 'Portal da Transparência Jurídica',
      description: 'Sistema público de consulta',
      responsible: 'Mariana',
      deadline: '2025-03-10',
      priority: 'Alta',
      column: 'Elaborar DFD',
      tenant: f,
    })
    mk('projects', {
      title: 'Revisão do Código de Posturas',
      description: 'Atualização legislativa',
      responsible: 'Pedro',
      deadline: '2025-07-20',
      priority: 'Baixa',
      column: 'Ideação',
      tenant: f,
    })
    mk('projects', {
      title: 'Campanha de Conscientização Tributária',
      description: 'Divulgação IPTU',
      responsible: 'Sofia',
      deadline: '2025-03-30',
      priority: 'Média',
      column: 'Marketing',
      tenant: f,
    })
    mk('projects', {
      title: 'Asfaltamento de Ruas Centrais',
      description: 'Pavimentação asfáltica',
      responsible: 'Mariana',
      deadline: '2025-03-05',
      priority: 'Alta',
      column: 'Projeto Executivo',
      tenant: t,
    })
    mk('projects', {
      title: 'Digitalização de Processos',
      description: 'Transição para sistema eletrônico',
      responsible: 'Pedro',
      deadline: '2025-06-10',
      priority: 'Baixa',
      column: 'Ideação',
      tenant: t,
    })
    mk('projects', {
      title: 'Reforma da UBS',
      description: 'Ampliação setor urgência',
      responsible: 'Ana',
      deadline: '2025-02-25',
      priority: 'Alta',
      column: 'Prestação de Contas',
      tenant: t,
    })
    mk('projects', {
      title: 'Iluminação LED',
      description: 'Substituição de lâmpadas',
      responsible: 'Carlos',
      deadline: '2025-03-12',
      priority: 'Média',
      column: 'Elaborar DFD',
      tenant: t,
    })
    mk('projects', {
      title: 'Festival Cultural',
      description: 'Estratégia de comunicação',
      responsible: 'Sofia',
      deadline: '2025-03-28',
      priority: 'Baixa',
      column: 'Marketing',
      tenant: t,
    })
    mk('projects', {
      title: 'Construção da Praça Central',
      description: 'Playground e paisagismo',
      responsible: 'Sofia',
      deadline: '2025-02-28',
      priority: 'Alta',
      column: 'Prestação de Contas',
      tenant: p,
    })
    mk('projects', {
      title: 'Aquisição de Ambulância',
      description: 'Veículo UTI móvel',
      responsible: 'Carlos',
      deadline: '2025-03-08',
      priority: 'Alta',
      column: 'Procedimentos Internos',
      tenant: p,
    })
    mk('projects', {
      title: 'Saneamento Bairro Alto',
      description: 'Rede de esgoto',
      responsible: 'Mariana',
      deadline: '2025-04-30',
      priority: 'Média',
      column: 'Projeto Executivo',
      tenant: p,
    })
    mk('projects', {
      title: 'Regularização Fundiária',
      description: 'REURB',
      responsible: 'Pedro',
      deadline: '2025-05-15',
      priority: 'Alta',
      column: 'Execução',
      tenant: p,
    })
    mk('projects', {
      title: 'Totens de Autoatendimento',
      description: 'Atendimento ao cidadão',
      responsible: 'Sofia',
      deadline: '2025-08-01',
      priority: 'Média',
      column: 'Ideação',
      tenant: p,
    })
    mk('projects', {
      title: 'Curso de Capacitação',
      description: 'Treinamento Lei 14.133',
      responsible: 'Ana',
      deadline: '2025-03-01',
      priority: 'Baixa',
      column: 'Marketing',
      tenant: p,
    })

    var today = new Date()
    function dOff(off) {
      var d = new Date(today)
      d.setDate(d.getDate() + off)
      return d.toISOString().split('T')[0]
    }

    mk('notifications', {
      project_title: 'Reforma do Paço Municipal',
      column: 'Execução',
      days_stalled: 12,
      person_responsible: 'Ana',
      alert_date: dOff(-2),
      alert_type: 'Gargalo',
      tenant: f,
    })
    mk('notifications', {
      project_title: 'Portal da Transparência',
      column: 'Elaborar DFD',
      days_stalled: 6,
      person_responsible: 'Mariana',
      alert_date: dOff(0),
      alert_type: 'Gargalo',
      tenant: f,
    })
    mk('notifications', {
      project_title: 'Asfaltamento de Ruas',
      column: 'Projeto Executivo',
      days_stalled: 6,
      person_responsible: 'Mariana',
      alert_date: dOff(0),
      alert_type: 'Gargalo',
      tenant: t,
    })
    mk('notifications', {
      project_title: 'Aquisição de Ambulância',
      column: 'Procedimentos Internos',
      days_stalled: 8,
      person_responsible: 'Carlos',
      alert_date: dOff(-1),
      alert_type: 'Prazo Fatal',
      tenant: p,
    })
    mk('notifications', {
      project_title: 'Construção da Praça',
      column: 'Prestação de Contas',
      days_stalled: 15,
      person_responsible: 'Sofia',
      alert_date: dOff(-3),
      alert_type: 'Prazo Fatal',
      tenant: p,
    })

    mk('agenda_events', {
      day: dOff(-5),
      card_title: 'Reforma do Paço Municipal',
      card_id: '',
      color_code: 'red',
      responsible: 'Ana',
      column: 'Execução',
      tenant: f,
    })
    mk('agenda_events', {
      day: dOff(-1),
      card_title: 'Aquisição de Ambulância',
      card_id: '',
      color_code: 'yellow',
      responsible: 'Carlos',
      column: 'Procedimentos Internos',
      tenant: p,
    })
    mk('agenda_events', {
      day: dOff(2),
      card_title: 'Asfaltamento de Ruas',
      card_id: '',
      color_code: 'green',
      responsible: 'Mariana',
      column: 'Projeto Executivo',
      tenant: t,
    })
    mk('agenda_events', {
      day: dOff(5),
      card_title: 'Portal da Transparência',
      card_id: '',
      color_code: 'green',
      responsible: 'Mariana',
      column: 'Elaborar DFD',
      tenant: f,
    })
    mk('agenda_events', {
      day: dOff(-2),
      card_title: 'Reforma da UBS',
      card_id: '',
      color_code: 'red',
      responsible: 'Ana',
      column: 'Prestação de Contas',
      tenant: t,
    })
    mk('agenda_events', {
      day: dOff(10),
      card_title: 'Regularização Fundiária',
      card_id: '',
      color_code: 'green',
      responsible: 'Pedro',
      column: 'Execução',
      tenant: p,
    })

    mk('documents', {
      file_name: 'termo-referencia-reforma-paco.pdf',
      file_size: 250880,
      project_name: 'Reforma do Paço Municipal',
      upload_date: dOff(-5),
      uploaded_by: 'Ana',
      pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      tenant: f,
    })
    mk('documents', {
      file_name: 'edital-licitacao-ambulancia.pdf',
      file_size: 524288,
      project_name: 'Aquisição de Ambulância',
      upload_date: dOff(-8),
      uploaded_by: 'Carlos',
      pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      tenant: p,
    })
    mk('documents', {
      file_name: 'projeto-engenharia-asfaltamento.pdf',
      file_size: 1258291,
      project_name: 'Asfaltamento de Ruas Centrais',
      upload_date: dOff(-3),
      uploaded_by: 'Mariana',
      pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      tenant: t,
    })

    function dtOff(off, h, m) {
      var d = new Date(today)
      d.setDate(d.getDate() + off)
      d.setHours(h, m, 0, 0)
      return d.toISOString()
    }
    mk('audit_logs', {
      user_name: 'Ana',
      action_type: 'Criou card',
      description: 'Card criado na coluna Execução',
      project_title: 'Reforma do Paço Municipal',
      tenant: f,
    })
    mk('audit_logs', {
      user_name: 'Carlos',
      action_type: 'Moveu card',
      description: 'Movido de Elaborar DFD para Procedimentos Internos',
      project_title: 'Aquisição de Ambulância',
      tenant: p,
    })
    mk('audit_logs', {
      user_name: 'Mariana',
      action_type: 'Editou card',
      description: 'Prazo atualizado',
      project_title: 'Asfaltamento de Ruas',
      tenant: t,
    })
    mk('audit_logs', {
      user_name: 'Pedro',
      action_type: 'Criou card',
      description: 'Card criado na coluna Ideação',
      project_title: 'Regularização Fundiária',
      tenant: p,
    })
    mk('audit_logs', {
      user_name: 'Sofia',
      action_type: 'Moveu card',
      description: 'Movido para Marketing',
      project_title: 'Festival Cultural',
      tenant: t,
    })

    mk('dfds', {
      title: 'DFD Reforma do Paço Municipal',
      objeto: 'Reforma e restauração',
      descricao: 'Restauração da fachada histórica',
      justificativa: 'Necessidade de manutenção',
      responsible: 'Ana',
      deadline: '2025-04-15',
      status: 'Finalizado',
      tenant: f,
    })
    mk('dfds', {
      title: 'DFD Aquisição de Ambulância',
      objeto: 'Compra de veículo',
      descricao: 'Veículo UTI móvel',
      justificativa: 'Atendimento à saúde',
      responsible: 'Carlos',
      deadline: '2025-03-08',
      status: 'Rascunho',
      tenant: p,
    })
    mk('dfds', {
      title: 'DFD Asfaltamento',
      objeto: 'Pavimentação',
      descricao: 'Pavimentação asfáltica',
      justificativa: 'Melhoria de infraestrutura',
      responsible: 'Mariana',
      deadline: '2025-03-05',
      status: 'Finalizado',
      tenant: t,
    })

    var psCol = app.findCollectionByNameOrId('platform_settings')
    var ps = new Record(psCol)
    ps.set(
      'stall_limits',
      JSON.stringify({
        Ideação: 5,
        'Projeto Executivo': 5,
        'Elaborar DFD': 3,
        'Procedimentos Internos': 7,
        Execução: 10,
        'Prestação de Contas': 5,
        Marketing: 3,
      }),
    )
    ps.set(
      'smtp_config',
      JSON.stringify({
        server: 'smtp.prefeitura.gov.br',
        port: '587',
        username: 'notificacoes@bussola.gov.br',
        password: '',
        senderEmail: 'notificacoes@bussola.gov.br',
      }),
    )
    ps.set('ai_api_key', 'sk-proj-placeholder')
    ps.set('proximity_days', 3)
    app.save(ps)
  },
  (app) => {
    ;[
      'projects',
      'notifications',
      'agenda_events',
      'documents',
      'audit_logs',
      'dfds',
      'platform_settings',
    ].forEach(function (n) {
      try {
        app.truncateCollection(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
  },
)
