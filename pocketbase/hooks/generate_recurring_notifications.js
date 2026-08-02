cronAdd('generate_recurring', '* * * * *', () => {
  let allRecurring = []
  try {
    allRecurring = $app.findRecordsByFilter(
      'notifications',
      "recorrencia != 'nenhuma' && recorrencia_ativa = true && delivery_status = 'enviada'",
      '-created',
      500,
      0,
    )
  } catch (err) {
    $app.logger().error('generate_recurring fetch failed', 'error', String(err))
    return
  }

  var now = new Date()
  var processed = {}

  for (var i = 0; i < allRecurring.length; i++) {
    var rec = allRecurring[i]
    var parentId = rec.getString('parent_notification') || rec.id
    if (processed[parentId]) continue
    processed[parentId] = true

    var deliveredAt = rec.getString('delivered_at') || rec.getString('created')
    if (!deliveredAt) continue

    var deliveredDate = new Date(deliveredAt)
    if (isNaN(deliveredDate.getTime())) continue

    var recorrencia = rec.getString('recorrencia')
    var nextDate = null

    if (recorrencia === 'diaria') {
      nextDate = new Date(deliveredDate.getTime())
      nextDate.setDate(nextDate.getDate() + 1)
    } else if (recorrencia === 'semanal') {
      var weekdayMap = {
        domingo: 0,
        segunda: 1,
        terca: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
      }
      var targetDay = weekdayMap[rec.getString('dia_semana')]
      nextDate = new Date(deliveredDate.getTime())
      if (targetDay !== undefined) {
        var currentDay = nextDate.getDay()
        var daysUntil = targetDay - currentDay
        if (daysUntil <= 0) daysUntil += 7
        nextDate.setDate(nextDate.getDate() + daysUntil)
      } else {
        nextDate.setDate(nextDate.getDate() + 7)
      }
    } else if (recorrencia === 'mensal') {
      nextDate = new Date(deliveredDate.getTime())
      var nextMonth = nextDate.getMonth() + 1
      var nextYear = nextDate.getFullYear()
      var dayOfMonth = rec.getInt('dia_mes') || deliveredDate.getDate()
      var lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
      var actualDay = dayOfMonth < lastDayOfNextMonth ? dayOfMonth : lastDayOfNextMonth
      nextDate = new Date(
        nextYear,
        nextMonth,
        actualDay,
        deliveredDate.getHours(),
        deliveredDate.getMinutes(),
      )
    }

    if (!nextDate || nextDate.getTime() > now.getTime()) continue

    try {
      var col = $app.findCollectionByNameOrId('notifications')
      var record = new Record(col)
      record.set('tenant', rec.getString('tenant'))
      record.set('mensagem', rec.getString('mensagem'))
      record.set('tipo', rec.getString('tipo'))
      record.set('person_responsible', rec.getString('person_responsible'))
      record.set('project_title', rec.getString('project_title'))
      record.set('column', rec.getString('column'))
      record.set('days_stalled', 0)
      record.set('lida', false)
      record.set('alert_date', nextDate.toISOString().split('T')[0])
      record.set('delivery_status', 'enviada')
      record.set('delivered_at', nextDate.toISOString())
      record.set('recorrencia', recorrencia)
      record.set('recorrencia_ativa', true)
      record.set('exige_confirmacao', rec.getBool('exige_confirmacao'))
      record.set('modo_confirmacao', rec.getString('modo_confirmacao'))
      record.set('video_url', rec.getString('video_url'))
      var diaSemana = rec.getString('dia_semana')
      if (diaSemana) record.set('dia_semana', diaSemana)
      var diaMes = rec.getInt('dia_mes')
      if (diaMes > 0) record.set('dia_mes', diaMes)
      record.set('parent_notification', parentId)
      $app.save(record)
    } catch (err) {
      $app
        .logger()
        .error('generate_recurring create failed', 'parent', parentId, 'error', String(err))
    }
  }
})
