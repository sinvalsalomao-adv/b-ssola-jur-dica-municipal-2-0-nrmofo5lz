/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { initGlobalErrorSanitizer } from '@/lib/globalErrorHandler'
import { runSanitizerSecurityTests } from '@/lib/sanitizerSecurityTests'
import { runDocumentModuleTests } from '@/services/documents.test'
import { runCommentsAndParticipantsTests } from '@/services/comments.test'
import { runMembershipModuleTests } from '@/services/memberships.test'

// Ativa proteção central de sanitização de erros e logs de runtime
initGlobalErrorSanitizer()

// Verificação de segurança e integridade em desenvolvimento
if (import.meta.env.DEV) {
  const testResults = runSanitizerSecurityTests()
  if (!testResults.passed) {
    console.warn('[Security] Sanitizer security tests reported issues:', testResults.results)
  }
  const docTests = runDocumentModuleTests()
  if (!docTests.passed) {
    console.warn('[Docs] Document module tests reported issues:', docTests.results)
  }
  const commentsTests = runCommentsAndParticipantsTests()
  if (!commentsTests.passed) {
    console.warn(
      '[Comments] Comments and participants tests reported issues:',
      commentsTests.results,
    )
  }
  const membershipTests = runMembershipModuleTests()
  if (!membershipTests.passed) {
    console.warn('[Memberships] Membership tests reported issues:', membershipTests.results)
  }
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
