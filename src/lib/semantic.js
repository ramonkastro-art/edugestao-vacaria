// Regras de interpretação dos dados herdados das planilhas.
// O texto original continua preservado no banco; estas funções apenas
// produzem uma visão confiável para filtros e relatórios.

export function normalizar(valor = '') {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const FUNCOES_OFICIAIS = [
  'Professor',
  'Direção',
  'Vice-direção',
  'Supervisão',
  'Orientação Educacional',
  'Atendimento Educacional Especializado (AEE)',
  'Atendente de Creche',
  'Merendeira',
  'Servente',
  'Secretaria / Administrativo',
  'Biblioteca',
  'Monitor / Apoio',
  'Estágio',
  'Outro',
]

export const GRUPOS_FUNCAO = [
  'Professores',
  'Gestão',
  'Administrativo',
  'Apoio',
  'Estágio',
  'Outros',
]

function textoContexto(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const ativas = lotacoes.filter(lotacao => !lotacao?.data_fim)
  return [
    servidor?.funcao,
    servidor?.funcao_original,
    ...(ativas.flatMap(lotacao => [
      lotacao?.funcao_original,
      lotacao?.funcao_categoria,
      lotacao?.area_atuacao_categoria,
      lotacao?.area_concurso_original,
    ])),
  ].filter(Boolean).map(normalizar).join(' | ')
}

export function classificarFuncao(servidor) {
  const valor = textoContexto(servidor)

  if (!valor) return 'Outro'
  if (/(profess|docent)/.test(valor) && !/aee/.test(valor)) return 'Professor'
  if (/(aee|sala de recursos|educacao especial)/.test(valor)) return 'Atendimento Educacional Especializado (AEE)'
  if (/(vice[ -]?diret|vice[ -]?direcao)/.test(valor)) return 'Vice-direção'
  if (/(diretor|diretora|direcao)/.test(valor)) return 'Direção'
  if (/(supervisor|supervisao)/.test(valor)) return 'Supervisão'
  if (/(orientador|orientacao educacional)/.test(valor)) return 'Orientação Educacional'
  if (/(atendente de creche|auxiliar de desenvolvimento infantil|cuidador|cuidadora)/.test(valor)) return 'Atendente de Creche'
  if (/(merendeir|merenda|cozinha)/.test(valor)) return 'Merendeira'
  if (/(servente|limpeza|servicos gerais|auxiliar de limpeza)/.test(valor)) return 'Servente'
  if (/(secretar|agente administrativo|assistente administrativo|auxiliar administrativo|tecnico administrativo)/.test(valor)) return 'Secretaria / Administrativo'
  if (/(biblioteca|bibliotec)/.test(valor)) return 'Biblioteca'
  if (/(monitor|monitora|apoio)/.test(valor)) return 'Monitor / Apoio'
  if (/estagi/.test(valor)) return 'Estágio'

  // Alguns registros trazem somente a área/turma no campo "ATUAÇÃO".
  // Nesses casos evitamos transformar turma ou horário em uma função falsa.
  if (/^(atuacao|atuação|1.? ano|2.? ano|3.? ano|4.? ano|5.? ano|6.? ano|7.? ano|8.? ano|9.? ano|maternal|bercario|pre |b[123])/.test(valor)) return 'Outro'

  return 'Outro'
}

export function grupoDaFuncao(funcao) {
  if (funcao === 'Professor' || funcao === 'Atendimento Educacional Especializado (AEE)') return 'Professores'
  if (['Direção', 'Vice-direção', 'Supervisão', 'Orientação Educacional'].includes(funcao)) return 'Gestão'
  if (funcao === 'Secretaria / Administrativo') return 'Administrativo'
  if (funcao === 'Estágio') return 'Estágio'
  if (funcao === 'Outro') return 'Outros'
  return 'Apoio'
}

const AREA_REGRAS = [
  ['Língua Portuguesa', /(lingua portuguesa|letras|literatura portuguesa|portuguesa?)/],
  ['Língua Inglesa', /(lingua inglesa|ingles|ingl[eê]s)/],
  ['Língua Espanhola', /(lingua espanhola|espanhol)/],
  ['Matemática', /(matematica|matem[aá]tica)/],
  ['História', /(historia|hist[oó]ria)/],
  ['Geografia', /(geografia|geograf)/],
  ['Ciências', /(ciencias biologicas|ciencias|biologia|biologicas)/],
  ['Educação Física', /(educacao fisica|educa[cç][aã]o fisica)/],
  ['Artes', /(artes visuais|arte na educacao|artes?)/],
  ['Ensino Religioso', /(ensino religioso|religiao)/],
  ['Educação Especial / AEE', /(aee|educacao especial|sala de recursos)/],
  ['Educação Infantil', /(educacao infantil|maternal|bercario|creche|pre i|pre ii|pré i|pré ii)/],
  ['Anos Iniciais', /(anos iniciais|series iniciais|magisterio)/],
]

export function areasDaAtuacao(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const ativas = lotacoes.filter(lotacao => !lotacao?.data_fim)
  const resultado = new Set()

  ativas.forEach(lotacao => {
    if (lotacao?.area_atuacao_categoria) resultado.add(String(lotacao.area_atuacao_categoria).trim())
  })

  const funcao = classificarFuncao(servidor)
  const contexto = [
    servidor?.funcao,
    servidor?.funcao_original,
    servidor?.formacao,
    ...(ativas.flatMap(lotacao => [lotacao?.funcao_original, lotacao?.area_concurso_original])),
  ].filter(Boolean).map(normalizar).join(' | ')

  if (funcao === 'Professor' || funcao === 'Atendimento Educacional Especializado (AEE)') {
    AREA_REGRAS.forEach(([area, regra]) => {
      if (regra.test(contexto)) resultado.add(area)
    })
  }

  return [...resultado]
}

export function areaPrincipal(servidor) {
  const areas = areasDaAtuacao(servidor)
  return areas[0] || ''
}

export function funcaoOficial(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const categoriaDaLotacao = lotacoes.find(lotacao => !lotacao?.data_fim && lotacao?.funcao_categoria)?.funcao_categoria
  if (categoriaDaLotacao && FUNCOES_OFICIAIS.includes(categoriaDaLotacao)) return categoriaDaLotacao
  return classificarFuncao(servidor)
}

export function pertenceAFuncao(servidor, funcao) {
  return !funcao || funcaoOficial(servidor) === funcao
}

export function pertenceAGrupo(servidor, grupo) {
  return !grupo || grupoDaFuncao(funcaoOficial(servidor)) === grupo
}
