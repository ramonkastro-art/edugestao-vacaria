import { useMemo, useState } from 'react'
import {
  ArrowRightLeft, Calendar, Edit2, FileSpreadsheet, Filter, Printer,
  RefreshCw, Search, SlidersHorizontal, Users, X,
} from 'lucide-react'
import { useEscolas, useServidores, useSolicitacoesTransferencia } from '../hooks/useData'

function normalizar(valor = '') {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function categoriaFuncao(funcao = '') {
  const valor = normalizar(funcao)
  if (valor.includes('professor')) return 'Professores'
  if (valor.includes('merendeir')) return 'Merendeiras'
  if (valor.includes('diretor') || valor.includes('coordenador')) return 'Gestão'
  if (valor.includes('secretari') || valor.includes('assistente administrativo') || valor.includes('tecnico administrativo')) return 'Administrativo'
  return 'Apoio'
}

function nomeEscolas(servidor) {
  const lotacoes = Array.isArray(servidor?.lotacoes) ? servidor.lotacoes : []
  return [...new Set(lotacoes.map(lotacao => String(lotacao?.escola?.name ?? '').trim()).filter(Boolean))]
}

function csvCell(valor = '') {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

function escapeHtml(valor = '') {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[caractere]))
}

function formatarData(data) {
  if (!data) return '—'
  const [ano, mes, dia] = String(data).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—'
}

function baixarArquivo(conteudo, nome, tipo = 'text/csv;charset=utf-8;') {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
}

const MODELOS = [
  { id: 'todos', label: 'Todos os servidores' },
  { id: 'professores', label: 'Professores' },
  { id: 'merendeiras', label: 'Merendeiras' },
  { id: 'portugues', label: 'Professores · Português' },
  { id: 'matematica', label: 'Professores · Matemática' },
]

const STATUS_SOLICITACAO = ['Pendente', 'Aprovado', 'Atendido', 'Cancelado']

function Notice({ error, warning }) {
  if (error) return <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700"><strong>Não foi possível carregar os dados.</strong><p className="text-xs mt-1 break-words">{error}</p></div>
  if (warning) return <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800">Os dados foram carregados em modo compatível. Execute as migrações do histórico para relatórios completos de lotação.</div>
  return null
}

