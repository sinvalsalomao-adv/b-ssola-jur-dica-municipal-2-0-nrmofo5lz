# Checkpoints do Projeto - Bússola Jurídica Municipal 2.0

## Checkpoint 1: Versão Base Pré-Sanitização

- **Data/Hora:** 2025-05-18
- **Propósito:** Ponto de restauração identificado antes da implementação da sanitização de erros sensíveis.

## Checkpoint 2: Ponto de Restauração Pré-Implementação da Aba "Documentos" no Painel Lateral

- **Data/Hora:** 2025-05-19
- **Versão:** 0.0.48
- **Módulo:** Bússola (Kanban e Detalhes do Projeto)
- **Estado preservado:**
  - Login e autenticação multi-tenant
  - Menu lateral e rotas completas
  - Quadro Kanban e filtros por município e etapa
  - Exportação de relatórios em PDF
  - Abas atuais do painel lateral (Detalhes, Checklist, Histórico)
  - Coleções existentes no PocketBase e integridade dos dados
- **Propósito:** Ponto de restauração antes de adicionar a migração aditiva para a coleção `documents` (versões, arquivamento, categoria, etapa, descrição) e criar a aba "Documentos" no painel lateral de Detalhes do Projeto.
