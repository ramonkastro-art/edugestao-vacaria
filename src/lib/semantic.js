// Camada semântica dos dados herdados das planilhas.
// Nunca sobrescreve o dado original: apenas interpreta os campos para
// filtros e relatórios, com regras explícitas e conservadoras.

export function normalizar(valor = '') {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const FUNCOES_OFICIAIS = [
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

const FUNCOES_APOIO_EXPLICITAS = [
  /\bmerendeir/i,
  /\bmerenda\b/i,
  /\bcozinha\b/i,
  /\bservente\b/i,
  /\blimpeza\b/i,
  /\bservicos? gerais\b/i,
  /\bauxiliar de limpeza\b/i,
  /\batendente\b/i,
  /\bcuidador(?:a)?\b/i,
  /\bauxiliar de desenvolvimento infantil\b/i,
  /\bauxiliar(?: de)? apoio escolar\b/i,
  /\bauxiliar maternal\b/i,
]

const FUNCOES_ADMIN_EXPLICITAS = [
  /\batendimento ao cidadao\b/i,
  /\bagente adm/i,
  /\bagente administrativo\b/i,
  /\bassistente administrativo\b/i,
  /\bauxiliar administrativo\b/i,
  /\bauxiliar de secretaria\b/i,
  /\bsecretar(?:ia|ia\/administrativo|ia administrativa)\b/i,
  /\bchefe de setor\b/i,
  /\bdelimitacao de funcao - auxiliar de secretaria\b/i,
]

const FUNCOES_GESTAO_EXPLICITAS = [
  [/\bvice[- ]?diret/, 'Vice-direção'],
  [/\bdiretor(?:a)?\b|\bdirecao\b/, 'Direção'],
  [/\bsupervisor(?:a)?\b|\bsupervisao\b/, 'Supervisão'],
  [/\borientador(?:a)?\b|\borientacao educacional\b/, 'Orientação Educacional'],
]

const MARCADORES_TURMA = [
  /\b(?:pre|bercario|maternal)\s*[a-z0-9]/i,
  /\b[1-9](?:º|o|°)?\s*ano\b/i,
  /\b[1-9]\s*[a-z]\b/i,
  /\b(?:b1|b2|b3|bia|bib|biia|biib|biiia|biiib|biiic)\b/i,
  /\bturma\b/i,
  /\bmultisseriada\b/i,
]

const MARCADORES_DOCENCIA = [
  /\bmagisterio\b/i,
  /\bpedagogia\b/i,
  /\blicenciatura\b/i,
  /\bprofessor(?:a)?\b/i,
  /\bdocencia\b/i,
  /\bdocente\b/i,
  /\banos iniciais\b/i,
  /\bseries iniciais\b/i,
]

const MARCADORES_DISCIPLINA = [
  /\bmatematica\b/i,
  /\blingua portuguesa\b/i,
  /\bportugues\b/i,
  /\blingua inglesa\b/i,
  /\bingles\b/i,
  /\blingua espanhola\b/i,
  /\bespanhol\b/i,
  /\bhistoria\b/i,
  /\bgeografia\b/i,
  /\bciencias\b/i,
  /\bbiologia\b/i,
  /\beducacao fisica\b/i,
  /\bartes?\b/i,
  /\bensino religioso\b/i,
  /\bfilosofia\b/i,
]

function textoCompleto(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const ativas = lotacoes.filter(lotacao => !lotacao?.data_fim)
  return [
    servidor?.funcao,
    servidor?.funcao_original,
    servidor?.formacao,
    servidor?.formacao_original,
    ...(ativas.flatMap(lotacao => [
      lotacao?.funcao_original,
      lotacao?.funcao_categoria,
      lotacao?.area_atuacao_categoria,
      lotacao?.area_concurso_original,
      lotacao?.turma_atuacao,
      lotacao?.vinculo_original,
    ])),
  ].filter(Boolean).map(normalizar).join(' | ')
}

function textoFuncao(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const ativas = lotacoes.filter(lotacao => !lotacao?.data_fim)
  return [
    servidor?.funcao,
    servidor?.funcao_original,
    ...(ativas.flatMap(lotacao => [lotacao?.funcao_original, lotacao?.funcao_categoria])),
  ].filter(Boolean).map(normalizar).join(' | ')
}

function textoFormacao(servidor) {
  return [servidor?.formacao, servidor?.formacao_original]
    .filter(Boolean)
    .map(normalizar)
    .join(' | ')
}

function textoAtuacao(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  return lotacoes
    .filter(lotacao => !lotacao?.data_fim)
    .flatMap(lotacao => [
      lotacao?.area_atuacao_categoria,
      lotacao?.area_concurso_original,
      lotacao?.turma_atuacao,
      lotacao?.funcao_original,
    ])
    .filter(Boolean)
    .map(normalizar)
    .join(' | ')
}

function temAlgum(texto, regras) {
  return regras.some(regra => regra.test(texto))
}

function funcaoExplicita(texto) {
  if (/(\baee\b|sala de recursos|atendimento educacional especializado|educacao especial)/i.test(texto)) {
    return 'Atendimento Educacional Especializado (AEE)'
  }
  for (const [regra, funcao] of FUNCOES_GESTAO_EXPLICITAS) {
    if (regra.test(texto)) return funcao
  }
  if (/(\bprofessora?\b|\bprofessoras\b|\bdocente\b|\bdocentes\b)/i.test(texto)) return 'Professor'
  if (temAlgum(texto, FUNCOES_APOIO_EXPLICITAS)) {
    if (/\batendente\b|\bcuidador(?:a)?\b|\bauxiliar de desenvolvimento infantil\b|\bauxiliar maternal\b|\bauxiliar(?: de)? apoio escolar\b/i.test(texto)) return 'Atendente de Creche'
    if (/\bmerendeir|\bmerenda\b|\bcozinha\b/i.test(texto)) return 'Merendeira'
    if (/\bservente\b|\blimpeza\b|\bservicos? gerais\b/i.test(texto)) return 'Servente'
  }
  if (temAlgum(texto, FUNCOES_ADMIN_EXPLICITAS)) return 'Secretaria / Administrativo'
  if (/\bbiblioteca|\bbibliotec/i.test(texto)) return 'Biblioteca'
  if (/\bmonitora?\b|\bmonitor(?:ia)?\b|\bapoio\b/i.test(texto)) return 'Monitor / Apoio'
  if (/\bestagi/i.test(texto)) return 'Estágio'
  return null
}

export function classificarFuncao(servidor) {
  const funcaoTexto = textoFuncao(servidor)
  const completo = textoCompleto(servidor)
  const formacao = textoFormacao(servidor)
  const atuacao = textoAtuacao(servidor)

  // 1) Expressão explícita e confiável no campo de função/lotação.
  const explicita = funcaoExplicita(funcaoTexto)
  if (explicita) return explicita

  // 2) Se a planilha usou função como turma/área, usamos contexto docente.
  const indiciosDocencia = temAlgum(formacao, MARCADORES_DOCENCIA)
  const funcaoPareceTurma = temAlgum(funcaoTexto, MARCADORES_TURMA)
  const funcaoPareceDisciplina = temAlgum(funcaoTexto, MARCADORES_DISCIPLINA)
  const atuacaoDocente = temAlgum(atuacao, [...MARCADORES_TURMA, ...MARCADORES_DISCIPLINA, /\bitinerante\b/i, /\batelie/i, /\barea [12]\b/i])

  if (indiciosDocencia && (funcaoPareceTurma || funcaoPareceDisciplina || atuacaoDocente || /\barea [12]\b/i.test(funcaoTexto))) {
    return 'Professor'
  }

  // 3) Itinerância/atuação pedagógica + formação docente é forte indício de docência.
  if (indiciosDocencia && /\bitinerante\b|\batelie\b|\bcomponentes curriculares integrados\b/i.test(completo)) {
    return 'Professor'
  }

  // 4) AEE é reconhecido mesmo quando o campo de função está deslocado.
  if (/\baee\b|sala de recursos|atendimento educacional especializado|educacao especial/i.test(completo)) {
    return 'Atendimento Educacional Especializado (AEE)'
  }

  // 5) Regras explícitas para administrativos/apoio mesmo com preenchimento irregular.
  if (temAlgum(completo, FUNCOES_APOIO_EXPLICITAS)) {
    if (/\batendente\b|\bcuidador(?:a)?\b|\bauxiliar de desenvolvimento infantil\b|\bauxiliar maternal\b|\bauxiliar(?: de)? apoio escolar\b/i.test(completo)) return 'Atendente de Creche'
    if (/\bmerendeir|\bmerenda\b|\bcozinha\b/i.test(completo)) return 'Merendeira'
    if (/\bservente\b|\blimpeza\b|\bservicos? gerais\b/i.test(completo)) return 'Servente'
  }
  if (temAlgum(completo, FUNCOES_ADMIN_EXPLICITAS)) return 'Secretaria / Administrativo'
  if (/\bbiblioteca|\bbibliotec/i.test(completo)) return 'Biblioteca'
  if (/\bmonitora?\b|\bmonitor(?:ia)?\b|\bapoio\b/i.test(completo)) return 'Monitor / Apoio'
  if (/\bestagi/i.test(completo)) return 'Estágio'

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
  ['Língua Portuguesa', /\blingua portuguesa\b|\bportugues\b|\bletras\b|\bliteratura portuguesa\b/i],
  ['Língua Inglesa', /\blingua inglesa\b|\bingles\b/i],
  ['Língua Espanhola', /\blingua espanhola\b|\bespanhol\b/i],
  ['Matemática', /\bmatematica\b/i],
  ['História', /\bhistoria\b/i],
  ['Geografia', /\bgeografia\b/i],
  ['Ciências', /\bciencias biologicas\b|\bciencias\b|\bbiologia\b/i],
  ['Educação Física', /\beducacao fisica\b/i],
  ['Artes', /\bartes? visuais\b|\barte na educacao\b|\bartes?\b/i],
  ['Ensino Religioso', /\bensino religioso\b|\breligiao\b/i],
  ['Educação Especial / AEE', /\baee\b|\beducacao especial\b|\bsala de recursos\b/i],
  ['Educação Infantil', /\beducacao infantil\b|\bmaternal\b|\bbercario\b|\bcreche\b|\bpre i\b|\bpre ii\b/i],
  ['Anos Iniciais', /\banos iniciais\b|\bseries iniciais\b|\bmagisterio\b|\bpedagogia\b/i],
]

export function areasDaAtuacao(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  const ativas = lotacoes.filter(lotacao => !lotacao?.data_fim)
  const resultado = new Set()

  ativas.forEach(lotacao => {
    if (lotacao?.area_atuacao_categoria) resultado.add(String(lotacao.area_atuacao_categoria).trim())
  })

  const funcao = classificarFuncao(servidor)
  if (funcao === 'Professor' || funcao === 'Atendimento Educacional Especializado (AEE)') {
    const contexto = [
      servidor?.funcao,
      servidor?.funcao_original,
      servidor?.formacao,
      servidor?.formacao_original,
      ...(ativas.flatMap(lotacao => [lotacao?.funcao_original, lotacao?.area_concurso_original, lotacao?.turma_atuacao])),
    ].filter(Boolean).map(normalizar).join(' | ')

    AREA_REGRAS.forEach(([area, regra]) => {
      if (regra.test(contexto)) resultado.add(area)
    })
  }

  return [...resultado]
}

export function areaPrincipal(servidor) {
  return areasDaAtuacao(servidor)[0] || ''
}

export function funcaoOficial(servidor) {
  // A classificação semântica é a fonte principal. Ela usa função, formação
  // e contexto de atuação e evita dar prioridade cega a categorias herdadas.
  return classificarFuncao(servidor)
}

export function pertenceAFuncao(servidor, funcao) {
  return !funcao || funcaoOficial(servidor) === funcao
}

export function pertenceAGrupo(servidor, grupo) {
  return !grupo || grupoDaFuncao(funcaoOficial(servidor)) === grupo
}