function imprimirTabela({ titulo, colunas, linhas, resumo }) {
  const janela = window.open('', '_blank', 'width=1100,height=800')
  if (!janela) {
    window.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para exportar o relatório em PDF.')
    return
  }
  const dataGeracao = new Date().toLocaleString('pt-BR')
  const htmlLinhas = linhas.map(linha => `<tr>${linha.map(celula => `<td>${escapeHtml(celula)}</td>`).join('')}</tr>`).join('')
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #172033; margin: 0; font-size: 10px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #172033; padding-bottom: 10px; margin-bottom: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 12px; font-weight: normal; color: #64748b; margin: 0; }
    .meta { text-align: right; color: #64748b; line-height: 1.5; } .summary { background: #f1f5f9; padding: 8px 10px; margin-bottom: 12px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; } th { background: #172033; color: white; text-align: left; font-size: 9px; padding: 7px 6px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 6px; vertical-align: top; } tr:nth-child(even) td { background: #f8fafc; }
    footer { margin-top: 12px; color: #94a3b8; font-size: 9px; }
  </style></head><body>
    <header><div><h1>EduGestão · Vacaria/RS</h1><h2>${escapeHtml(titulo)}</h2></div><div class="meta">Gerado em ${escapeHtml(dataGeracao)}<br>${linhas.length} registro(s)</div></header>
    <div class="summary">${escapeHtml(resumo || 'Relatório filtrado com os critérios selecionados no sistema.')}</div>
    <table><thead><tr>${colunas.map(coluna => `<th>${escapeHtml(coluna)}</th>`).join('')}</tr></thead><tbody>${htmlLinhas || `<tr><td colspan="${colunas.length}">Nenhum registro encontrado.</td></tr>`}</tbody></table>
    <footer>EduGestão · Rede Municipal de Ensino · Vacaria/RS</footer>
  </body></html>`)
  janela.document.close()
  janela.focus()
  janela.onafterprint = () => janela.close()
  window.setTimeout(() => janela.print(), 250)
}

export default function Relatorios({ onEditSolicitacao }) {
  const { servidores, loading, error, migrationWarning, reload } = useServidores()
  const { escolas, error: escolasError } = useEscolas()
  const { solicitacoes, loading: loadingSolicitacoes, error: solicitacoesError, reload: reloadSolicitacoes } = useSolicitacoesTransferencia()
  const [tipoRelatorio, setTipoRelatorio] = useState('servidores')
  const [modelo, setModelo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [funcao, setFuncao] = useState('')
  const [formacao, setFormacao] = useState('')
  const [escolaId, setEscolaId] = useState('')
  const [status, setStatus] = useState('')
  const [vinculo, setVinculo] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(true)
  const [buscaSolicitacao, setBuscaSolicitacao] = useState('')
  const [statusSolicitacao, setStatusSolicitacao] = useState('')
  const [destinoSolicitacao, setDestinoSolicitacao] = useState('')
  const [dataPedidoInicio, setDataPedidoInicio] = useState('')
  const [dataPedidoFim, setDataPedidoFim] = useState('')

  const funcoes = useMemo(() => [...new Set((servidores ?? []).filter(Boolean).map(servidor => String(servidor.funcao ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [servidores])
  const formacoes = useMemo(() => [...new Set((servidores ?? []).filter(Boolean).map(servidor => String(servidor.formacao ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [servidores])

  const filtered = useMemo(() => {
    const termo = normalizar(busca)
    return (servidores ?? []).filter(Boolean).filter(servidor => {
      const nome = normalizar(servidor.nome)
      const funcaoNormalizada = normalizar(servidor.funcao)
      const formacaoNormalizada = normalizar(servidor.formacao)
      const escolasServidor = Array.isArray(servidor.lotacoes) ? servidor.lotacoes : []
      const nomeEscolaServidor = nomeEscolas(servidor).map(normalizar).join(' ')
      const buscaOk = !termo || nome.includes(termo) || funcaoNormalizada.includes(termo) || formacaoNormalizada.includes(termo) || nomeEscolaServidor.includes(termo)
      const grupoOk = !grupo || categoriaFuncao(servidor.funcao) === grupo
      const funcaoOk = !funcao || servidor.funcao === funcao
      const formacaoOk = !formacao || formacaoNormalizada.includes(normalizar(formacao))
      const escolaOk = !escolaId || escolasServidor.some(lotacao => String(lotacao.escola_id) === escolaId)
      const statusOk = !status || servidor.status === status
      const vinculoOk = !vinculo || servidor.tipo_vinculo === vinculo
      return buscaOk && grupoOk && funcaoOk && formacaoOk && escolaOk && statusOk && vinculoOk
    })
  }, [servidores, busca, grupo, funcao, formacao, escolaId, status, vinculo])

  const solicitacoesFiltradas = useMemo(() => {
    const termo = normalizar(buscaSolicitacao)
    return (solicitacoes ?? []).filter(Boolean).filter(item => {
      const nome = normalizar(item.servidor?.nome)
      const origem = normalizar(item.escola_origem?.name)
      const destino = normalizar(item.escola_destino?.name)
      const texto = normalizar(item.observacoes)
      const buscaOk = !termo || nome.includes(termo) || origem.includes(termo) || destino.includes(termo) || texto.includes(termo)
      const statusOk = !statusSolicitacao || item.status === statusSolicitacao
      const destinoOk = !destinoSolicitacao || String(item.escola_destino_id) === destinoSolicitacao
      const inicioOk = !dataPedidoInicio || item.data_pedido >= dataPedidoInicio
      const fimOk = !dataPedidoFim || item.data_pedido <= dataPedidoFim
      return buscaOk && statusOk && destinoOk && inicioOk && fimOk
    })
  }, [solicitacoes, buscaSolicitacao, statusSolicitacao, destinoSolicitacao, dataPedidoInicio, dataPedidoFim])

  function limparFiltrosServidores() {
    setModelo('todos'); setBusca(''); setGrupo(''); setFuncao(''); setFormacao(''); setEscolaId(''); setStatus(''); setVinculo('')
  }

  function limparFiltrosSolicitacoes() {
    setBuscaSolicitacao(''); setStatusSolicitacao(''); setDestinoSolicitacao(''); setDataPedidoInicio(''); setDataPedidoFim('')
  }

  function aplicarModelo(id) {
    setModelo(id); setBusca(''); setFuncao(''); setEscolaId(''); setStatus(''); setVinculo('')
    if (id === 'professores') { setGrupo('Professores'); setFormacao('') }
    else if (id === 'merendeiras') { setGrupo('Merendeiras'); setFormacao('') }
    else if (id === 'portugues') { setGrupo('Professores'); setFormacao('portugues') }
    else if (id === 'matematica') { setGrupo('Professores'); setFormacao('matematica') }
    else { setGrupo(''); setFormacao('') }
  }

  function alterarFiltro(setter, valor) { setModelo('personalizado'); setter(valor) }

  function baixarCsvServidores() {
    const colunas = ['Nome', 'Função', 'Formação', 'Escola(s)', 'Status', 'Vínculo', 'Matrícula', 'Telefone', 'E-mail']
    const linhas = filtered.map(servidor => [servidor.nome || 'Nome não informado', servidor.funcao || 'Não informado', servidor.formacao || 'Não informado', nomeEscolas(servidor).join(' | ') || 'Sem escola', servidor.status || 'Não informado', servidor.tipo_vinculo || 'Não informado', servidor.matricula || 'Não informado', servidor.telefone || 'Não informado', servidor.email || 'Não informado'])
    baixarArquivo(`\uFEFF${[colunas, ...linhas].map(linha => linha.map(csvCell).join(';')).join('\r\n')}`, `relatorio-servidores-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function baixarCsvSolicitacoes() {
    const colunas = ['Servidor', 'Escola de origem', 'Escola de destino', 'Data do pedido', 'Status', 'Data de atendimento', 'Observações']
    const linhas = solicitacoesFiltradas.map(item => [item.servidor?.nome || 'Servidor não informado', item.escola_origem?.name || 'Não informada', item.escola_destino?.name || 'Não informada', formatarData(item.data_pedido), item.status || 'Não informado', formatarData(item.data_atendimento), item.observacoes || ''])
    baixarArquivo(`\uFEFF${[colunas, ...linhas].map(linha => linha.map(csvCell).join(';')).join('\r\n')}`, `relatorio-pedidos-transferencia-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function imprimirPdfServidores() {
    const titulo = MODELOS.find(item => item.id === modelo)?.label || 'Relatório personalizado'
    const linhas = filtered.map(servidor => [servidor.nome || 'Nome não informado', servidor.funcao || 'Não informado', servidor.formacao || 'Não informado', nomeEscolas(servidor).join(' · ') || 'Sem escola', servidor.status || 'Não informado', servidor.tipo_vinculo || 'Não informado'])
    imprimirTabela({ titulo, colunas: ['Nome', 'Função', 'Formação', 'Escola(s)', 'Status', 'Vínculo'], linhas, resumo: 'Relatório de servidores filtrado pelos critérios selecionados no sistema.' })
  }

  function imprimirPdfSolicitacoes() {
    const linhas = solicitacoesFiltradas.map(item => [item.servidor?.nome || 'Servidor não informado', item.escola_origem?.name || 'Não informada', item.escola_destino?.name || 'Não informada', formatarData(item.data_pedido), item.status || 'Não informado', formatarData(item.data_atendimento), item.observacoes || ''])
    imprimirTabela({ titulo: 'Pedidos de transferência', colunas: ['Servidor', 'Origem', 'Destino', 'Data do pedido', 'Status', 'Atendimento', 'Observações'], linhas, resumo: 'Relatório administrativo de pedidos de transferência. Os pedidos não alteram lotações automaticamente.' })
  }

  const filtrosServidorAtivos = [busca, grupo, funcao, formacao, escolaId, status, vinculo].filter(Boolean).length
  const filtrosSolicitacaoAtivos = [buscaSolicitacao, statusSolicitacao, destinoSolicitacao, dataPedidoInicio, dataPedidoFim].filter(Boolean).length
  const emPedidos = tipoRelatorio === 'solicitacoes'
  const loadingAtual = emPedidos ? loadingSolicitacoes : loading
  const totalAtual = emPedidos ? solicitacoesFiltradas.length : filtered.length

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-5">
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Relatórios</h1><p className="text-sm text-slate-500 mt-0.5">Filtre servidores e pedidos para impressão ou análise.</p></div>
        <div className="flex w-full sm:w-auto flex-wrap gap-2 shrink-0">
          <button onClick={emPedidos ? reloadSolicitacoes : reload} className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0" title="Atualizar dados" aria-label="Atualizar dados"><RefreshCw size={16} className="text-slate-500" /></button>
          <button onClick={emPedidos ? baixarCsvSolicitacoes : baixarCsvServidores} disabled={!totalAtual} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 disabled:opacity-40 shrink-0"><FileSpreadsheet size={15} /> CSV</button>
          <button onClick={emPedidos ? imprimirPdfSolicitacoes : imprimirPdfServidores} disabled={!totalAtual} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 shrink-0"><Printer size={15} /> PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl max-w-xl">
        <button onClick={() => setTipoRelatorio('servidores')} className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${!emPedidos ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Users size={15} /> Servidores</button>
        <button onClick={() => setTipoRelatorio('solicitacoes')} className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${emPedidos ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><ArrowRightLeft size={15} /> Pedidos de transferência</button>
      </div>

      {emPedidos ? <>
        <Notice error={solicitacoesError || escolasError} />
        <section className="w-full min-w-0 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setMostrarFiltros(valor => !valor)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"><span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><SlidersHorizontal size={16} /> Filtros de pedidos {filtrosSolicitacaoAtivos > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">{filtrosSolicitacaoAtivos}</span>}</span><span className="text-xs text-slate-400">{mostrarFiltros ? 'Ocultar' : 'Mostrar'}</span></button>
          {mostrarFiltros && <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5"><Search size={15} className="text-slate-400 shrink-0" /><input className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar servidor, escola ou observação..." value={buscaSolicitacao} onChange={event => setBuscaSolicitacao(event.target.value)} />{buscaSolicitacao && <button onClick={() => setBuscaSolicitacao('')} className="p-1 rounded-lg hover:bg-slate-200"><X size={14} className="text-slate-400" /></button>}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Status do pedido</span><select value={statusSolicitacao} onChange={event => setStatusSolicitacao(event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos</option>{STATUS_SOLICITACAO.map(item => <option key={item}>{item}</option>)}</select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Escola de destino</span><select value={destinoSolicitacao} onChange={event => setDestinoSolicitacao(event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todas</option>{(escolas ?? []).filter(Boolean).map(escola => <option key={escola.id} value={escola.id}>{escola.name || 'Escola sem nome'}</option>)}</select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Pedido a partir de</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><Calendar size={14} className="text-slate-400 shrink-0" /><input type="date" value={dataPedidoInicio} onChange={event => setDataPedidoInicio(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none" /></div></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Pedido até</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><Calendar size={14} className="text-slate-400 shrink-0" /><input type="date" value={dataPedidoFim} min={dataPedidoInicio || undefined} onChange={event => setDataPedidoFim(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none" /></div></label>
            </div>
            {filtrosSolicitacaoAtivos > 0 && <button onClick={limparFiltrosSolicitacoes} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"><Filter size={13} /> Limpar filtros</button>}
          </div>}
        </section>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500"><strong className="text-slate-800">{loadingAtual ? '…' : totalAtual}</strong> pedido(s) encontrado(s)</p><p className="hidden sm:block text-xs text-slate-400">PDF para documento · CSV para Excel</p></div>
        {loadingAtual ? <div className="flex items-center justify-center py-20"><RefreshCw size={22} className="animate-spin text-slate-400" /></div> : solicitacoesFiltradas.length === 0 ? <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400"><ArrowRightLeft size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum pedido corresponde aos filtros.</p><p className="text-xs mt-1">Execute a migração de solicitações ou cadastre o primeiro pedido.</p></div> : <>
          <div className="hidden md:block overflow-x-auto bg-white border border-slate-100 rounded-2xl shadow-sm"><table className="w-full text-left"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Servidor', 'Origem', 'Destino', 'Data do pedido', 'Status', 'Atendimento', 'Observações', 'Ações'].map(coluna => <th key={coluna} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{coluna}</th>)}</tr></thead><tbody>{solicitacoesFiltradas.map(item => <tr key={item.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">{item.servidor?.nome || 'Servidor não informado'}</td><td className="px-4 py-3 text-sm text-slate-600">{item.escola_origem?.name || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{item.escola_destino?.name || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{formatarData(item.data_pedido)}</td><td className="px-4 py-3 text-sm text-slate-600">{item.status || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{formatarData(item.data_atendimento)}</td><td className="px-4 py-3 text-sm text-slate-600 max-w-xs">{item.observacoes || '—'}</td><td className="px-4 py-3"><button onClick={() => onEditSolicitacao?.(item)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200"><Edit2 size={12} /> Editar</button></td></tr>)}</tbody></table></div>
          <div className="md:hidden min-w-0 space-y-2">{solicitacoesFiltradas.map(item => <div key={item.id} className="min-w-0 bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm break-words"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{item.servidor?.nome || 'Servidor não informado'}</p><p className="text-xs text-slate-500 mt-1">Destino: {item.escola_destino?.name || 'Não informado'}</p></div><span className="shrink-0 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">{item.status || '—'}</span></div><div className="grid grid-cols-1 gap-1 mt-3 text-xs text-slate-500"><p><strong className="text-slate-400 font-medium">Pedido:</strong> {formatarData(item.data_pedido)}</p><p><strong className="text-slate-400 font-medium">Origem:</strong> {item.escola_origem?.name || 'Não informada'}</p>{item.observacoes && <p><strong className="text-slate-400 font-medium">Observações:</strong> {item.observacoes}</p>} {onEditSolicitacao && <button onClick={() => onEditSolicitacao(item)} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200"><Edit2 size={12} /> Editar pedido</button>}</div></div>)}</div>
        </>}
      </> : <>
        <Notice error={error || escolasError} warning={migrationWarning} />
        <div className="mobile-scroll-x flex gap-2 flex-nowrap pb-1 -mx-1 px-1">{MODELOS.map(item => <button key={item.id} onClick={() => aplicarModelo(item.id)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${modelo === item.id ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}</div>
        <section className="w-full min-w-0 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden"><button onClick={() => setMostrarFiltros(valor => !valor)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"><span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><SlidersHorizontal size={16} /> Filtros avançados {filtrosServidorAtivos > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">{filtrosServidorAtivos}</span>}</span><span className="text-xs text-slate-400">{mostrarFiltros ? 'Ocultar' : 'Mostrar'}</span></button>{mostrarFiltros && <div className="p-4 border-t border-slate-100 space-y-3"><div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5"><Search size={15} className="text-slate-400 shrink-0" /><input className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar por nome, função, formação ou escola..." value={busca} onChange={event => alterarFiltro(setBusca, event.target.value)} />{busca && <button onClick={() => alterarFiltro(setBusca, '')} className="p-1 rounded-lg hover:bg-slate-200"><X size={14} className="text-slate-400" /></button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Grupo de função</span><select value={grupo} onChange={event => alterarFiltro(setGrupo, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os grupos</option><option>Professores</option><option>Merendeiras</option><option>Gestão</option><option>Administrativo</option><option>Apoio</option></select></label><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Função específica</span><select value={funcao} onChange={event => alterarFiltro(setFuncao, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todas as funções</option>{funcoes.map(item => <option key={item}>{item}</option>)}</select></label><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Formação contém</span><input list="formacoes-disponiveis" value={formacao} onChange={event => alterarFiltro(setFormacao, event.target.value)} placeholder="Ex.: Português ou Matemática" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none placeholder:text-slate-300" /><datalist id="formacoes-disponiveis">{formacoes.map(item => <option key={item} value={item} />)}</datalist></label><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Escola</span><select value={escolaId} onChange={event => alterarFiltro(setEscolaId, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todas as escolas</option>{(escolas ?? []).filter(Boolean).map(escola => <option key={escola.id} value={escola.id}>{escola.name || 'Escola sem nome'}</option>)}</select></label><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span><select value={status} onChange={event => alterarFiltro(setStatus, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os status</option><option>Ativo</option><option>Afastado</option><option>Inativo</option></select></label><label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de vínculo</span><select value={vinculo} onChange={event => alterarFiltro(setVinculo, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os vínculos</option><option>Efetivo</option><option>Designação</option><option>Contratado</option><option>Temporário</option><option>Estágio</option></select></label></div>{filtrosServidorAtivos > 0 && <button onClick={limparFiltrosServidores} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"><Filter size={13} /> Limpar filtros</button>}</div>}</section>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500"><strong className="text-slate-800">{loadingAtual ? '…' : totalAtual}</strong> registro(s) encontrado(s)</p><p className="hidden sm:block text-xs text-slate-400">PDF para documento · CSV para Excel</p></div>
        {loadingAtual ? <div className="flex items-center justify-center py-20"><RefreshCw size={22} className="animate-spin text-slate-400" /></div> : filtered.length === 0 ? <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum servidor corresponde aos filtros.</p><p className="text-xs mt-1">Tente limpar um filtro ou usar outra formação.</p></div> : <><div className="hidden md:block overflow-x-auto bg-white border border-slate-100 rounded-2xl shadow-sm"><table className="w-full text-left"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Nome', 'Função', 'Formação', 'Escola(s)', 'Status', 'Vínculo'].map(coluna => <th key={coluna} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{coluna}</th>)}</tr></thead><tbody>{filtered.map(servidor => <tr key={servidor.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">{servidor.nome || 'Nome não informado'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.funcao || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.formacao || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{nomeEscolas(servidor).join(' · ') || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.status || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.tipo_vinculo || '—'}</td></tr>)}</tbody></table></div><div className="md:hidden min-w-0 space-y-2">{filtered.map(servidor => <div key={servidor.id} className="min-w-0 bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm break-words"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 leading-snug">{servidor.nome || 'Nome não informado'}</p><p className="text-xs text-slate-500 mt-1">{servidor.funcao || 'Função não informada'}</p></div><span className="shrink-0 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{servidor.status || '—'}</span></div><div className="grid grid-cols-1 gap-1 mt-3 text-xs text-slate-500"><p><strong className="text-slate-400 font-medium">Formação:</strong> {servidor.formacao || 'Não informada'}</p><p><strong className="text-slate-400 font-medium">Escola(s):</strong> {nomeEscolas(servidor).join(' · ') || 'Sem escola'}</p><p><strong className="text-slate-400 font-medium">Vínculo:</strong> {servidor.tipo_vinculo || 'Não informado'}</p></div></div>)}</div></>}
      </>}
    </div>
  )
}
