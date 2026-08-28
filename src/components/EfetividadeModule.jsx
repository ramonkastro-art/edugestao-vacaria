import { useMemo, useState } from 'react'
import {
  AlertCircle, Check, CheckCircle2, FileText, RefreshCw,
  Search, Users, X,
} from 'lucide-react'
import { useEscolas, useServidoresByEscola, useEfetividade } from '../hooks/useData'

const OCORRENCIAS = ['Atestado', 'Falta sem atestado', 'Licença', 'Abono', 'Outro motivo de ausência']

const OCORRENCIA_LEGADA = {
  Falta: 'Falta sem atestado',
  Outro: 'Outro motivo de ausência',
}

function rotuloOcorrencia(valor) {
  return OCORRENCIA_LEGADA[valor] ?? valor
}

function mesAnoAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function mesLabel(mesAno) {
  if (!mesAno) return ''
  const [ano, mes] = mesAno.split('-')
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[Number(mes) - 1]} / ${ano}`
}

function iniciais(nome = '') {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase()
}

function StatusAtual({ registro }) {
  if (registro?.status === 'ok') {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold"><CheckCircle2 size={11} /> Tudo OK</span>
  }
  if (registro?.status === 'ocorrencia') {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold"><AlertCircle size={11} /> {rotuloOcorrencia(registro.ocorrencia) || 'Ocorrência'}</span>
  }
  return <span className="inline-flex items-center px-2 py-1 rounded-full border border-dashed border-slate-200 text-slate-400 text-[10px] font-medium">Pendente</span>
}

function ServidorEfetividadeRow({ servidor, registro, disabled, saving, onSave, onOpenServidor }) {
  const [ocorrencia, setOcorrencia] = useState(registro?.status === 'ocorrencia' ? rotuloOcorrencia(registro.ocorrencia ?? '') : '')
  const [observacoes, setObservacoes] = useState(registro?.observacoes ?? '')
  const [mostrarObservacao, setMostrarObservacao] = useState(registro?.status === 'ocorrencia')

  const temOcorrencia = Boolean(ocorrencia)
  const observacaoAlterada = observacoes !== (registro?.observacoes ?? '')

  function salvarTudoOk() {
    onSave({ servidorId: servidor.id, status: 'ok', ocorrencia: null, observacoes: '' })
    setOcorrencia('')
    setObservacoes('')
    setMostrarObservacao(false)
  }

  function selecionarOcorrencia(valor) {
    setOcorrencia(valor)
    setMostrarObservacao(Boolean(valor))
    if (valor) onSave({ servidorId: servidor.id, status: 'ocorrencia', ocorrencia: valor, observacoes })
    else onSave({ servidorId: servidor.id, status: 'pendente', ocorrencia: null, observacoes: '' })
  }

  function salvarObservacao() {
    if (!ocorrencia) return
    onSave({ servidorId: servidor.id, status: 'ocorrencia', ocorrencia, observacoes })
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onOpenServidor?.(servidor)} className="w-10 h-10 rounded-xl bg-[#dff2f4] text-[#0b5e7d] flex items-center justify-center text-xs font-semibold shrink-0 hover:bg-[#c8e9ed] transition-colors" title={`Abrir ${servidor.nome}`}>
          {iniciais(servidor.nome)}
        </button>
        <button type="button" onClick={() => onOpenServidor?.(servidor)} className="flex-1 min-w-0 text-left" title={`Abrir ${servidor.nome}`}>
          <p className="text-sm font-semibold text-slate-800 truncate">{servidor.nome}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{servidor.funcao || 'Função não informada'}</p>
        </button>
        <StatusAtual registro={registro} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 mt-3">
        <select value={ocorrencia} disabled={disabled || saving} onChange={event => selecionarOcorrencia(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#0f789c] disabled:opacity-60">
          <option value="">Sem ocorrência</option>
          {OCORRENCIAS.map(item => <option key={item}>{item}</option>)}
        </select>
        <button type="button" onClick={salvarTudoOk} disabled={disabled || saving} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 ${registro?.status === 'ok' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Tudo OK
        </button>
        {temOcorrencia && <button type="button" onClick={() => setMostrarObservacao(valor => !valor)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"><FileText size={13} /> Observação</button>}
      </div>

      {temOcorrencia && mostrarObservacao && <div className="flex flex-col sm:flex-row gap-2 mt-2"><input value={observacoes} disabled={disabled || saving} onChange={event => setObservacoes(event.target.value)} placeholder={ocorrencia === 'Falta sem atestado' ? 'Informe, se necessário, o motivo ou a observação da direção' : 'Ex.: atestado de 2 dias, protocolo ou observação da direção'} className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#0f789c] disabled:opacity-60" /><button type="button" onClick={salvarObservacao} disabled={disabled || saving || !observacaoAlterada} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl brand-primary text-white text-xs font-semibold disabled:opacity-40"><Check size={13} /> Salvar</button></div>}
    </div>
  )
}

export default function EfetividadeModule({ onOpenServidor, canEdit = false, escolaPermitidaId = null }) {
  const { escolas, loading: loadingEscolas, error: escolasError } = useEscolas()
  const [escolaId, setEscolaId] = useState(escolaPermitidaId ? String(escolaPermitidaId) : '')
  const [mesAno, setMesAno] = useState(mesAnoAtual())
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [salvandoId, setSalvandoId] = useState(null)

  const escolasVisiveis = useMemo(() => escolaPermitidaId ? escolas.filter(escola => String(escola.id) === String(escolaPermitidaId)) : escolas, [escolas, escolaPermitidaId])
  const { servidores, loading: loadingServidores, error: servidoresError, reload: reloadServidores } = useServidoresByEscola(escolaId ? Number(escolaId) : null)
  const { efe, salvarEfe, saving, error: efetividadeError } = useEfetividade(escolaId ? Number(escolaId) : null, mesAno)

  const servidoresAtivos = useMemo(() => servidores.filter(servidor => servidor.status !== 'Inativo'), [servidores])
  const filtrados = useMemo(() => {
    const termo = busca.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return servidoresAtivos.filter(servidor => {
      const nome = servidor.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const registro = efe[servidor.id]
      const nomeOk = !termo || nome.includes(termo)
      const filtroOk = !filtro || (filtro === 'ok' ? registro?.status === 'ok' : filtro === 'ocorrencia' ? registro?.status === 'ocorrencia' : !registro || registro.status === 'pendente')
      return nomeOk && filtroOk
    })
  }, [servidoresAtivos, busca, filtro, efe])

  const total = servidoresAtivos.length
  const tudoOk = servidoresAtivos.filter(servidor => efe[servidor.id]?.status === 'ok').length
  const ocorrencias = servidoresAtivos.filter(servidor => efe[servidor.id]?.status === 'ocorrencia').length
  const pendentes = Math.max(0, total - tudoOk - ocorrencias)
  const erro = escolasError || servidoresError || efetividadeError

  function selecionarEscola(valor) {
    setEscolaId(valor)
    setMensagem('')
  }

  async function salvarRegistro({ servidorId, status, ocorrencia, observacoes }) {
    setSalvandoId(servidorId)
    setMensagem('')
    const resultado = await salvarEfe(servidorId, status, ocorrencia, observacoes)
    setSalvandoId(null)
    if (!resultado.error) setMensagem(status === 'ok' ? 'Registro marcado como Tudo OK.' : status === 'ocorrencia' ? 'Ocorrência registrada na competência.' : 'Registro limpo e voltou para pendente.')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Efetividade</h1><p className="text-sm text-slate-500 mt-1">Conferência mensal da unidade · marque Tudo OK ou registre atestados e ocorrências.</p></div>
        <button type="button" onClick={() => { reloadServidores() }} className="self-start p-2.5 rounded-xl hover:bg-white transition-colors" title="Atualizar servidores" aria-label="Atualizar servidores"><RefreshCw size={16} className="text-slate-500" /></button>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700"><p className="font-medium">Não foi possível carregar a efetividade.</p><p className="text-xs mt-1 break-words">{erro}</p><p className="text-xs mt-2 text-red-600">A tabela mensal existente é usada neste módulo; confira RLS e a migração de segurança se necessário.</p></div>}
      {mensagem && <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-700"><CheckCircle2 size={16} /> {mensagem}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unidade escolar</span><select value={escolaId} onChange={event => selecionarEscola(event.target.value)} disabled={loadingEscolas || Boolean(escolaPermitidaId)} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#0f789c] disabled:opacity-70"><option value="">Selecionar escola...</option>{escolasVisiveis.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}</select></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Competência</span><input type="month" value={mesAno} max={mesAnoAtual()} onChange={event => setMesAno(event.target.value)} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#0f789c]" /></label>
      </div>

      {!escolaId ? (
        <div className="p-6 bg-[#fff3df] border border-[#f8d6a5] rounded-2xl text-sm text-[#8f4d0b]"><p className="font-semibold">Comece selecionando uma escola.</p><p className="text-xs mt-1">A diretora ou gestora confere os servidores da unidade na competência escolhida.</p></div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 bg-[#e7f5f7] border border-[#c7e5ea] rounded-2xl text-sm text-[#0b5e7d]"><FileText size={16} /><span>Competência <strong>{mesLabel(mesAno)}</strong>. Para cada servidor, marque <strong>Tudo OK</strong> ou registre uma ocorrência, como atestado ou falta sem atestado.</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="brand-card-blue rounded-2xl p-4"><Users size={16} className="text-[#0f789c] mb-2" /><p className="text-2xl font-semibold text-[#0b5e7d]">{total}</p><p className="text-xs text-slate-500 mt-0.5">Servidores na unidade</p></div>
            <div className="brand-card-green rounded-2xl p-4"><CheckCircle2 size={16} className="text-[#3c9c5a] mb-2" /><p className="text-2xl font-semibold text-[#287346]">{tudoOk}</p><p className="text-xs text-slate-500 mt-0.5">Tudo OK</p></div>
            <div className="brand-card-orange rounded-2xl p-4"><AlertCircle size={16} className="text-[#d96f0d] mb-2" /><p className="text-2xl font-semibold text-[#9a4f08]">{ocorrencias}</p><p className="text-xs text-slate-500 mt-0.5">Com ocorrência</p></div>
            <div className="brand-card-neutral rounded-2xl p-4"><Users size={16} className="text-[#0f789c] mb-2" /><p className="text-2xl font-semibold text-[#20234f]">{pendentes}</p><p className="text-xs text-slate-500 mt-0.5">Ainda pendentes</p></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2"><div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2.5 flex-1"><Search size={15} className="text-slate-400" /><input type="search" name="busca-efetividade" autoComplete="off" spellCheck="false" data-form-type="other" data-lpignore="true" aria-label="Buscar servidor na efetividade" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar servidor..." className="flex-1 bg-transparent text-sm outline-none" />{busca && <button type="button" onClick={() => setBusca('')}><X size={14} className="text-slate-400" /></button>}</div><select value={filtro} onChange={event => setFiltro(event.target.value)} className="px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-sm text-slate-600 outline-none"><option value="">Todos</option><option value="ok">Tudo OK</option><option value="ocorrencia">Com ocorrência</option><option value="pendente">Pendentes</option></select></div>

          {!canEdit && <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-600">Seu perfil pode consultar a competência, mas o lançamento exige permissão de diretora, Secretaria ou RH.</div>}
          {(loadingServidores || saving) && <div className="flex items-center gap-2 text-xs text-slate-400"><RefreshCw size={14} className="animate-spin" /> Atualizando registros…</div>}
          {loadingServidores ? <div className="flex items-center justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-400" /></div> : filtrados.length === 0 ? <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum servidor corresponde ao filtro.</p></div> : <div className="space-y-2">{filtrados.map(servidor => <ServidorEfetividadeRow key={servidor.id} servidor={servidor} registro={efe[servidor.id]} disabled={!canEdit} saving={saving && salvandoId === servidor.id} onSave={salvarRegistro} onOpenServidor={onOpenServidor} />)}</div>}
        </>
      )}
    </div>
  )
}
