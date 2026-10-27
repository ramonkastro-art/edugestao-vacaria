import test from 'node:test'
import assert from 'node:assert/strict'
import {
  construirLinhasQuadro,
  normalizarNomeQuadro,
  obterLinhasMarcadasDaEscola,
  obterNovosCandidatosDaEscola,
  obterPendenciasTransferenciaDaEscola,
  obterSugestaoTransferenciaSegura,
} from '../src/lib/quadroPreview.js'

const servidorId = 'srv-infancia-bones-freitas'
const servidorNome = 'Infância Bonês Freitas'

function criarRespostaCenarioInfancia() {
  return {
    ok: true,
    modo: 'PREVIEW_LOTE_CADASTRO_QUADRO',
    versao: 'preview-lote-cadastro-quadro-v7-presencas-provisorias-com-tag',
    resumo: { gravacao_realizada: false, tabelas_alteradas: [] },
    quadros_com_revisao: [
      {
        escola_id: 19,
        escola_nome: 'EMEF Inácio de Souza Pires',
        linhas_com_marcador_revisao: [
          {
            escola_id: 19,
            servidor_id: servidorId,
            nome_servidor: servidorNome,
            origem_exibicao: 'LOTACAO_ATIVA_REGISTRADA_NO_EDUGESTAO',
            marcador_visual: '⚠ Revisar lotação',
            status_exibicao: 'PRESENCA_PROVISORIA_COM_REVISAO',
            deve_exibir_no_quadro: true,
            presenca_provisoria: true,
            revisao_humana_obrigatoria: true,
            gravacao_automatica_permitida: false,
          },
        ],
      },
      {
        escola_id: 14,
        escola_nome: 'EMEF Coronel Avelino',
        linhas_com_marcador_revisao: [
          {
            escola_id: 14,
            servidor_id: servidorId,
            nome_servidor: servidorNome,
            linha_excel: 30,
            secao: 'Ateliê',
            atuacao: 'Ateliê',
            origem_exibicao: 'QUADRO_GERAL_ATUALIZADO',
            marcador_visual: '⚠ Revisar lotação',
            status_exibicao: 'PRESENCA_PROVISORIA_COM_REVISAO',
            deve_exibir_no_quadro: true,
            revisao_humana_obrigatoria: true,
            gravacao_automatica_permitida: false,
          },
          {
            escola_id: 14,
            servidor_id: servidorId,
            nome_servidor: servidorNome,
            linha_excel: 31,
            secao: 'Matemática e Filosofia',
            atuacao: 'Matemática e Filosofia',
            origem_exibicao: 'QUADRO_GERAL_ATUALIZADO',
            marcador_visual: '⚠ Revisar lotação',
            status_exibicao: 'PRESENCA_PROVISORIA_COM_REVISAO',
            deve_exibir_no_quadro: true,
            revisao_humana_obrigatoria: true,
            gravacao_automatica_permitida: false,
          },
        ],
      },
    ],
  }
}

test('normaliza nomes com acentos e diferenças de caixa', () => {
  assert.equal(normalizarNomeQuadro('  Infância Bonês Freitas  '), 'INFANCIA BONES FREITAS')
})

test('mantém a presença provisória no quadro da lotação registrada no EduGestão', () => {
  const resposta = criarRespostaCenarioInfancia()
  const linhas = obterLinhasMarcadasDaEscola(resposta, 19)
  const entradas = construirLinhasQuadro({
    servidores: [{ id: servidorId, nome: servidorNome, lotacaoAtual: { id: 'lotacao-1' } }],
    linhasMarcadas: linhas,
    escolaId: 19,
  })

  assert.equal(entradas.length, 1)
  assert.equal(entradas[0].tipo, 'servidor')
  assert.equal(entradas[0].revisao.origem_exibicao, 'LOTACAO_ATIVA_REGISTRADA_NO_EDUGESTAO')
})

test('preserva as duas linhas da fonte no quadro de destino e suas atuações distintas', () => {
  const resposta = criarRespostaCenarioInfancia()
  const linhas = obterLinhasMarcadasDaEscola(resposta, 14)
  const entradas = construirLinhasQuadro({
    servidores: [],
    servidoresConhecidos: [{ id: servidorId, nome: servidorNome }],
    linhasMarcadas: linhas,
    escolaId: 14,
  })

  assert.equal(entradas.length, 2)
  assert.deepEqual(entradas.map((entrada) => entrada.linha.linha_excel), [30, 31])
  assert.deepEqual(entradas.map((entrada) => entrada.linha.atuacao), ['Ateliê', 'Matemática e Filosofia'])
  assert.ok(entradas.every((entrada) => entrada.tipo === 'linha-fonte'))
  assert.ok(entradas.every((entrada) => entrada.revisao.gravacao_automatica_permitida === false))
})

test('usa os detalhes da escola como alternativa quando quadros_com_revisao não tem o grupo', () => {
  const linha = { nome_servidor: servidorNome, origem_exibicao: 'QUADRO_GERAL_ATUALIZADO', deve_exibir_no_quadro: true }
  assert.deepEqual(
    obterLinhasMarcadasDaEscola({ escolas: [{ escola_id: 14, linhas_com_marcador_revisao: [linha] }] }, 14),
    [linha],
  )
})

