const ORIGEM_LOTACAO = 'LOTACAO_ATIVA_REGISTRADA_NO_EDUGESTAO'
const ORIGEM_QUADRO = 'QUADRO_GERAL_ATUALIZADO'

export function normalizarNomeQuadro(valor = '') {
  let texto = String(valor ?? '').split(/\r?\n/)[0]
  texto = texto.replace(/\s*\([^)]*\)\s*$/, '')
  texto = texto.replace(/\bA\s*\.?\s*C\.?\s*\d{1,2}[\/\s.-]+\d{1,2}.*$/i, '')
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function linhasExibiveis(linhas) {
  return Array.isArray(linhas)
    ? linhas.filter((linha) => linha && linha.deve_exibir_no_quadro !== false)
    : []
}

export function obterLinhasMarcadasDaEscola(resposta, escolaId) {
  const id = Number(escolaId)
  const quadro = Array.isArray(resposta?.quadros_com_revisao)
    ? resposta.quadros_com_revisao.find((item) => Number(item?.escola_id) === id)
    : null

  if (Array.isArray(quadro?.linhas_com_marcador_revisao)) {
    return linhasExibiveis(quadro.linhas_com_marcador_revisao)
  }

  const detalhe = Array.isArray(resposta?.escolas)
    ? resposta.escolas.find((item) => Number(item?.escola_id) === id)
    : null
  return linhasExibiveis(detalhe?.linhas_com_marcador_revisao)
}

function nomeLinha(linha) {
  return String(linha?.nome_servidor ?? linha?.nome_fonte ?? linha?.nome_no_quadro ?? '').trim()
}

function encontrarServidorAssociado(linha, servidoresConhecidos, servidoresNaEscola) {
  const idLinha = linha?.servidor_id ?? linha?.servidor_id_candidato
  if (idLinha != null) {
    const porId = servidoresConhecidos.find((servidor) => String(servidor?.id) === String(idLinha))
    if (porId) return porId
  }

  const nome = normalizarNomeQuadro(nomeLinha(linha))
  if (!nome) return null

  const candidatosConhecidos = servidoresConhecidos.filter(
    (servidor) => normalizarNomeQuadro(servidor?.nome) === nome,
  )
  if (candidatosConhecidos.length === 1) return candidatosConhecidos[0]

  const candidatosDaEscola = servidoresNaEscola.filter(
    (servidor) => normalizarNomeQuadro(servidor?.nome) === nome,
  )
  return candidatosDaEscola.length === 1 ? candidatosDaEscola[0] : null
}

/**
 * Constrói as linhas visuais sem alterar os registros funcionais recebidos do banco.
 * Linhas da fonte nunca são agrupadas por nome: cada linha do Quadro Geral permanece
 * individualizada, inclusive quando a pessoa aparece mais de uma vez.
 */
