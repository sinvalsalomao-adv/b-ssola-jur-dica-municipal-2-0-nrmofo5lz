import type { QuizQuestion } from '@/types/education'

export const QUIZ_DATA: Record<string, QuizQuestion[]> = {
  'Introdução à Gestão Pública Municipal': [
    {
      id: 'q1-1',
      question: 'Qual princípio constitucional exige que a administração pública siga a lei?',
      options: [
        'Princípio da Legalidade',
        'Princípio da Moralidade',
        'Princípio da Eficiência',
        'Princípio da Publicidade',
      ],
      correctIndex: 0,
    },
    {
      id: 'q1-2',
      question: 'Quantos municípios existem atualmente no Brasil (aproximadamente)?',
      options: ['3.500', '5.570', '7.200', '10.000'],
      correctIndex: 1,
    },
    {
      id: 'q1-3',
      question: 'A Lei de Responsabilidade Fiscal (LRF) corresponde a qual lei?',
      options: ['Lei 8.666/93', 'Lei 14.133/21', 'Lei Complementar 101/00', 'Lei 8.429/92'],
      correctIndex: 2,
    },
    {
      id: 'q1-4',
      question: 'Qual ente federativo é responsável pela gestão do IPTU?',
      options: ['União', 'Estado', 'Município', 'Distrito Federal'],
      correctIndex: 2,
    },
    {
      id: 'q1-5',
      question:
        'O princípio que exige que o gestor público busque o melhor resultado com menor custo é:',
      options: ['Legalidade', 'Eficiência', 'Impessoalidade', 'Moralidade'],
      correctIndex: 1,
    },
  ],
  'O DFD e a Lei 14.133/2021': [
    {
      id: 'q2-1',
      question: 'A Lei 14.133/2021 revogou qual lei de licitações anterior?',
      options: ['Lei 8.429/92', 'Lei 8.666/93', 'Lei 10.520/02', 'Lei Complementar 101/00'],
      correctIndex: 1,
    },
    {
      id: 'q2-2',
      question: 'O que significa a sigla DFD?',
      options: [
        'Documento de Formalização de Demanda',
        'Diagrama de Fluxo de Dados',
        'Documento Fiscal Digital',
        'Declaração Final de Despesa',
      ],
      correctIndex: 1,
    },
    {
      id: 'q2-3',
      question: 'Quantas modalidades de licitação existem na Lei 14.133/2021?',
      options: ['3', '4', '5', '6'],
      correctIndex: 2,
    },
    {
      id: 'q2-4',
      question: 'Qual é a modalidade licitatória para contratações de até R$ 100.000,00?',
      options: ['Concorrência', 'Tomada de Preços', 'Dispensa de Licitação', 'Concurso'],
      correctIndex: 2,
    },
    {
      id: 'q2-5',
      question: 'O critério de julgamento mais comum nas licitações é:',
      options: ['Menor preço', 'Maior lance', 'Sorteio', 'Técnica pura'],
      correctIndex: 0,
    },
  ],
  'Uso da IA como Copiloto na Administração': [
    {
      id: 'q3-1',
      question: 'O que é um "prompt" no contexto de IA generativa?',
      options: [
        'Um tipo de vírus',
        'Uma instrução dada ao modelo',
        'Um hardware especial',
        'Um código de programação',
      ],
      correctIndex: 1,
    },
    {
      id: 'q3-2',
      question: 'Qual é uma vantagem do uso de IA na administração pública?',
      options: [
        'Substituir servidores',
        'Automatizar tarefas repetitivas',
        'Eliminar auditorias',
        'Reduzir transparência',
      ],
      correctIndex: 1,
    },
    {
      id: 'q3-3',
      question: 'O que significa "alucinação" em modelos de linguagem (LLMs)?',
      options: [
        'Erro de hardware',
        'Resposta incorreta mas apresentada como factual',
        'Queda de energia',
        'Vazamento de dados',
      ],
      correctIndex: 1,
    },
    {
      id: 'q3-4',
      question: 'Qual princípio deve nortear o uso de IA no setor público?',
      options: [
        'Sigilo absoluto',
        'Transparência e responsabilidade',
        'Automação total',
        'Substituição humana',
      ],
      correctIndex: 1,
    },
    {
      id: 'q3-5',
      question: 'Um "copiloto de IA" é melhor descrito como:',
      options: [
        'Um robô autônomo',
        'Um assistente que sugere e apoia decisões',
        'Um sistema de vigilância',
        'Um substituto para gestores',
      ],
      correctIndex: 1,
    },
  ],
}
