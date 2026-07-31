routerAdd('GET', '/backend/v1/organizacoes-public', (e) => {
  var records = $app.findRecordsByFilter('tenants', "status = 'ativa'", 'name', 0, 0)
  var result = []
  for (var i = 0; i < records.length; i++) {
    var record = records[i]
    var logo = record.getString('logo')
    var brasao = null
    if (logo) {
      brasao = '/api/files/tenants/' + record.id + '/' + logo
    }
    result.push({
      id: record.id,
      nome: record.getString('name'),
      slug: record.getString('slug'),
      brasao: brasao,
      cidade: record.getString('cidade'),
      estado: record.getString('estado'),
    })
  }
  return e.json(200, result)
})

routerAdd('GET', '/backend/v1/organizacoes-public/{slug}', (e) => {
  var slug = e.request.pathValue('slug')
  var record
  try {
    record = $app.findFirstRecordByData('tenants', 'slug', slug)
  } catch (_) {
    return e.json(404, { error: 'Organização não encontrada' })
  }
  if (record.getString('status') !== 'ativa') {
    return e.json(404, { error: 'Organização não encontrada' })
  }
  var logo = record.getString('logo')
  var brasao = null
  if (logo) {
    brasao = '/api/files/tenants/' + record.id + '/' + logo
  }
  return e.json(200, {
    id: record.id,
    nome: record.getString('name'),
    slug: record.getString('slug'),
    brasao: brasao,
    cidade: record.getString('cidade'),
    estado: record.getString('estado'),
  })
})
