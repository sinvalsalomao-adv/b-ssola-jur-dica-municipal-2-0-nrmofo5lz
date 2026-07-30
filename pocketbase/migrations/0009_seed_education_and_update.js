migrate(
  (app) => {
    function tid(slug) {
      return app.findFirstRecordByData('tenants', 'slug', slug).id
    }

    var f = tid('florania'),
      t = tid('tangara'),
      p = tid('parazinho')

    // --- Seed trilhas ---
    function mkTrilha(titulo, descricao, ordem) {
      try {
        app.findFirstRecordByData('trilhas', 'titulo', titulo)
        return app.findFirstRecordByData('trilhas', 'titulo', titulo).id
      } catch (_) {}
      var col = app.findCollectionByNameOrId('trilhas')
      var r = new Record(col)
      r.set('titulo', titulo)
      r.set('descricao', descricao)
      r.set('ordem', ordem)
      app.save(r)
      return r.id
    }

    var tr1 = mkTrilha(
      'Introdução à Gestão Pública Municipal',
      'Fundamentos da administração pública municipal, estrutura governamental e princípios constitucionais.',
      1,
    )
    var tr2 = mkTrilha(
      'O DFD e a Lei 14.133/2021',
      'Entenda o Diagrama de Fluxo de Dados e a nova lei de licitações e contratos públicos.',
      2,
    )
    var tr3 = mkTrilha(
      'Uso da IA como Copiloto na Administração',
      'Aprenda como a inteligência artificial pode apoiar gestores públicos no dia a dia administrativo.',
      3,
    )

    // --- Seed aulas ---
    function mkAula(trilhaId, titulo, url, ordem) {
      try {
        app.findFirstRecordByData('aulas', 'titulo', titulo)
        return
      } catch (_) {}
      var col = app.findCollectionByNameOrId('aulas')
      var r = new Record(col)
      r.set('trilha_id', trilhaId)
      r.set('titulo', titulo)
      r.set('url_video', url)
      r.set('ordem', ordem)
      app.save(r)
    }

    mkAula(tr1, 'Aula 1: O papel do município', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1)
    mkAula(
      tr1,
      'Aula 2: Estrutura administrativa',
      'https://www.youtube.com/watch?v=9bZkp7q19f0',
      2,
    )
    mkAula(
      tr1,
      'Aula 3: Princípios constitucionais',
      'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
      3,
    )
    mkAula(tr1, 'Aula 4: Responsabilidade fiscal', 'https://www.youtube.com/watch?v=OPf0YbXqDm0', 4)

    mkAula(
      tr2,
      'Aula 1: Introdução à Lei 14.133/2021',
      'https://www.youtube.com/watch?v=RgKAFK5djSk',
      1,
    )
    mkAula(tr2, 'Aula 2: O que é um DFD', 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ', 2)
    mkAula(
      tr2,
      'Aula 3: Etapas do processo licitatório',
      'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
      3,
    )

    mkAula(tr3, 'Aula 1: Fundamentos de IA', 'https://www.youtube.com/watch?v=kffacxfA7G4', 1)
    mkAula(tr3, 'Aula 2: IA no setor público', 'https://www.youtube.com/watch?v=C0DPdy98e4c', 2)
    mkAula(tr3, 'Aula 3: Ferramentas e prompts', 'https://www.youtube.com/watch?v=ZM8ECpBuQYE', 3)
    mkAula(tr3, 'Aula 4: Ética e transparência', 'https://www.youtube.com/watch?v=aircAruvnKk', 4)
    mkAula(
      tr3,
      'Aula 5: Casos práticos na prefeitura',
      'https://www.youtube.com/watch?v=WLra5g5g1yM',
      5,
    )

    // --- Seed frases_salvas per tenant ---
    function mkFrase(texto, tipo, tenantId) {
      try {
        app.findFirstRecordByData('frases_salvas', 'texto', texto)
        return
      } catch (_) {}
      var col = app.findCollectionByNameOrId('frases_salvas')
      var r = new Record(col)
      r.set('texto', texto)
      r.set('tipo', tipo)
      r.set('tenant', tenantId)
      r.set('contador_uso', 0)
      app.save(r)
    }

    var frases = [
      'Reforma da praça central',
      'Aquisição de material de expediente',
      'Manutenção de veículos',
      'Serviços de limpeza urbana',
      'Contratação de empresa de segurança',
    ]
    for (var i = 0; i < frases.length; i++) {
      mkFrase(frases[i], 'objeto', f)
      mkFrase(frases[i], 'objeto', t)
      mkFrase(frases[i], 'objeto', p)
    }

    // --- Update existing projects with responsible_user ---
    var allUsers = app.findRecordsByFilter('users', '', 'name', 0, 0)
    var userByTenantAndName = {}
    for (var ui = 0; ui < allUsers.length; ui++) {
      var u = allUsers[ui]
      var ut = u.getString('tenant')
      var un = u.getString('name')
      var fn = un.split(' ')[0]
      userByTenantAndName[ut + '|' + fn] = u.id
      userByTenantAndName[ut + '|' + un] = u.id
    }

    var projects = app.findRecordsByFilter('projects', '', '-created', 0, 0)
    for (var pi = 0; pi < projects.length; pi++) {
      var proj = projects[pi]
      var resp = proj.getString('responsible')
      var projTenant = proj.getString('tenant')
      var userId = userByTenantAndName[projTenant + '|' + resp]
      if (userId && !proj.getString('responsible_user')) {
        proj.set('responsible_user', userId)
        if (!proj.getString('objeto')) {
          proj.set('objeto', proj.getString('title'))
        }
        if (!proj.getString('justificativa')) {
          proj.set('justificativa', 'Justificativa técnica do projeto.')
        }
        app.save(proj)
      }
    }

    // --- Update existing dfds with projeto_id ---
    var dfds = app.findRecordsByFilter('dfds', '', '-created', 0, 0)
    for (var di = 0; di < dfds.length; di++) {
      var dfd = dfds[di]
      var dfdTitle = dfd.getString('title')
      var dfdTenant = dfd.getString('tenant')
      if (!dfd.getString('projeto_id')) {
        try {
          var matchingProj = app.findFirstRecordByFilter(
            'projects',
            'tenant = "' + dfdTenant + '" && title ~ "' + dfdTitle.replace(/DFD\s*/gi, '') + '"',
          )
          dfd.set('projeto_id', matchingProj.id)
        } catch (_) {}
      }
      if (!dfd.getString('responsible_user')) {
        var dfdResp = dfd.getString('responsible')
        var dfdUserId = userByTenantAndName[dfdTenant + '|' + dfdResp]
        if (dfdUserId) dfd.set('responsible_user', dfdUserId)
      }
      app.save(dfd)
    }

    // --- Update existing notifications with mensagem, enviada_em, lida ---
    var notifs = app.findRecordsByFilter('notifications', '', '-created', 0, 0)
    for (var ni = 0; ni < notifs.length; ni++) {
      var n = notifs[ni]
      if (!n.getString('mensagem')) {
        n.set(
          'mensagem',
          'Projeto parado há ' +
            n.getString('days_stalled') +
            ' dias na coluna ' +
            n.getString('column'),
        )
      }
      n.set('lida', false)
      app.save(n)
    }

    // --- Update existing documents with projeto_id ---
    var docs = app.findRecordsByFilter('documents', '', '-created', 0, 0)
    for (var doi = 0; doi < docs.length; doi++) {
      var d = docs[doi]
      if (!d.getString('projeto_id')) {
        var docProjName = d.getString('project_name')
        var docTenant = d.getString('tenant')
        try {
          var matchingDocProj = app.findFirstRecordByFilter(
            'projects',
            'tenant = "' + docTenant + '" && title ~ "' + docProjName + '"',
          )
          d.set('projeto_id', matchingDocProj.id)
        } catch (_) {}
      }
      app.save(d)
    }
  },
  (app) => {
    var names = ['frases_salvas', 'trilhas', 'aulas', 'progresso_usuario', 'quiz_respostas']
    for (var i = 0; i < names.length; i++) {
      try {
        app.truncateCollection(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
