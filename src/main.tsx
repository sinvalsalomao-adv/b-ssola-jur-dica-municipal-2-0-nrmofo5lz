/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { initGlobalErrorSanitizer } from '@/lib/globalErrorHandler'
import { runSanitizerSecurityTests } from '@/lib/sanitizerSecurityTests'

// Ativa proteção central de sanitização de erros e logs de runtime
initGlobalErrorSanitizer()

// Verificação de segurança em desenvolvimento
if (import.meta.env.DEV) {
  const testResults = runSanitizerSecurityTests()
  if (!testResults.passed) {
    console.warn('[Security] Sanitizer security tests reported issues:', testResults.results)
  }
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