export function construirLinhasQuadro({
  servidores = [],
  linhasMarcadas = [],
  servidoresConhecidos = [],
  escolaId = 'escola',
} = {}) {
  const linhas = linhasExibiveis(linhasMarcadas).filter(
    (linha) => linha.marcador_revisao || linha.marcador_visual || linha.status_exibicao,
  )
  const presencasEduGestao = linhas.filter((linha) => linha.origem_exibicao === ORIGEM_LOTACAO)
  const linhasDaFonte = linhas.filter((linha) => linha.origem_exibicao === ORIGEM_QUADRO)
  const presencasUsadas = new Set()
  const entradas = []

  servidores.forEach((servidor, indice) => {
    let revisao = presencasEduGestao.find(
      (linha) => linha.servidor_id != null && String(linha.servidor_id) === String(servidor?.id),
    ) ?? null

    if (!revisao) {
      const nome = normalizarNomeQuadro(servidor?.nome)
      const presencasDoNome = presencasEduGestao.filter(
        (linha) => normalizarNomeQuadro(nomeLinha(linha)) === nome,
      )
      const servidoresDoNome = servidores.filter(
        (item) => normalizarNomeQuadro(item?.nome) === nome,
      )
      if (nome && presencasDoNome.length === 1 && servidoresDoNome.length === 1) {
        revisao = presencasDoNome[0]
      }
    }

    if (revisao) presencasUsadas.add(revisao)
    entradas.push({
      tipo: 'servidor',
      chave: `servidor-${servidor?.id ?? indice}-${servidor?.lotacaoAtual?.id ?? indice}`,
      nome: String(servidor?.nome ?? ''),
      servidor,
      revisao,
    })
  })

  presencasEduGestao.forEach((linha, indice) => {
    if (presencasUsadas.has(linha)) return
    entradas.push({
      tipo: 'presenca-provisoria',
      chave: `presenca-${escolaId}-${linha.servidor_id ?? normalizarNomeQuadro(nomeLinha(linha))}-${indice}`,
      nome: nomeLinha(linha),
      linha,
      servidorAssociado: encontrarServidorAssociado(linha, servidoresConhecidos, servidores),
      revisao: linha,
    })
  })

  linhasDaFonte.forEach((linha, indice) => {
    entradas.push({
      tipo: 'linha-fonte',
      // linha_excel faz parte da identidade visual, não do nome: duas atribuições
      // da mesma pessoa são linhas distintas e precisam continuar visíveis.
      chave: `fonte-${escolaId}-${linha.linha_excel ?? 'sem-linha'}-${indice}`,
      nome: nomeLinha(linha),
      linha,
      servidorAssociado: encontrarServidorAssociado(linha, servidoresConhecidos, servidores),
      revisao: linha,
    })
  })

  return entradas.sort((a, b) => {
    const comparacaoNome = a.nome.localeCompare(b.nome, 'pt-BR')
    if (comparacaoNome !== 0) return comparacaoNome
    const ordem = { servidor: 0, 'presenca-provisoria': 1, 'linha-fonte': 2 }
    const comparacaoTipo = (ordem[a.tipo] ?? 9) - (ordem[b.tipo] ?? 9)
    if (comparacaoTipo !== 0) return comparacaoTipo
    return Number(a.linha?.linha_excel ?? 0) - Number(b.linha?.linha_excel ?? 0)
  })
}

/**
 * Retorna apenas candidatos novos explicitamente qualificados pelo backend após
 * reconciliação global completa. A lista é somente para conferência; nunca grava.
 */
export function obterNovosCandidatosDaEscola(resposta, escolaId) {
  if (resposta?.resumo?.reconciliacao_global_completa_no_escopo !== true) return []
  if (!Array.isArray(resposta?.novos_cadastros_candidatos)) return []

  return resposta.novos_cadastros_candidatos.filter((item) => (
    Number(item?.escola_id) === Number(escolaId)
    && item?.status === 'CANDIDATO_NOVO_PARA_VALIDACAO_FINAL'
    && item?.gravacao_automatica_permitida_nesta_versao === false
    && Boolean(String(item?.nome_fonte ?? '').trim())
  ))
}

/**
 * Retorna pendências de lotação/transferência relacionadas à escola atual.
 * O resultado pode aparecer na origem e no destino, para a Secretaria conferir
 * os dois lados do caso sem presumir que uma transferência já ocorreu.
 */
