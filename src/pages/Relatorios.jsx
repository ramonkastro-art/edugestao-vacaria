import { useMemo, useState } from 'react'
import {
  FileSpreadsheet, Filter, Printer,
  RefreshCw, Search, SlidersHorizontal, Users, X,
} from 'lucide-react'
import { useEscolas, useServidores } from '../hooks/useData'

function normalizar(valor = '') {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
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
  return [...new Set((servidor.lotacoes ?? []).map(lotacao => lotacao.escola?.name).filter(Boolean))]
}

function csvCell(valor = '') {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

function escapeHtml(valor = '') {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[caractere]))
}

const MODELOS = [
  { id: 'todos', label: 'Todos os servidores' },
  { id: 'professores', label: 'Professores' },
  { id: 'merendeiras', label: 'Merendeiras' },
  { id: 'portugues', label: 'Professores · Português' },
  { id: 'matematica', label: 'Professores · Matemática' },
]

function Notice({ error, warning }) {
  if (error) return <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700"><strong>Não foi possível carregar os dados.</strong><p className="text-xs mt-1 break-words">{error}</p></div>
  if (warning) return <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800">Os dados foram carregados em modo compatível. Execute as migrações do histórico para relatórios completos de lotação.</div>
  return null
}

export default function Relatorios() {
  const { servidores, loading, error, migrationWarning, reload } = useServidores()
  const { escolas, error: escolasError } = useEscolas()
  const [modelo, setModelo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [funcao, setFuncao] = useState('')
  const [formacao, setFormacao] = useState('')
  const [escolaId, setEscolaId] = useState('')
  const [status, setStatus] = useState('')
  const [vinculo, setVinculo] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(true)

  const funcoes = useMemo(() => [...new Set(servidores.map(servidor => servidor.funcao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [servidores])
  const formacoes = useMemo(() => [...new Set(servidores.map(servidor => servidor.formacao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [servidores])

  const filtered = useMemo(() => {
    const termo = normalizar(busca)
    return servidores.filter(servidor => {
      const nome = normalizar(servidor.nome)
      const funcaoNormalizada = normalizar(servidor.funcao)
      const formacaoNormalizada = normalizar(servidor.formacao)
      const escolasServidor = servidor.lotacoes ?? []
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

  function limparFiltros() {
    setModelo('todos')
    setBusca('')
    setGrupo('')
    setFuncao('')
    setFormacao('')
    setEscolaId('')
    setStatus('')
    setVinculo('')
  }

  function aplicarModelo(id) {
    setModelo(id)
    setBusca('')
    setFuncao('')
    setEscolaId('')
    setStatus('')
    setVinculo('')
    if (id === 'professores') {
      setGrupo('Professores')
      setFormacao('')
    } else if (id === 'merendeiras') {
      setGrupo('Merendeiras')
      setFormacao('')
    } else if (id === 'portugues') {
      setGrupo('Professores')
      setFormacao('portugues')
    } else if (id === 'matematica') {
      setGrupo('Professores')
      setFormacao('matematica')
    } else {
      setGrupo('')
      setFormacao('')
    }
  }

  function alterarFiltro(setter, valor) {
    setModelo('personalizado')
    setter(valor)
  }

  function linhasExportacao() {
    return filtered.map(servidor => ({
      nome: servidor.nome,
      funcao: servidor.funcao || 'Não informado',
      formacao: servidor.formacao || 'Não informado',
      escolas: nomeEscolas(servidor).join(' | ') || 'Sem escola',
      status: servidor.status || 'Não informado',
      vinculo: servidor.tipo_vinculo || 'Não informado',
      matricula: servidor.matricula || 'Não informado',
      telefone: servidor.telefone || 'Não informado',
      email: servidor.email || 'Não informado',
    }))
  }

  function baixarCsv() {
    const colunas = ['Nome', 'Função', 'Formação', 'Escola(s)', 'Status', 'Vínculo', 'Matrícula', 'Telefone', 'E-mail']
    const linhas = linhasExportacao().map(item => [item.nome, item.funcao, item.formacao, item.escolas, item.status, item.vinculo, item.matricula, item.telefone, item.email])
    const csv = [colunas, ...linhas].map(linha => linha.map(csvCell).join(';')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-servidores-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function imprimirPdf() {
    const janela = window.open('', '_blank', 'width=1100,height=800')
    if (!janela) {
      window.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para exportar o relatório em PDF.')
      return
    }
    const dataGeracao = new Date().toLocaleString('pt-BR')
    const titulo = MODELOS.find(item => item.id === modelo)?.label || 'Relatório personalizado'
    const linhas = linhasExportacao().map(item => `
      <tr>
        <td>${escapeHtml(item.nome)}</td>
        <td>${escapeHtml(item.funcao)}</td>
        <td>${escapeHtml(item.formacao)}</td>
        <td>${escapeHtml(item.escolas)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.vinculo)}</td>
      </tr>
    `).join('')
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title><style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; color: #172033; margin: 0; font-size: 10px; }
      header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #172033; padding-bottom: 10px; margin-bottom: 12px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 12px; font-weight: normal; color: #64748b; margin: 0; }
      .meta { text-align: right; color: #64748b; line-height: 1.5; }
      .summary { background: #f1f5f9; padding: 8px 10px; margin-bottom: 12px; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #172033; color: white; text-align: left; font-size: 9px; padding: 7px 6px; }
      td { border-bottom: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
      tr:nth-child(even) td { background: #f8fafc; }
      footer { margin-top: 12px; color: #94a3b8; font-size: 9px; }
    </style></head><body>
      <header><div><h1>EduGestão · Vacaria/RS</h1><h2>${escapeHtml(titulo)}</h2></div><div class="meta">Gerado em ${escapeHtml(dataGeracao)}<br>${filtered.length} registro(s)</div></header>
      <div class="summary">Relatório filtrado com os critérios selecionados no sistema. Este documento representa os dados disponíveis no momento da emissão.</div>
      <table><thead><tr><th>Nome</th><th>Função</th><th>Formação</th><th>Escola(s)</th><th>Status</th><th>Vínculo</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>'}</tbody></table>
      <footer>EduGestão · Rede Municipal de Ensino · Vacaria/RS</footer>
    </body></html>`)
    janela.document.close()
    janela.focus()
    janela.onafterprint = () => janela.close()
    window.setTimeout(() => janela.print(), 250)
  }

  const totalFiltros = [busca, grupo, funcao, formacao, escolaId, status, vinculo].filter(Boolean).length

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-5">
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Filtre servidores e gere documentos para impressão ou análise.</p>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap gap-2 shrink-0">
          <button onClick={reload} className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0" title="Atualizar dados" aria-label="Atualizar dados"><RefreshCw size={16} className="text-slate-500" /></button>
          <button onClick={baixarCsv} disabled={!filtered.length} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 disabled:opacity-40 shrink-0"><FileSpreadsheet size={15} /> CSV</button>
          <button onClick={imprimirPdf} disabled={!filtered.length} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 shrink-0"><Printer size={15} /> PDF</button>
        </div>
      </div>

      <Notice error={error || escolasError} warning={migrationWarning} />

      <div className="mobile-scroll-x flex gap-2 flex-nowrap pb-1 -mx-1 px-1">
        {MODELOS.map(item => (
          <button key={item.id} onClick={() => aplicarModelo(item.id)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${modelo === item.id ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="w-full min-w-0 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <button onClick={() => setMostrarFiltros(valor => !valor)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><SlidersHorizontal size={16} /> Filtros avançados {totalFiltros > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">{totalFiltros}</span>}</span>
          <span className="text-xs text-slate-400">{mostrarFiltros ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {mostrarFiltros && <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar por nome, função, formação ou escola..." value={busca} onChange={event => alterarFiltro(setBusca, event.target.value)} />
            {busca && <button onClick={() => alterarFiltro(setBusca, '')} className="p-1 rounded-lg hover:bg-slate-200"><X size={14} className="text-slate-400" /></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Grupo de função</span><select value={grupo} onChange={event => alterarFiltro(setGrupo, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os grupos</option><option>Professores</option><option>Merendeiras</option><option>Gestão</option><option>Administrativo</option><option>Apoio</option></select></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Função específica</span><select value={funcao} onChange={event => alterarFiltro(setFuncao, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todas as funções</option>{funcoes.map(item => <option key={item}>{item}</option>)}</select></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Formação contém</span><input list="formacoes-disponiveis" value={formacao} onChange={event => alterarFiltro(setFormacao, event.target.value)} placeholder="Ex.: Português ou Matemática" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none placeholder:text-slate-300" /><datalist id="formacoes-disponiveis">{formacoes.map(item => <option key={item} value={item} />)}</datalist></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Escola</span><select value={escolaId} onChange={event => alterarFiltro(setEscolaId, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todas as escolas</option>{escolas.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}</select></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span><select value={status} onChange={event => alterarFiltro(setStatus, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os status</option><option>Ativo</option><option>Afastado</option><option>Inativo</option></select></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de vínculo</span><select value={vinculo} onChange={event => alterarFiltro(setVinculo, event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none"><option value="">Todos os vínculos</option><option>Efetivo</option><option>Designação</option><option>Contratado</option><option>Temporário</option><option>Estágio</option></select></label>
          </div>
          {totalFiltros > 0 && <button onClick={limparFiltros} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"><Filter size={13} /> Limpar filtros</button>}
        </div>}
      </section>

      <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500"><strong className="text-slate-800">{loading ? '…' : filtered.length}</strong> registro(s) encontrado(s)</p><p className="hidden sm:block text-xs text-slate-400">PDF para documento · CSV para Excel</p></div>

      {loading ? <div className="flex items-center justify-center py-20"><RefreshCw size={22} className="animate-spin text-slate-400" /></div> : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum servidor corresponde aos filtros.</p><p className="text-xs mt-1">Tente limpar um filtro ou usar outra formação.</p></div>
      ) : <>
        <div className="hidden md:block overflow-x-auto bg-white border border-slate-100 rounded-2xl shadow-sm"><table className="w-full text-left"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Nome', 'Função', 'Formação', 'Escola(s)', 'Status', 'Vínculo'].map(coluna => <th key={coluna} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{coluna}</th>)}</tr></thead><tbody>{filtered.map(servidor => <tr key={servidor.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">{servidor.nome}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.funcao || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.formacao || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{nomeEscolas(servidor).join(' · ') || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.status || '—'}</td><td className="px-4 py-3 text-sm text-slate-600">{servidor.tipo_vinculo || '—'}</td></tr>)}</tbody></table></div>
        <div className="md:hidden min-w-0 space-y-2">{filtered.map(servidor => <div key={servidor.id} className="min-w-0 bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm break-words"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 leading-snug">{servidor.nome}</p><p className="text-xs text-slate-500 mt-1">{servidor.funcao || 'Função não informada'}</p></div><span className="shrink-0 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{servidor.status || '—'}</span></div><div className="grid grid-cols-1 gap-1 mt-3 text-xs text-slate-500"><p><strong className="text-slate-400 font-medium">Formação:</strong> {servidor.formacao || 'Não informada'}</p><p><strong className="text-slate-400 font-medium">Escola(s):</strong> {nomeEscolas(servidor).join(' · ') || 'Sem escola'}</p><p><strong className="text-slate-400 font-medium">Vínculo:</strong> {servidor.tipo_vinculo || 'Não informado'}</p></div></div>)}</div>
      </>}
    </div>
  )
}
