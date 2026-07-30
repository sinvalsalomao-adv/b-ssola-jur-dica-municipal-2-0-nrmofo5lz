routerAdd(
  'POST',
  '/backend/v1/generate-document',
  (e) => {
    const body = e.requestInfo().body || {}
    const dfdData = body.dfdData || {}
    const docType = body.docType || 'Documento'
    const customType = body.customType || ''
    const templateContent = body.templateContent || ''

    const typeLabel = docType === 'Outro' ? customType : docType

    let prompt = `Você é um especialista em direito administrativo municipal brasileiro.
Gere um documento oficial do tipo "${typeLabel}" para um processo administrativo municipal.

Dados do processo / DFD:
- Título: ${dfdData.titulo || 'N/A'}
- Objeto: ${dfdData.objeto || 'N/A'}
- Descrição: ${dfdData.descricao || 'N/A'}
- Justificativa: ${dfdData.justificativa || 'N/A'}
- Responsável: ${dfdData.responsavel || 'N/A'}
- Prazo: ${dfdData.prazo || 'N/A'}`

    if (templateContent) {
      prompt += `\n\nSiga obrigatoriamente a estrutura e modelo a seguir, preenchendo as variáveis com os dados do DFD:\n--- INÍCIO DO MODELO ---\n${templateContent}\n--- FIM DO MODELO ---`
    } else {
      prompt += `\n\nRedija o documento em linguagem formal jurídica, contendo cabeçalho institucional, preâmbulo, fundamentação legal com base na Lei 14.133/2021 (Nova Lei de Licitações) ou legislação municipal pertinente, cláusulas/artigos necessários e fecho para assinatura.`
    }

    const reply = $ai.chat({
      model: 'fast',
      messages: [
        {
          role: 'system',
          content:
            'Você é um procurador jurídico municipal especialista em redação de atos administrativos e documentos oficiais.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const content = reply.choices?.[0]?.message?.content || 'Erro ao gerar documento.'
    return e.json(200, { content })
  },
  $apis.requireAuth(),
)
