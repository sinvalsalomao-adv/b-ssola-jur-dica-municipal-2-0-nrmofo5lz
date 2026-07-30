routerAdd(
  'POST',
  '/backend/v1/generate-document',
  (e) => {
    const body = e.requestInfo().body || {}
    const docType = body.docType || ''
    const customType = body.customType || ''
    const dfd = body.dfdData || {}

    if (!dfd.titulo) {
      return e.badRequestError('Dados do DFD são obrigatórios')
    }

    const typeLabel = docType === 'Outro' ? customType || 'Documento' : docType

    const systemPrompt =
      'Você é um assistente especializado em redação de documentos oficiais para prefeituras municipais brasileiras. Gere documentos formais em português brasileiro, com linguagem jurídica e administrativa adequada, seguindo as normas de formatação oficial. O documento deve ser completo e pronto para uso.'

    const userPrompt =
      'Gere um documento oficial do tipo "' +
      typeLabel +
      '" com base nos seguintes dados do DFD (Documento de Formalização de Demanda):\n\n' +
      'Título do Projeto: ' +
      (dfd.titulo || '') +
      '\n' +
      'Objeto: ' +
      (dfd.objeto || '') +
      '\n' +
      'Descrição: ' +
      (dfd.descricao || '') +
      '\n' +
      'Justificativa: ' +
      (dfd.justificativa || '') +
      '\n' +
      'Prazo: ' +
      (dfd.prazo || '') +
      '\n' +
      'Responsável: ' +
      (dfd.responsavel || '') +
      '\n\n' +
      'O documento deve seguir a estrutura e formatação apropriadas para o tipo "' +
      typeLabel +
      '", incluindo cabeçalho, corpo e fecho conforme padrões de documentos oficiais municipais.'

    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      return e.json(200, { content: reply.choices[0].message.content })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiError) {
        return e.json(502, { error: 'Falha ao gerar documento com IA' })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
