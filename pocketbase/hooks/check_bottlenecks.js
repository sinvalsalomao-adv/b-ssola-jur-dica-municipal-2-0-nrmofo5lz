cronAdd('check_bottlenecks', '0 6 * * *', () => {
  function trySendAlertEmail(smtpCfg, email, tipo, titulo, coluna, daysStalled, daysToDeadline) {
    if (!smtpCfg || !smtpCfg.server || !email) return
    try {
      var port = parseInt(smtpCfg.port) || 587
      var client = $app.newMailClient({
        host: smtpCfg.server,
        port: port,
        username: smtpCfg.username || '',
        password: smtpCfg.password || '',
        authMethod: 'LOGIN',
        tls: true,
      })
      var subject = '[Bússola Jurídica] Alerta: ' + tipo + ' - ' + titulo
      var html = '<h2>Alerta: ' + tipo + '</h2>'
      html += '<p><strong>Projeto:</strong> ' + titulo + '</p>'
      html += '<p><strong>Etapa atual:</strong> ' + coluna + '</p>'
      if (tipo === 'Gargalo') {
        html += '<p><strong>Dias parado:</strong> ' + daysStalled + '</p>'
      } else {
        html += '<p><strong>Dias restantes para o prazo:</strong> ' + daysToDeadline + '</p>'
      }
      html += '<p><strong>Tipo de alerta:</strong> ' + tipo + '</p>'
      html += '<br><p>Acesse o sistema Bússola Jurídica para mais detalhes.</p>'
      client.send({
        from: {
          address: smtpCfg.senderEmail || smtpCfg.username || '',
          name: smtpCfg.senderName || 'Bússola Jurídica',
        },
        to: [{ address: email }],
        subject: subject,
        html: html,
      })
    } catch (err) {
      $app.logger().error('email send failed', 'error', String(err), 'project', titulo)
    }
  }

  var tenants = $app.findRecordsByFilter('tenants', "status = 'ativa'", 'name', 0, 0)
  var now = new Date()
  var todayStr = now.toISOString().split('T')[0]
  var notifCol = $app.findCollectionByNameOrId('notifications')

  for (var i = 0; i < tenants.length; i++) {
    var tenant = tenants[i]
    var tenantId = tenant.id

    var stallLimits = null
    var proximityDays = 3
    var smtpConfig = null

    try {
      var tsRecords = $app.findRecordsByFilter(
        'tenant_settings',
        'tenant = {:tenantId}',
        '',
        1,
        0,
        { tenantId: tenantId },
      )
      if (tsRecords.length > 0) {
        var ts = tsRecords[0]
        var slStr = ts.getString('stall_limits')
        if (slStr) {
          try {
            stallLimits = JSON.parse(slStr)
          } catch (_) {}
        }
        var pd = ts.getInt('proximity_days')
        if (pd > 0) proximityDays = pd
        var smtpStr = ts.getString('smtp_config')
        if (smtpStr) {
          try {
            smtpConfig = JSON.parse(smtpStr)
          } catch (_) {}
        }
      }
    } catch (_) {}

    if (!stallLimits) {
      try {
        var psRecords = $app.findRecordsByFilter('platform_settings', '', '', 1, 0)
        if (psRecords.length > 0) {
          var ps = psRecords[0]
          var slStr2 = ps.getString('stall_limits')
          if (slStr2) {
            try {
              stallLimits = JSON.parse(slStr2)
            } catch (_) {}
          }
          var pd2 = ps.getInt('proximity_days')
          if (pd2 > 0) proximityDays = pd2
          if (!smtpConfig) {
            var smtpStr2 = ps.getString('smtp_config')
            if (smtpStr2) {
              try {
                smtpConfig = JSON.parse(smtpStr2)
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }

    var projects = $app.findRecordsByFilter('projects', 'tenant = {:tenantId}', '-created', 0, 0, {
      tenantId: tenantId,
    })

    for (var j = 0; j < projects.length; j++) {
      var project = projects[j]
      var coluna = project.getString('coluna_kanban') || 'Ideação'
      var titulo = project.getString('titulo') || ''
      var projetoId = project.id
      var prazo = project.getString('prazo')
      var updatedStr = project.getString('updated')

      var responsibleName = ''
      var responsibleEmail = ''
      var responsibleId = project.getString('responsible_user')
      if (responsibleId) {
        try {
          var userRec = $app.findRecordById('users', responsibleId)
          responsibleName = userRec.getString('name') || ''
          responsibleEmail = userRec.getString('email') || ''
        } catch (_) {}
      }

      if (stallLimits && updatedStr) {
        var limit = stallLimits[coluna] || 7
        var updatedDate = new Date(updatedStr)
        var diffMs = now.getTime() - updatedDate.getTime()
        var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays > limit) {
          var existingGargalo = null
          try {
            existingGargalo = $app.findFirstRecordByFilter(
              'notifications',
              "projeto_id = {:projetoId} && tipo = 'Gargalo' && lida = false",
              { projetoId: projetoId },
            )
          } catch (_) {}

          var msgGargalo =
            'Projeto "' + titulo + '" parado na coluna "' + coluna + '" há ' + diffDays + ' dias.'

          if (existingGargalo) {
            existingGargalo.set('alert_date', todayStr)
            existingGargalo.set('days_stalled', diffDays)
            existingGargalo.set('mensagem', msgGargalo)
            $app.save(existingGargalo)
          } else {
            var notif1 = new Record(notifCol)
            notif1.set('project_title', titulo)
            notif1.set('column', coluna)
            notif1.set('days_stalled', diffDays)
            notif1.set('person_responsible', responsibleName)
            notif1.set('alert_date', todayStr)
            notif1.set('tenant', tenantId)
            notif1.set('projeto_id', projetoId)
            notif1.set('mensagem', msgGargalo)
            notif1.set('lida', false)
            notif1.set('tipo', 'Gargalo')
            $app.save(notif1)
          }

          trySendAlertEmail(smtpConfig, responsibleEmail, 'Gargalo', titulo, coluna, diffDays, 0)
        }
      }

      if (prazo) {
        var deadlineDate = new Date(prazo + 'T23:59:59')
        var diffMs2 = deadlineDate.getTime() - now.getTime()
        var diffDays2 = Math.ceil(diffMs2 / (1000 * 60 * 60 * 24))

        if (diffDays2 >= 0 && diffDays2 <= proximityDays) {
          var existingFatal = null
          try {
            existingFatal = $app.findFirstRecordByFilter(
              'notifications',
              "projeto_id = {:projetoId} && tipo = 'Prazo Fatal' && lida = false",
              { projetoId: projetoId },
            )
          } catch (_) {}

          var msgFatal = 'Projeto "' + titulo + '" tem prazo vencendo em ' + diffDays2 + ' dia(s).'

          if (existingFatal) {
            existingFatal.set('alert_date', todayStr)
            existingFatal.set('mensagem', msgFatal)
            $app.save(existingFatal)
          } else {
            var notif2 = new Record(notifCol)
            notif2.set('project_title', titulo)
            notif2.set('column', coluna)
            notif2.set('person_responsible', responsibleName)
            notif2.set('alert_date', todayStr)
            notif2.set('tenant', tenantId)
            notif2.set('projeto_id', projetoId)
            notif2.set('mensagem', msgFatal)
            notif2.set('lida', false)
            notif2.set('tipo', 'Prazo Fatal')
            $app.save(notif2)
          }

          trySendAlertEmail(
            smtpConfig,
            responsibleEmail,
            'Prazo Fatal',
            titulo,
            coluna,
            0,
            diffDays2,
          )
        }
      }
    }
  }

  $app.logger().info('check_bottlenecks cron executed', 'tenants_checked', tenants.length)
})