export function obterPendenciasTransferenciaDaEscola(resposta, escolaId) {
  if (!Array.isArray(resposta?.correcoes_a_fazer)) return []
  const id = Number(escolaId)
  const tiposConhecidos = new Set([
    'POSSIVEL_TRANSFERENCIA_OU_LOTACAO_DESATUALIZADA',
    'LOTACAO_OU_TRANSFERENCIA_A_VALIDAR',
  ])
  const acoesConhecidas = new Set([
    'TRANSFERENCIA_INDICADA_NA_FONTE_REVISAR_LOTACAO',
    'REVISAR_LOTACAO_ESCOLAR',
  ])
  const vistos = new Set()

  return resposta.correcoes_a_fazer.filter((item) => {
    if (!item || (!tiposConhecidos.has(item.tipo) && !acoesConhecidas.has(item.acao_preliminar))) return false
    const escolasEncontradas = Array.isArray(item.encontrado_no_quadro_de) ? item.encontrado_no_quadro_de : []
    const idsRelacionados = [
      item.escola_id,
      item.escola_atual_registrada_no_edugestao?.escola_id,
      ...escolasEncontradas.map((escola) => escola?.escola_id),
    ].map(Number).filter(Number.isFinite)
    if (!idsRelacionados.includes(id)) return false

    const escolasExatas = escolasEncontradas
      .filter((escola) => escola?.tipo_correspondencia === 'NOME_NORMALIZADO_EXATO')
      .map((escola) => Number(escola.escola_id))
      .sort((a, b) => a - b)
    const chave = [
      item.tipo ?? item.acao_preliminar ?? '',
      item.servidor_id ?? item.servidor_id_candidato ?? normalizarNomeQuadro(item.nome_servidor ?? item.nome_fonte),
      item.escola_atual_registrada_no_edugestao?.escola_id ?? item.escola_id ?? '',
      escolasExatas.join(','),
      item.linha_excel ?? '',
    ].join('|')
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/**
 * Cria uma sugestão para abrir o modal de transferência somente quando há um
 * servidor identificado por ID, uma origem ativa confirmada e um único destino
 * com correspondência de nome exata. Nunca executa a transferência.
 */
export function obterSugestaoTransferenciaSegura(correcao, servidoresConhecidos = []) {
  if (correcao?.tipo !== 'POSSIVEL_TRANSFERENCIA_OU_LOTACAO_DESATUALIZADA') return null
  if (correcao?.revisao_humana_obrigatoria !== true || correcao?.gravacao_automatica_permitida !== false) return null

  const origemId = Number(correcao?.escola_atual_registrada_no_edugestao?.escola_id)
  if (!Number.isInteger(origemId) || origemId <= 0 || !correcao?.servidor_id) return null

  const destinosExatos = (Array.isArray(correcao?.encontrado_no_quadro_de) ? correcao.encontrado_no_quadro_de : [])
    .filter((escola) => escola?.tipo_correspondencia === 'NOME_NORMALIZADO_EXATO' && Number.isInteger(Number(escola?.escola_id)))
  // Uma pessoa pode ter várias linhas de atuação no mesmo Quadro Geral; para
  // escolher destino, contar escolas distintas, não linhas de fonte.
  const destinosUnicosPorEscola = new Map()
  destinosExatos.forEach((escola) => {
    const id = Number(escola.escola_id)
    if (!destinosUnicosPorEscola.has(id)) destinosUnicosPorEscola.set(id, escola)
  })
  if (destinosUnicosPorEscola.size !== 1) return null
  const destinoSugerido = [...destinosUnicosPorEscola.values()][0]

  const destinoId = Number(destinoSugerido.escola_id)
  if (destinoId <= 0 || destinoId === origemId) return null

  const servidor = servidoresConhecidos.find((item) => String(item?.id) === String(correcao.servidor_id))
  if (!servidor) return null

  // Falha fechada: só habilitar o atalho se a lista global confirmar uma lotação
  // de origem ativa. Em fallback de schema sem data_fim, não sugerir ação.
  const origemAtivaConfirmada = Array.isArray(servidor.lotacoes) && servidor.lotacoes.some((lotacao) => (
    Object.prototype.hasOwnProperty.call(lotacao ?? {}, 'data_fim')
    && !lotacao.data_fim
    && Number(lotacao.escola_id) === origemId
  ))
  if (!origemAtivaConfirmada) return null
  const destinoJaAtivo = servidor.lotacoes.some((lotacao) => (
    Object.prototype.hasOwnProperty.call(lotacao ?? {}, 'data_fim')
    && !lotacao.data_fim
    && Number(lotacao.escola_id) === destinoId
  ))
  if (destinoJaAtivo) return null

  return {
    servidor,
    escolaOrigemId: origemId,
    escolaDestinoId: destinoId,
    escolaOrigemNome: String(correcao.escola_atual_registrada_no_edugestao?.escola_nome ?? ''),
    escolaDestinoNome: String(destinoSugerido.escola_nome ?? ''),
    motivo: String(correcao.motivo ?? ''),
  }
}
