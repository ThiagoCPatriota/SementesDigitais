const baseQuestions = [
  {
    area: 'Matemática',
    year: 2023,
    context: 'Em uma ação comunitária, uma escola arrecadou 240 kg de alimentos. Do total, 35% foram destinados a famílias do bairro A, 40% ao bairro B e o restante ao bairro C.',
    statement: 'Quantos quilogramas de alimentos foram destinados ao bairro C?',
    alternatives: [
      { letter: 'A', text: '48 kg' },
      { letter: 'B', text: '54 kg' },
      { letter: 'C', text: '60 kg' },
      { letter: 'D', text: '72 kg' },
      { letter: 'E', text: '84 kg' }
    ],
    correctAlternative: 'C'
  },
  {
    area: 'Linguagens',
    year: 2022,
    context: 'Em uma campanha escolar, o cartaz principal dizia: “Ler abre caminhos, amplia mundos e fortalece escolhas”.',
    statement: 'A principal função da linguagem presente na frase é',
    alternatives: [
      { letter: 'A', text: 'informar um dado estatístico.' },
      { letter: 'B', text: 'convencer o leitor sobre o valor da leitura.' },
      { letter: 'C', text: 'narrar uma experiência pessoal.' },
      { letter: 'D', text: 'descrever uma paisagem escolar.' },
      { letter: 'E', text: 'explicar uma regra gramatical.' }
    ],
    correctAlternative: 'B'
  },
  {
    area: 'Ciências Humanas',
    year: 2021,
    context: 'A cidadania envolve participação social, acesso a direitos e responsabilidade coletiva na construção de soluções para problemas públicos.',
    statement: 'Uma atitude que fortalece a cidadania no ambiente escolar é',
    alternatives: [
      { letter: 'A', text: 'ignorar debates coletivos.' },
      { letter: 'B', text: 'delegar todas as decisões a terceiros.' },
      { letter: 'C', text: 'participar de grêmios, conselhos e ações comunitárias.' },
      { letter: 'D', text: 'evitar o diálogo entre estudantes e professores.' },
      { letter: 'E', text: 'valorizar apenas interesses individuais.' }
    ],
    correctAlternative: 'C'
  },
  {
    area: 'Ciências da Natureza',
    year: 2020,
    context: 'A economia de energia elétrica depende de hábitos cotidianos, eficiência dos equipamentos e uso consciente dos recursos naturais.',
    statement: 'Uma medida que contribui diretamente para reduzir o consumo de energia é',
    alternatives: [
      { letter: 'A', text: 'deixar aparelhos em modo stand-by continuamente.' },
      { letter: 'B', text: 'utilizar lâmpadas de maior consumo.' },
      { letter: 'C', text: 'manter luzes acesas em ambientes vazios.' },
      { letter: 'D', text: 'substituir equipamentos antigos por modelos mais eficientes.' },
      { letter: 'E', text: 'aumentar o tempo de uso de chuveiros elétricos.' }
    ],
    correctAlternative: 'D'
  },
  {
    area: 'Matemática',
    year: 2019,
    context: 'Um curso preparatório recebeu 80 inscrições em uma semana. Na semana seguinte, o número de inscrições aumentou 25%.',
    statement: 'O total de inscrições na segunda semana foi',
    alternatives: [
      { letter: 'A', text: '90' },
      { letter: 'B', text: '95' },
      { letter: 'C', text: '100' },
      { letter: 'D', text: '105' },
      { letter: 'E', text: '110' }
    ],
    correctAlternative: 'C'
  },
  {
    area: 'Linguagens',
    year: 2018,
    context: 'Em uma notícia, o título afirma: “Projeto de tecnologia aproxima jovens da programação”.',
    statement: 'O gênero notícia tem como característica predominante',
    alternatives: [
      { letter: 'A', text: 'apresentar fatos de interesse público.' },
      { letter: 'B', text: 'defender uma tese com linguagem literária.' },
      { letter: 'C', text: 'criar personagens fictícios.' },
      { letter: 'D', text: 'ensinar uma receita culinária.' },
      { letter: 'E', text: 'registrar exclusivamente sentimentos pessoais.' }
    ],
    correctAlternative: 'A'
  },
  {
    area: 'Ciências Humanas',
    year: 2017,
    context: 'A urbanização acelerada pode gerar desafios relacionados à moradia, mobilidade, saneamento e acesso a serviços públicos.',
    statement: 'Uma política pública associada à melhoria da mobilidade urbana é',
    alternatives: [
      { letter: 'A', text: 'redução de transporte coletivo.' },
      { letter: 'B', text: 'ampliação de ciclovias e integração de ônibus.' },
      { letter: 'C', text: 'eliminação de calçadas acessíveis.' },
      { letter: 'D', text: 'restrição do planejamento urbano.' },
      { letter: 'E', text: 'aumento de barreiras ao transporte público.' }
    ],
    correctAlternative: 'B'
  },
  {
    area: 'Ciências da Natureza',
    year: 2016,
    context: 'A vacinação é uma estratégia coletiva de prevenção de doenças infecciosas e contribui para a proteção de pessoas vulneráveis.',
    statement: 'A vacinação em massa contribui para',
    alternatives: [
      { letter: 'A', text: 'aumentar a transmissão de doenças.' },
      { letter: 'B', text: 'substituir totalmente hábitos de higiene.' },
      { letter: 'C', text: 'reduzir a circulação de agentes infecciosos.' },
      { letter: 'D', text: 'eliminar a necessidade de políticas de saúde.' },
      { letter: 'E', text: 'impedir qualquer mutação biológica.' }
    ],
    correctAlternative: 'C'
  },
  {
    area: 'Matemática',
    year: 2015,
    context: 'Um estudante resolveu 45 questões de um simulado com 60 questões no total.',
    statement: 'A porcentagem de questões resolvidas pelo estudante foi',
    alternatives: [
      { letter: 'A', text: '65%' },
      { letter: 'B', text: '70%' },
      { letter: 'C', text: '72%' },
      { letter: 'D', text: '75%' },
      { letter: 'E', text: '80%' }
    ],
    correctAlternative: 'D'
  },
  {
    area: 'Linguagens',
    year: 2014,
    context: 'A norma-padrão é uma variedade da língua usada em contextos formais, como documentos, provas, artigos e comunicações institucionais.',
    statement: 'O uso da norma-padrão é mais adequado em',
    alternatives: [
      { letter: 'A', text: 'conversa informal entre amigos.' },
      { letter: 'B', text: 'mensagem com gírias em grupo privado.' },
      { letter: 'C', text: 'redação do ENEM e documentos oficiais.' },
      { letter: 'D', text: 'bilhete familiar com linguagem afetiva.' },
      { letter: 'E', text: 'meme publicado em rede social.' }
    ],
    correctAlternative: 'C'
  }
];

export const mockQuestions = Array.from({ length: 60 }, (_, index) => {
  const original = baseQuestions[index % baseQuestions.length];
  return {
    ...original,
    id: `mock-${String(index + 1).padStart(3, '0')}`,
    number: index + 1,
    statement: original.statement
  };
});
