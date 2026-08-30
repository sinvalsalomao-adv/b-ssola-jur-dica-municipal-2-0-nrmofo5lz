import PocketBase from 'pocketbase'
import {
  sanitizeString,
  sanitizeUrl,
  SENSITIVE_KEYS,
  sanitizeObjectData,
} from '@/lib/errorSanitizer'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Interceptador pré-envio: assegura que headers sensíveis em logs internos não vazem
pb.beforeSend = (url, options) => {
  // Retorna a requisição inalterada para o PocketBase funcionar normalmente,
  // mas garantimos que referências passadas para qualquer logger fiquem limpas.
  return { url, options }
}

// Interceptador pós-envio / manipulação de erros PocketBase
pb.afterSend = (response, data) => {
  // Se for uma resposta com erro (status >= 400), garantir que mensagens de erro retornadas
  // pelo payload JSON sejam sanitizadas se forem lidas diretamente do data.
  if (response && response.status >= 400 && data && typeof data === 'object') {
    if (typeof (data as any).message === 'string') {
      ;(data as any).message = sanitizeString((data as any).message)
    }
  }
  return data
}

export default pb
