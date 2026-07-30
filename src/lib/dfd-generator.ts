export function generateJustificativa(title: string, objeto: string, descricao: string): string {
  const currentDate = new Date().toLocaleDateString('pt-BR')

  return `JUSTIFICATIVA TÉCNICA DA CONTRATAÇÃO

1. DO OBJETO
O presente Documento de Formalização de Demanda (DFD) tem por objeto ${objeto || 'a contratação ora descrita'}, no âmbito do projeto "${title || 'não especificado'}".

2. DA JUSTIFICATIVA
${descricao || 'A presente demanda decorre da necessidade de atendimento aos interesses da administração pública municipal, visando garantir a continuidade e a qualidade dos serviços prestados à população.'}

3. FUNDAMENTO LEGAL
A presente formalização encontra respaldo na Lei nº 14.133, de 1º de abril de 2021 (Nova Lei de Licitações e Contratos Administrativos), em especial:
- Art. 12, que dispõe sobre a fase de planejamento das contratações;
- Art. 15, que trata do Documento de Formalização de Demanda como etapa inicial do processo de planejamento;
- Art. 18, que estabelece a necessidade de justificação técnica para a contratação.

4. DA NECESSIDADE E OPORTUNIDADE
A contratação é necessária para garantir a continuidade dos serviços públicos prestados à população, sendo considerada prioritária face às demandas do município. A oportunidade é pertinente considerando o cronograma de execução das atividades administrativas e a disponibilidade orçamentária.

5. DA VIABILIDADE
A viabilidade da contratação está assegurada pela previsão no Plano Plurianual (PPA) e na Lei Orçamentária Anual (LOA) do município, em conformidade com o princípio do planejamento previsto no art. 5º da referida lei.

6. DOS PRINCÍPIOS
Atende-se aos princípios constitucionais da legalidade, impessoalidade, moralidade, publicidade e eficiência, bem como aos princípios específicos da Lei nº 14.133/2021: amplitude da competição, padronização, sustentabilidade e segregação de funções.

Florânia/RN, ${currentDate}.`
}
