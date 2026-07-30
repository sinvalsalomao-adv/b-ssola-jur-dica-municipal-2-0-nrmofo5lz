export interface Lesson {
  id: string
  title: string
  youtubeId: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export interface Track {
  id: string
  title: string
  description: string
  lessons: Lesson[]
  quiz: QuizQuestion[]
}

export const MOCK_TRACKS: Track[] = [
  {
    id: 'trilha-1',
    title: 'Introdução à Gestão Pública Municipal',
    description:
      'Fundamentos da administração pública municipal, estrutura governamental e princípios constitucionais.',
    lessons: [
      { id: 'l1-1', title: 'Aula 1: O papel do município', youtubeId: 'dQw4w9WgXcQ' },
      { id: 'l1-2', title: 'Aula 2: Estrutura administrativa', youtubeId: '9bZkp7q19f0' },
      { id: 'l1-3', title: 'Aula 3: Princípios constitucionais', youtubeId: 'kJQP7kiw5Fk' },
      { id: 'l1-4', title: 'Aula 4: Responsabilidade fiscal', youtubeId: 'OPf0YbXqDm0' },
    ],
    quiz: [
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
  },
  {
    id: 'trilha-2',
    title: 'O DFD e a Lei 14.133/2021',
    description:
      'Entenda o Diagrama de Fluxo de Dados e a nova lei de licitações e contratos públicos.',
    lessons: [
      { id: 'l2-1', title: 'Aula 1: Introdução à Lei 14.133/2021', youtubeId: 'RgKAFK5djSk' },
      { id: 'l2-2', title: 'Aula 2: O que é um DFD', youtubeId: '3JZ_D3ELwOQ' },
      { id: 'l2-3', title: 'Aula 3: Etapas do processo licitatório', youtubeId: 'fJ9rUzIMcZQ' },
    ],
    quiz: [
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
  },
  {
    id: 'trilha-3',
    title: 'Uso da IA como Copiloto na Administração',
    description:
      'Aprenda como a inteligência artificial pode apoiar gestores públicos no dia a dia administrativo.',
    lessons: [
      { id: 'l3-1', title: 'Aula 1: Fundamentos de IA', youtubeId: 'kffacxfA7G4' },
      { id: 'l3-2', title: 'Aula 2: IA no setor público', youtubeId: 'C0DPdy98e4c' },
      { id: 'l3-3', title: 'Aula 3: Ferramentas e prompts', youtubeId: 'ZM8ECpBuQYE' },
      { id: 'l3-4', title: 'Aula 4: Ética e transparência', youtubeId: 'aircAruvnKk' },
      { id: 'l3-5', title: 'Aula 5: Casos práticos na prefeitura', youtubeId: 'WLra5g5g1yM' },
    ],
    quiz: [
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
  },
]

export const MOCK_USER_NAME = 'João Silva'
