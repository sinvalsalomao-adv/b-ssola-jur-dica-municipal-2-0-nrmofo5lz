migrate(
  (app) => {
    // Atualiza todos os usuários existentes definindo emailVisibility = true
    // para que o PocketBase retorne o campo email nas respostas de list/view da API.
    app.db().newQuery('UPDATE users SET emailVisibility = true;').execute()
  },
  (app) => {
    // Reversão opcional (não estritamente necessária pois emailVisibility true é o estado desejado)
  },
)