test('ignora linhas explicitamente configuradas para não aparecer no quadro', () => {
  assert.deepEqual(obterLinhasMarcadasDaEscola({
    quadros_com_revisao: [{ escola_id: 14, linhas_com_marcador_revisao: [{ deve_exibir_no_quadro: false }] }],
  }, 14), [])
})


test('mostra candidatos a novo cadastro somente após reconciliação global completa', () => {
  const candidato = {
    escola_id: 14,
    escola_nome: 'EMEF Coronel Avelino',
    linha_excel: 55,
    nome_fonte: 'Pessoa Nova da Silva',
    secao: 'Professores',
    atuacao: 'Matemática 6ºA',
    status: 'CANDIDATO_NOVO_PARA_VALIDACAO_FINAL',
    gravacao_automatica_permitida_nesta_versao: false,
  }
  const resposta = {
    resumo: { reconciliacao_global_completa_no_escopo: true },
    novos_cadastros_candidatos: [candidato],
  }

  assert.deepEqual(obterNovosCandidatosDaEscola(resposta, 14), [candidato])
  assert.deepEqual(obterNovosCandidatosDaEscola(resposta, 19), [])
  assert.deepEqual(obterNovosCandidatosDaEscola({
    ...resposta,
    resumo: { reconciliacao_global_completa_no_escopo: false },
  }, 14), [])
})

test('mostra pendência de transferência nos quadros da origem e do destino', () => {
  const correcao = {
    tipo: 'POSSIVEL_TRANSFERENCIA_OU_LOTACAO_DESATUALIZADA',
    servidor_id: servidorId,
    nome_servidor: servidorNome,
    escola_atual_registrada_no_edugestao: { escola_id: 19, escola_nome: 'EMEF Inácio de Souza Pires' },
    encontrado_no_quadro_de: [{
      escola_id: 14,
      escola_nome: 'EMEF Coronel Avelino',
      tipo_correspondencia: 'NOME_NORMALIZADO_EXATO',
    }],
    revisao_humana_obrigatoria: true,
    gravacao_automatica_permitida: false,
  }
  const resposta = { correcoes_a_fazer: [correcao] }
  assert.deepEqual(obterPendenciasTransferenciaDaEscola(resposta, 19), [correcao])
  assert.deepEqual(obterPendenciasTransferenciaDaEscola(resposta, 14), [correcao])
  assert.deepEqual(obterPendenciasTransferenciaDaEscola(resposta, 20), [])
})

test('só libera atalho de transferência com ID conhecido, origem ativa e destino único exato', () => {
  const correcao = {
    tipo: 'POSSIVEL_TRANSFERENCIA_OU_LOTACAO_DESATUALIZADA',
    servidor_id: servidorId,
    escola_atual_registrada_no_edugestao: { escola_id: 19, escola_nome: 'EMEF Inácio de Souza Pires' },
    encontrado_no_quadro_de: [{
      escola_id: 14,
      escola_nome: 'EMEF Coronel Avelino',
      tipo_correspondencia: 'NOME_NORMALIZADO_EXATO',
    }],
    revisao_humana_obrigatoria: true,
    gravacao_automatica_permitida: false,
  }
  const servidor = {
    id: servidorId,
    nome: servidorNome,
    lotacoes: [{ id: 5, escola_id: 19, data_fim: null }],
  }
  const correcaoComDuasAtribuicoesNaMesmaEscola = {
    ...correcao,
    encontrado_no_quadro_de: [
      ...correcao.encontrado_no_quadro_de,
      { escola_id: 14, escola_nome: 'EMEF Coronel Avelino', linha_excel: 31, tipo_correspondencia: 'NOME_NORMALIZADO_EXATO' },
    ],
  }
  const sugestao = obterSugestaoTransferenciaSegura(correcaoComDuasAtribuicoesNaMesmaEscola, [servidor])
  assert.equal(sugestao.servidor, servidor)
  assert.equal(sugestao.escolaOrigemId, 19)
  assert.equal(sugestao.escolaDestinoId, 14)

  assert.equal(obterSugestaoTransferenciaSegura(correcao, []), null)
  assert.equal(obterSugestaoTransferenciaSegura({
    ...correcao,
    encontrado_no_quadro_de: [{ escola_id: 14, tipo_correspondencia: 'NOME_SEMELHANTE_PARA_CONFERENCIA' }],
  }, [servidor]), null)
  assert.equal(obterSugestaoTransferenciaSegura({
    ...correcao,
    encontrado_no_quadro_de: [
      ...correcao.encontrado_no_quadro_de,
      { escola_id: 15, tipo_correspondencia: 'NOME_NORMALIZADO_EXATO' },
    ],
  }, [servidor]), null)
  assert.equal(obterSugestaoTransferenciaSegura(correcao, [{ ...servidor, lotacoes: [{ escola_id: 19 }] }]), null)
  assert.equal(obterSugestaoTransferenciaSegura(correcao, [{ ...servidor, lotacoes: [
    { id: 5, escola_id: 19, data_fim: null },
    { id: 6, escola_id: 14, data_fim: null },
  ] }]), null)
})
