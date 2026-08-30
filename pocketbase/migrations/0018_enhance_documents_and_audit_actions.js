migrate(
  (app) => {
    const docsCol = app.findCollectionByNameOrId('documents')
    const uid = '_pb_users_auth_'
    const pid = app.findCollectionByNameOrId('projects').id

    const ALLOWED_MIMES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
    ]

    const CATEGORIAS = [
      'Edital / Termo de Referência',
      'Parecer Jurídico',
      'Contrato / Aditivo',
      'Nota de Empenho / Fiscal',
      'DFD / Estudo Técnico Preliminar',
      'Publicação / Diário Oficial',
      'Planilha Orçamentária',
      'Outro',
    ]

    const ETAPAS = [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ]

    // 1. Atualizar campo de arquivo existente em documents com mimeTypes expandidos e tamanho de 20MB (20971520 bytes)
    docsCol.fields.add(
      new FileField({
        name: 'file',
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: ALLOWED_MIMES,
      }),
    )

    // 2. Adicionar novos campos aditivos em documents
    if (!docsCol.fields.getByName('categoria')) {
      docsCol.fields.add(
        new SelectField({
          name: 'categoria',
          values: CATEGORIAS,
          maxSelect: 1,
        }),
      )
    }

    if (!docsCol.fields.getByName('etapa')) {
      docsCol.fields.add(
        new SelectField({
          name: 'etapa',
          values: ETAPAS,
          maxSelect: 1,
        }),
      )
    }

    if (!docsCol.fields.getByName('descricao')) {
      docsCol.fields.add(
        new TextField({
          name: 'descricao',
        }),
      )
    }

    if (!docsCol.fields.getByName('versao')) {
      docsCol.fields.add(
        new NumberField({
          name: 'versao',
          onlyInt: true,
        }),
      )
    }

    if (!docsCol.fields.getByName('parent_document_id')) {
      docsCol.fields.add(
        new RelationField({
          name: 'parent_document_id',
          collectionId: docsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    if (!docsCol.fields.getByName('is_latest_version')) {
      docsCol.fields.add(
        new BoolField({
          name: 'is_latest_version',
        }),
      )
    }

    if (!docsCol.fields.getByName('arquivado')) {
      docsCol.fields.add(
        new BoolField({
          name: 'arquivado',
        }),
      )
    }

    if (!docsCol.fields.getByName('user_id')) {
      docsCol.fields.add(
        new RelationField({
          name: 'user_id',
          collectionId: uid,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    // Regras de acesso server-side (isolamento rigoroso por tenant e autenticação)
    const rule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    docsCol.listRule = rule
    docsCol.viewRule = rule
    docsCol.createRule = rule
    docsCol.updateRule = rule
    docsCol.deleteRule = rule

    docsCol.addIndex('idx_documents_arquivado', false, 'arquivado', '')
    docsCol.addIndex('idx_documents_parent', false, 'parent_document_id', '')
    docsCol.addIndex('idx_documents_latest', false, 'is_latest_version', '')

    app.save(docsCol)

    // Preencher dados existentes com valores padrão de migração
    app
      .db()
      .newQuery('UPDATE documents SET versao = 1 WHERE versao IS NULL OR versao = 0')
      .execute()

    app
      .db()
      .newQuery('UPDATE documents SET is_latest_version = 1 WHERE is_latest_version IS NULL')
      .execute()

    app.db().newQuery('UPDATE documents SET arquivado = 0 WHERE arquivado IS NULL').execute()

    // 3. Atualizar audit_logs para permitir novas ações de auditoria de documentos
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    auditCol.fields.add(
      new SelectField({
        name: 'action_type',
        values: [
          'Criou card',
          'Moveu card',
          'Editou card',
          'Adicionou documento',
          'Nova versão documento',
          'Arquivou documento',
          'Restaurou documento',
          'Visualizou documento',
          'Baixou documento',
        ],
        maxSelect: 1,
      }),
    )
    app.save(auditCol)
  },
  (app) => {
    try {
      const docsCol = app.findCollectionByNameOrId('documents')
      const removeList = [
        'categoria',
        'etapa',
        'descricao',
        'versao',
        'parent_document_id',
        'is_latest_version',
        'arquivado',
        'user_id',
      ]
      for (let i = 0; i < removeList.length; i++) {
        try {
          docsCol.fields.removeByName(removeList[i])
        } catch (_) {}
      }
      try {
        docsCol.removeIndex('idx_documents_arquivado')
        docsCol.removeIndex('idx_documents_parent')
        docsCol.removeIndex('idx_documents_latest')
      } catch (_) {}
      app.save(docsCol)
    } catch (_) {}
  },
)
