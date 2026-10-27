import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search, School, Users, Home, FileText, LogOut,
  CheckCircle2, AlertCircle, X, Menu, ChevronRight,
  GraduationCap, Briefcase, Loader2, RefreshCw, Shield,
  UserPlus, Edit2, Filter, ArrowRightLeft,
} from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import { construirLinhasQuadro, normalizarNomeQuadro, obterLinhasMarcadasDaEscola, obterNovosCandidatosDaEscola, obterPendenciasTransferenciaDaEscola, obterSugestaoTransferenciaSegura } from './lib/quadroPreview'
import LoginPage from './pages/LoginPage'
import EditarServidor from './pages/EditarServidor'
import Relatorios from './pages/Relatorios'
import RevisaoCadastros from './pages/RevisaoCadastros'
import RelatorioEfetividade from './pages/RelatorioEfetividade'
import ServidorModal from './components/ServidorModal'
import TransferirLotacaoModal from './components/TransferirLotacaoModal'
import AdicionarHistoricoLotacaoModal from './components/AdicionarHistoricoLotacaoModal'
import EditarHistoricoLotacaoModal from './components/EditarHistoricoLotacaoModal'
import SolicitacaoTransferenciaModal from './components/SolicitacaoTransferenciaModal'
import EfetividadeModule from './components/EfetividadeModule'
import TrocaSenhaObrigatoria from './components/TrocaSenhaObrigatoria'
import {
  useEscolas, useServidores, useServidoresByEscola, useEfetividade, useDashboardStats, buscarGlobal,
} from './hooks/useData'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  EMEI: 'bg-violet-50 text-violet-700 border-violet-200',
  EMEF: 'bg-blue-50 text-blue-700 border-blue-200',
  'EMEF Campo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SMED: 'bg-rose-50 text-rose-700 border-rose-200',
}
const OCORRENCIAS = ['Falta','Licença Médica','Licença Maternidade','Licença Prêmio','Substituição','Afastamento']

function mesAnoAtual() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
}
function mesAnoLabel(s) {
  if (!s) return ''
  const [ano,mes] = s.split('-')
  const m = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${m[parseInt(mes)-1]} / ${ano}`
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────

function initials(name='') {
  return name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase()
}
function Badge({ children, className='' }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{children}</span>
}
function AvatarCircle({ name='', size='md' }) {
  const sizes = { sm:'w-8 h-8 text-xs', md:'w-10 h-10 text-sm', lg:'w-14 h-14 text-base' }
  const cols = ['bg-blue-100 text-blue-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700','bg-cyan-100 text-cyan-700']
  return (
    <div className={`${sizes[size]} ${cols[(name.charCodeAt(0)||0)%cols.length]} rounded-xl flex items-center justify-center font-semibold shrink-0`}>
      {initials(name)}
    </div>
  )
}
function Spinner() {
  return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400"/></div>
}
function DataBanner({ error, migrationWarning }) {
  if (error) return (
    <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
      <p className="font-medium">Não foi possível carregar estes dados.</p>
      <p className="text-xs mt-1 text-red-600 break-words">{error}</p>
    </div>
  )
  if (migrationWarning) return (
    <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
      <p className="font-medium">Dados carregados em modo compatível.</p>
      <p className="text-xs mt-1 text-amber-700">A listagem funciona, mas o histórico e a transferência dependem da execução das migrações do Supabase.</p>
    </div>
  )
  return null
}
function RoleBadge({ role }) {
  const map = {
    secretaria:{l:'Secretaria',c:'bg-violet-50 text-violet-700 border-violet-200'},
    rh:{l:'RH',c:'bg-blue-50 text-blue-700 border-blue-200'},
    diretor:{l:'Diretor',c:'bg-emerald-50 text-emerald-700 border-emerald-200'},
    viewer:{l:'Visualizador',c:'bg-slate-100 text-slate-600 border-slate-200'},
  }
  const {l,c} = map[role]||map.viewer
  return <Badge className={c}><Shield size={10}/>{l}</Badge>
}
function isAdmin(profile) {
  return profile?.role==='secretaria'||profile?.role==='rh'
}

// ─── BOTTOM NAV MOBILE ───────────────────────────────────────────────────────

function BottomNav({ currentView, onNavigate, canCreate }) {
  const items = [
    {id:'dashboard', label:'Visão Geral', icon:Home},
    {id:'schools',   label:'Unidades', icon:School},
    {id:'servidores',label:'Servidores',icon:Users},
    {id:'efe',       label:'EFE',      icon:CheckCircle2},
    ...(canCreate ? [{id:'novo', label:'Novo', icon:UserPlus}] : []),
  ]
  const activeId = currentView==='school-detail'?'schools':currentView
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 flex md:hidden safe-area-bottom">
      {items.map(({id,label,icon:Icon})=>(
        <button key={id} onClick={()=>onNavigate(id)}
          className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-3 transition-colors ${activeId===id?'text-[#0f789c]':'text-slate-400'}`}>
          <Icon size={21} strokeWidth={activeId===id?2.5:1.8}/>
          <span className="text-[10px] leading-none font-medium">{label}</span>
        </button>
      ))}
    </nav>
  )
}

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────

function SearchOverlay({ onClose, onSelectSchool, onOpenServidor }) {
  const [query,setQuery] = useState('')
  const [results,setResults] = useState({servidores:[],escolas:[]})
  const [searchError,setSearchError] = useState('')
  const [searching,setSearching] = useState(false)

  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',h)
    return()=>window.removeEventListener('keydown',h)
  },[onClose])

  useEffect(()=>{
    let cancelada=false
    if(query.length<2){setResults({servidores:[],escolas:[]});setSearchError('');setSearching(false);return()=>{cancelada=true}}
    setSearching(true)
    const t=setTimeout(async()=>{
      try {
        const r=await buscarGlobal(query)
        if(cancelada)return
        setResults(r??{servidores:[],escolas:[]})
        setSearchError(r?.error || '')
      } catch (error) {
        if(cancelada)return
        setResults({servidores:[],escolas:[]})
        setSearchError(error?.message || 'Não foi possível realizar a busca.')
      }
      finally{if(!cancelada)setSearching(false)}
    },300)
    return()=>{cancelada=true;clearTimeout(t)}
  },[query])

  const total=(results.servidores?.length??0)+(results.escolas?.length??0)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-start md:justify-center md:pt-20 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full md:max-w-xl md:mx-4 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200"/></div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          {searching?<Loader2 size={16} className="animate-spin text-slate-400 shrink-0"/>:<Search size={16} className="text-slate-400 shrink-0"/>}
          <input autoFocus type="search" name="busca-global" autoComplete="off" spellCheck="false" data-form-type="other" data-lpignore="true" className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent"
            aria-label="Buscar servidor ou escola" placeholder="Nome do servidor ou escola..." value={query} onChange={e=>setQuery(e.target.value)}/>
          {query?<button onClick={()=>setQuery('')} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-400"/></button>
               :<button onClick={onClose} className="text-xs text-slate-400 px-2 py-1 hover:bg-slate-100 rounded-lg">Fechar</button>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {searchError&&<div className="mx-4 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">{searchError}</div>}
          {query.length>=2&&!searching&&total===0&&!searchError&&(
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-slate-300 mt-1">Tente partes do nome: "Ana Velho"</p>
            </div>
          )}
          {query.length<2&&<div className="px-4 py-8 text-center"><p className="text-sm text-slate-400">Digite ao menos 2 letras</p></div>}
          {(results.escolas??[]).length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Escolas</p>
              {results.escolas.map(s=>(
                <button key={s.id} onClick={()=>{onSelectSchool(s);onClose()}}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-left transition-colors">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><School size={15} className="text-slate-500"/></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700">{s.name}</p><p className="text-xs text-slate-400">{s.tipo}</p></div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0"/>
                </button>
              ))}
            </div>
          )}
          {(results.servidores??[]).length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Servidores</p>
              {results.servidores.map(s=>{
                const escNomes=[...new Set((s.lotacoes??[]).filter(l=>!l.data_fim).map(l=>l.escola?.name).filter(Boolean))]
                return (
                  <button key={s.id} onClick={()=>{onOpenServidor(s);onClose()}}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-left transition-colors">
                    <AvatarCircle name={s.nome} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{s.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{escNomes.join(' · ')||'Sem escola vinculada'}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0"/>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── VISÃO GERAL ───────────────────────────────────────────────────────────────

function VisaoGeral({ onSelectSchool }) {
  const {stats,loading,error:statsError,migrationWarning:statsMigrationWarning}=useDashboardStats()
  const {escolas,error:escolasError}=useEscolas()
  if(loading)return<Spinner/>
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">Rede Municipal · Vacaria–RS · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <DataBanner error={statsError || escolasError} migrationWarning={statsMigrationWarning}/>
      <div className="grid grid-cols-2 gap-3">
        {[
          {label:'Escolas',     val:stats?.totalEscolas,    icon:School,        bg:'brand-card-neutral', text:'text-[#20234f]', ib:'bg-white/70 text-[#0f789c]'},
          {label:'Servidores',  val:stats?.totalServidores, icon:Users,         bg:'brand-card-blue', text:'text-[#0b5e7d]', ib:'bg-white/70 text-[#0f789c]'},
          {label:'Duplas Lot.', val:stats?.duplos,          icon:Briefcase,     bg:'brand-card-orange', text:'text-[#9a4f08]', ib:'bg-white/70 text-[#d96f0d]'},
          {label:'Mês vigente', val:mesAnoLabel(mesAnoAtual()).split('/')[0].trim(), icon:CheckCircle2, bg:'brand-card-green', text:'text-[#287346]', ib:'bg-white/70 text-[#3c9c5a]'},
        ].map(({label,val,icon:Icon,bg,text,ib})=>(
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${ib} flex items-center justify-center mb-2`}><Icon size={15}/></div>
            <p className={`text-2xl font-semibold ${text}`}>{val??'—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por modalidade</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['EMEF','EMEI','EMEF Campo'].map(tipo=>{
            const count=escolas.filter(e=>e.tipo===tipo).length
            return (
              <div key={tipo} className="p-3 bg-white border border-slate-100 rounded-2xl">
                <Badge className={`${TIPO_COLORS[tipo]} mb-2 text-[10px]`}>{tipo}</Badge>
                <p className="text-xl font-semibold text-slate-800">{count}</p>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Todas as unidades cadastradas</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {escolas.map(escola=>(
            <div key={escola.id} onClick={()=>onSelectSchool(escola)}
              className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 active:bg-slate-50 cursor-pointer transition-all">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors shrink-0">
                <School size={14} className="text-slate-500 group-hover:text-white transition-colors"/>
              </div>
              <p className="text-sm font-medium text-slate-700 flex-1 truncate">{escola.name}</p>
              <Badge className={TIPO_COLORS[escola.tipo]??'bg-slate-100 text-slate-600 border-slate-200'}>{escola.tipo}</Badge>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SCHOOLS GRID ────────────────────────────────────────────────────────────

function SchoolsGrid({ onSelectSchool }) {
  const {escolas,loading,error}=useEscolas()
  const [tipoFiltro,setTipoFiltro]=useState('Todos')
  const [search,setSearch]=useState('')
  const filtered=useMemo(()=>escolas.filter(s=>(tipoFiltro==='Todos'||s.tipo===tipoFiltro)&&(search===''||s.name.toLowerCase().includes(search.toLowerCase()))),[escolas,tipoFiltro,search])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Unidades Escolares</h1><p className="text-sm text-slate-500 mt-0.5">{escolas.length} unidades · Rede Municipal</p></div>
      <DataBanner error={error}/>
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="mobile-scroll-x flex gap-1.5 flex-nowrap pb-1 -mx-1 px-1">
          {['Todos','EMEF','EMEI','EMEF Campo','SMED'].map(t=>(
            <button key={t} onClick={()=>setTipoFiltro(t)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${tipoFiltro===t?'bg-slate-900 text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(escola=>(
          <div key={escola.id} onClick={()=>onSelectSchool(escola)}
            className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 active:bg-slate-50 hover:shadow-md cursor-pointer transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors">
                <School size={17} className="text-slate-500 group-hover:text-white transition-colors"/>
              </div>
              <Badge className={TIPO_COLORS[escola.tipo]??'bg-slate-100 text-slate-600 border-slate-200'}>{escola.tipo}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-3">{escola.name}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1"><Users size={11}/> Ver quadro</span>
              <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-600"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SCHOOL QUADRO ───────────────────────────────────────────────────────────

function SchoolQuadro({
  escola,
  onBack,
  onOpenServidor,
  admin = false,
  servidoresConhecidos = [],
  previsaoQuadro = null,
  previsaoLoading = false,
  previsaoError = '',
  onAtualizarPrevia,
  onPrepararCadastro,
  onIniciarTransferencia,
}) {
  const { servidores, loading, reload, error, migrationWarning } = useServidoresByEscola(escola.id)
  const { efe, salvarEfe, saving } = useEfetividade(escola.id, mesAnoAtual())
  const [search, setSearch] = useState('')
  const respostaPrevia = previsaoQuadro?.data ?? null
  const linhasMarcadas = useMemo(
    () => obterLinhasMarcadasDaEscola(respostaPrevia, escola.id),
    [respostaPrevia, escola.id],
  )
  const linhasQuadro = useMemo(
    () => construirLinhasQuadro({
      servidores,
      linhasMarcadas,
      servidoresConhecidos,
      escolaId: escola.id,
    }),
    [servidores, linhasMarcadas, servidoresConhecidos, escola.id],
  )
  const novosCandidatos = useMemo(
    () => obterNovosCandidatosDaEscola(respostaPrevia, escola.id),
    [respostaPrevia, escola.id],
  )
  const pendenciasTransferencia = useMemo(
    () => obterPendenciasTransferenciaDaEscola(respostaPrevia, escola.id),
    [respostaPrevia, escola.id],
  )
  const textoBuscaNormalizado = normalizarNomeQuadro(search)
  const novosCandidatosFiltrados = useMemo(() => novosCandidatos.filter((item) => {
    if (!textoBuscaNormalizado) return true
    const texto = [item.nome_fonte, item.secao, item.atuacao, item.escola_nome, item.linha_excel == null ? '' : `linha ${item.linha_excel}`].filter(Boolean).join(' ')
    return normalizarNomeQuadro(texto).includes(textoBuscaNormalizado)
  }), [novosCandidatos, textoBuscaNormalizado])
  const pendenciasTransferenciaFiltradas = useMemo(() => pendenciasTransferencia.filter((item) => {
    if (!textoBuscaNormalizado) return true
    const escolasEncontradas = Array.isArray(item.encontrado_no_quadro_de) ? item.encontrado_no_quadro_de : []
    const texto = [item.nome_servidor, item.nome_fonte, item.motivo, item.escola_atual_registrada_no_edugestao?.escola_nome, ...escolasEncontradas.map((x) => x?.escola_nome)].filter(Boolean).join(' ')
    return normalizarNomeQuadro(texto).includes(textoBuscaNormalizado)
  }), [pendenciasTransferencia, textoBuscaNormalizado])
  const coberturaGlobalCompleta = respostaPrevia?.resumo?.reconciliacao_global_completa_no_escopo === true
  const filtered = useMemo(() => {
    const consulta = normalizarNomeQuadro(search).toLowerCase()
    if (!consulta) return linhasQuadro
    return linhasQuadro.filter((entrada) => {
      const linha = entrada.linha ?? entrada.revisao ?? {}
      const texto = [
        entrada.nome,
        entrada.servidor?.funcao,
        linha.atuacao,
        linha.secao,
        linha.linha_excel == null ? '' : `linha ${linha.linha_excel}`,
      ].filter(Boolean).join(' ')
      return normalizarNomeQuadro(texto).toLowerCase().includes(consulta)
    })
  }, [linhasQuadro, search])
  const detalhePrevia = Array.isArray(respostaPrevia?.escolas)
    ? respostaPrevia.escolas.find((item) => Number(item?.escola_id) === Number(escola.id))
    : null
  const previaAbrangeEscola = Boolean(detalhePrevia)
  const dataPreviaLabel = previsaoQuadro?.carregadaEm
    ? new Date(previsaoQuadro.carregadaEm).toLocaleString('pt-BR')
    : ''

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0" aria-label="Voltar para as unidades">
          <ChevronRight size={18} className="text-slate-400 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-slate-900 leading-tight">{escola.name}</h1>
            <Badge className={TIPO_COLORS[escola.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>{escola.tipo}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? '…' : `${servidores.length} servidores com lotação ativa no EduGestão`}
            {' · '}{mesAnoLabel(mesAnoAtual())}
          </p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0" aria-label="Atualizar servidores do EduGestão" title="Atualizar dados do EduGestão">
          <RefreshCw size={15} className="text-slate-400" />
        </button>
      </div>

      <DataBanner error={error} migrationWarning={migrationWarning} />

      {admin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2" aria-label="Prévia de revisão de lotações">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Prévia dos quadros atualizados</p>
              <p className="text-xs text-slate-500 mt-1">Consulta manual do Quadro Geral no Drive. Os dados são apenas para conferência e não alteram cadastros ou lotações.</p>
            </div>
            <button
              onClick={onAtualizarPrevia}
              disabled={previsaoLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait shrink-0"
            >
              {previsaoLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />}
              <span>{previsaoLoading ? 'Consultando…' : 'Atualizar prévia'}</span>
            </button>
          </div>
          {previsaoQuadro && (
            <p className="text-xs text-slate-500">
              Última consulta: {dataPreviaLabel || 'horário indisponível'}
              {' · '}{Number(respostaPrevia?.resumo?.linhas_com_marcador_revisao ?? 0)} linhas sinalizadas na prévia global
              {respostaPrevia?.resumo?.escolas_com_erro
                ? ` · ${respostaPrevia.resumo.escolas_com_erro} escola(s) com erro`
                : ''}
            </p>
          )}
          {!previsaoQuadro && !previsaoLoading && !previsaoError && (
            <p className="text-xs text-slate-500">A prévia ainda não foi carregada nesta sessão.</p>
          )}
          {previsaoError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <p className="font-semibold">Não foi possível atualizar a prévia.</p>
              <p className="mt-1 break-words">{previsaoError}</p>
              {previsaoQuadro && <p className="mt-1">Os marcadores abaixo, se houver, pertencem à última consulta concluída em {dataPreviaLabel}.</p>}
            </div>
          )}
        </section>
      )}

      {admin && previsaoQuadro && linhasMarcadas.length > 0 && (
        <div role="note" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>O quadro atualizado indica uma lotação diferente da registrada no EduGestão. Confira antes de realizar qualquer alteração. O vínculo anterior permanece visível; nenhuma transferência ou gravação é feita por esta prévia.</p>
        </div>
      )}

      {admin && previsaoQuadro && !coberturaGlobalCompleta && (
        <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          A reconciliação não foi confirmada como completa no escopo elegível desta prévia. Por segurança, esta tela não apresenta nomes como candidatos confiáveis a novo cadastro. Revise a cobertura antes de tratar uma pessoa como nova.
        </div>
      )}

      {admin && previsaoQuadro && pendenciasTransferenciaFiltradas.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-white p-3 space-y-3" aria-label="Pendências de transferência para conferência">
          <div>
            <p className="text-sm font-semibold text-slate-800">Possíveis transferências para conferência</p>
            <p className="text-xs text-slate-500 mt-1">São sugestões do cruzamento entre o EduGestão e o Quadro Geral. Nenhuma lotação é alterada sem confirmação humana no modal de transferência.</p>
          </div>
          {pendenciasTransferenciaFiltradas.map((pendencia, indice) => {
            const sugestao = obterSugestaoTransferenciaSegura(pendencia, servidoresConhecidos)
            const origem = pendencia.escola_atual_registrada_no_edugestao
            const destinos = Array.isArray(pendencia.encontrado_no_quadro_de) ? pendencia.encontrado_no_quadro_de : []
            const nome = pendencia.nome_servidor ?? pendencia.nome_fonte ?? pendencia.nome_no_edugestao ?? 'Servidor a identificar'
            const chave = `${pendencia.tipo ?? pendencia.acao_preliminar ?? 'transferencia'}-${pendencia.servidor_id ?? normalizarNomeQuadro(nome)}-${origem?.escola_id ?? pendencia.escola_id ?? 'sem-origem'}-${indice}`
            return (
              <div key={chave} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><ArrowRightLeft size={16}/></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{nome}</p>
                    {origem?.escola_nome && <p className="text-xs text-slate-600 mt-1">Lotação atual no EduGestão: {origem.escola_nome}</p>}
                    {destinos.length > 0 && <p className="text-xs text-slate-600 mt-1">Encontrado no quadro de: {[...new Set(destinos.map((x) => x?.escola_nome).filter(Boolean))].join(', ') || 'escola(s) a conferir'}</p>}
                    {pendencia.motivo && <p className="text-xs text-amber-900 mt-1">{pendencia.motivo}</p>}
                  </div>
                </div>
                {sugestao ? (
                  <button
                    type="button"
                    onClick={() => onIniciarTransferencia?.(sugestao)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700"
                  >
                    <ArrowRightLeft size={13}/>
                    Abrir transferência para conferência
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-500">Ação guiada indisponível: confirme manualmente a identidade, a lotação de origem e o destino antes de iniciar uma transferência.</p>
                )}
              </div>
            )
          })}
        </section>
      )}

      {admin && previsaoQuadro && coberturaGlobalCompleta && novosCandidatos.length === 0 && (
        <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">A prévia não classificou nenhum nome como candidato confiável a novo cadastro nesta escola. Isso não equivale a uma confirmação de desligamento nem autoriza inserir pessoas automaticamente.</p>
      )}

      {admin && previsaoQuadro && coberturaGlobalCompleta && novosCandidatosFiltrados.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-white p-3 space-y-3" aria-label="Novos nomes para conferência de cadastro">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Novos nomes para conferência</p>
              <Badge className="bg-sky-50 text-sky-700 border-sky-200">{novosCandidatosFiltrados.length}</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">Nomes encontrados no Quadro Geral sem correspondência identificada no cadastro durante uma reconciliação completa do escopo elegível. Ainda não foram cadastrados.</p>
          </div>
          {novosCandidatosFiltrados.map((candidato, indice) => {
            const chave = `${candidato.escola_id}-${candidato.linha_excel ?? 'sem-linha'}-${normalizarNomeQuadro(candidato.nome_fonte)}-${indice}`
            return (
              <div key={chave} className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0"><UserPlus size={16}/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{candidato.nome_fonte}</p>
                      <Badge className="bg-amber-50 text-amber-800 border-amber-200">Conferir cadastro</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Fonte: Quadro Geral atualizado{candidato.linha_excel == null ? '' : ` · linha ${candidato.linha_excel}`}</p>
                    {candidato.secao && <p className="text-xs text-slate-600 mt-1">Seção: {candidato.secao}</p>}
                    {candidato.atuacao && <p className="text-xs text-slate-600 mt-1">Atuação: {candidato.atuacao}</p>}
                    {candidato.motivo && <p className="text-xs text-slate-500 mt-1">{candidato.motivo}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPrepararCadastro?.(candidato)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-sky-200 bg-white text-sky-800 text-xs font-semibold hover:bg-sky-100"
                >
                  <UserPlus size={13}/>
                  Preparar cadastro para conferência
                </button>
                <p className="text-[11px] text-slate-500">O formulário será pré-preenchido. Nenhum registro será criado até você revisar e salvar manualmente.</p>
              </div>
            )
          })}
        </section>
      )}

      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
        <Search size={15} className="text-slate-400" />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar servidor ou atuação…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar servidor, seção ou atuação no quadro"
        />
        {search && <button onClick={() => setSearch('')} aria-label="Limpar busca"><X size={14} className="text-slate-400" /></button>}
      </div>

      {previsaoQuadro && previaAbrangeEscola && linhasMarcadas.length === 0 && (
        <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
          A última prévia não retornou linhas com marcador de revisão para esta escola. Pendências de transferência e candidatos a cadastro, quando houver, são apresentados em seções próprias.
        </p>
      )}

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum servidor ou linha do quadro encontrado</p>
            </div>
          )}
          {filtered.map((entrada) => {
            const srv = entrada.servidor
            if (entrada.tipo === 'servidor' && srv) {
              const outrasEscolas = (srv.lotacoes ?? [])
                .filter((lotacao) => !lotacao.data_fim && lotacao.escola_id !== escola.id)
                .map((lotacao) => lotacao.escola?.name)
                .filter(Boolean)
              const efeS = efe[srv.id]
              return (
                <div key={entrada.chave} className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                  <div className="cursor-pointer shrink-0" onClick={() => onOpenServidor(srv)}>
                    <AvatarCircle name={srv.nome} />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenServidor(srv)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{srv.nome}</p>
                      {entrada.revisao && <Badge className="bg-amber-50 text-amber-800 border-amber-200">⚠ Revisar lotação</Badge>}
                    </div>
                    {srv.funcao && <p className="text-xs text-slate-400 truncate">{srv.funcao}</p>}
                    {entrada.revisao && <p className="text-[11px] text-amber-800 mt-1">Lotação ativa registrada no EduGestão · presença mantida para conferência</p>}
                    {outrasEscolas.length > 0 && <p className="text-xs text-blue-500 truncate">+ {outrasEscolas.join(', ')}</p>}
                  </div>
                  <div className="w-full sm:w-auto flex items-center justify-end gap-1 shrink-0">
                    <button
                      onClick={() => salvarEfe(srv.id, 'ok', null)}
                      aria-label={`Marcar ${srv.nome} sem ocorrência`}
                      title="Sem ocorrência"
                      className={`p-2 rounded-xl transition-all ${efeS?.status === 'ok' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <button
                      onClick={() => salvarEfe(srv.id, 'ocorrencia', 'Falta')}
                      aria-label={`Registrar falta para ${srv.nome}`}
                      title="Registrar falta"
                      className={`p-2 rounded-xl transition-all ${efeS?.status === 'ocorrencia' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      <AlertCircle size={15} />
                    </button>
                    {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
                  </div>
                </div>
              )
            }

            const linha = entrada.linha ?? entrada.revisao ?? {}
            const servidorAssociado = entrada.servidorAssociado ?? null
            const podeAbrirServidor = Boolean(servidorAssociado)
            const origemFonte = entrada.tipo === 'linha-fonte'
            const rotuloOrigem = origemFonte
              ? `Fonte: Quadro Geral atualizado${linha.linha_excel == null ? '' : ` · linha ${linha.linha_excel}`}`
              : 'Presença provisória · lotação ativa registrada no EduGestão'

            return (
              <div key={entrada.chave} className="flex items-start gap-3 p-3 bg-white border border-amber-200 rounded-2xl">
                <div
                  className={`shrink-0 ${podeAbrirServidor ? 'cursor-pointer' : ''}`}
                  onClick={podeAbrirServidor ? () => onOpenServidor(servidorAssociado) : undefined}
                >
                  <AvatarCircle name={entrada.nome} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-semibold text-slate-800 leading-snug ${podeAbrirServidor ? 'cursor-pointer' : ''}`}
                      onClick={podeAbrirServidor ? () => onOpenServidor(servidorAssociado) : undefined}
                    >
                      {entrada.nome || 'Nome não informado'}
                    </p>
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200">⚠ Revisar lotação</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{rotuloOrigem}</p>
                  {linha.secao && <p className="text-xs text-slate-500 mt-1">Seção: {linha.secao}</p>}
                  {linha.atuacao && <p className="text-xs text-slate-600 mt-1">Atuação: {linha.atuacao}</p>}
                  {linha.motivo_marcador && <p className="text-xs text-amber-800 mt-1">{linha.motivo_marcador}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── SERVIDORES LIST ─────────────────────────────────────────────────────────

function ServidoresList({ onOpenServidor, onNovoServidor, onEdit, canEdit, escolaPermitidaId = null, refreshToken }) {
  const {servidores,loading,reload,error,migrationWarning}=useServidores()
  const {escolas}=useEscolas()
  const [search,setSearch]=useState('')
  const [deb,setDeb]=useState('')
  const [escolaFiltro,setEscolaFiltro]=useState('')
  const [statusFiltro,setStatusFiltro]=useState('Ativo')

  useEffect(()=>{const t=setTimeout(()=>setDeb(search),250);return()=>clearTimeout(t)},[search])
  useEffect(()=>{if(refreshToken>0)reload()},[refreshToken,reload])

  const filtered=useMemo(()=>{
    const q=deb.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    return servidores.filter(s=>{
      const nomeOk=!q||s.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)
      const escOk=!escolaFiltro||(s.lotacoes??[]).some(l=>String(l.escola_id)===escolaFiltro)
      const stOk=!statusFiltro||s.status===statusFiltro
      return nomeOk&&escOk&&stOk
    })
  },[servidores,deb,escolaFiltro,statusFiltro])

  if(loading)return<Spinner/>
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="text-xl font-semibold text-slate-900">Servidores</h1><p className="text-sm text-slate-500 mt-0.5">{servidores.length} cadastrados · rede municipal</p></div>
        <div className="flex gap-2 ml-auto">
          <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><RefreshCw size={16} className="text-slate-500"/></button>
          {canEdit && <button onClick={onNovoServidor} className="flex items-center gap-1.5 px-3 py-2 brand-primary text-white rounded-xl text-sm font-medium transition-colors">
            <UserPlus size={15}/> Novo
          </button>}
        </div>
      </div>
      <DataBanner error={error} migrationWarning={migrationWarning}/>
      {!canEdit && <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-600">Seu perfil está em modo de consulta. A edição exige perfil administrativo ou diretora vinculada a uma escola no Supabase.</div>}
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input type="search" name="busca-servidores" autoComplete="off" spellCheck="false" data-form-type="other" data-lpignore="true" className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Buscar servidor por nome" placeholder="Buscar por nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch('')}><X size={14} className="text-slate-400"/></button>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)}
            className="w-full sm:flex-1 px-3 py-3 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
            <option value="">Todas as escolas</option>
            {escolas.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={statusFiltro} onChange={e=>setStatusFiltro(e.target.value)}
            className="w-full sm:w-auto px-3 py-3 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
            <option value="">Todos</option>
            <option>Ativo</option><option>Afastado</option><option>Inativo</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-400">{filtered.length} encontrado{filtered.length!==1?'s':''}</p>
      {filtered.length===0&&!loading&&<div className="text-center py-16 text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Nenhum servidor encontrado</p></div>}
      <div className="space-y-2">
        {filtered.map(s=>{
          const lotacoesAtuais=(s.lotacoes??[]).filter(l=>!l.data_fim)
          const escNomes=[...new Set(lotacoesAtuais.map(l=>l.escola?.name).filter(Boolean))]
          return (
            <div key={s.id} onClick={()=>onOpenServidor(s)}
              className="flex items-center gap-2.5 sm:gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 active:bg-slate-50 cursor-pointer transition-all">
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                  {lotacoesAtuais.length>1&&<Badge className="bg-blue-50 text-blue-600 border-blue-200"><Briefcase size={10}/>{lotacoesAtuais.length}</Badge>}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status==='Ativo'?'bg-emerald-500':s.status==='Afastado'?'bg-amber-400':'bg-slate-300'}`}/>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{escNomes.join(' · ')||'Sem escola vinculada'}</p>
              </div>
              {canEdit && (!escolaPermitidaId || (s.lotacoes ?? []).some(lotacao => String(lotacao.escola_id) === String(escolaPermitidaId) && !lotacao.data_fim)) && (
                <button
                  onClick={event => { event.stopPropagation(); onEdit(s) }}
                  className="inline-flex items-center gap-1.5 p-2.5 sm:px-2.5 sm:py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
                  title="Editar dados do servidor"
                  aria-label={`Editar dados de ${s.nome}`}
                >
                  <Edit2 size={14}/><span className="hidden sm:inline">Editar</span>
                </button>
              )}
              <ChevronRight size={16} className="text-slate-300 shrink-0"/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── APP SHELL ───────────────────────────────────────────────────────────────

// ─── APP SHELL ───────────────────────────────────────────────────────────────

export default function App() {
  const {user,profile,loading,profileLoading,profileError,signOut}=useAuth()
  const admin=isAdmin(profile)
  const diretora=profile?.role==='diretor' && Boolean(profile?.escola_id)
  const podeGerenciarServidor=admin || diretora
  const {escolas}=useEscolas()
  const [view,setView]=useState('dashboard')
  const [selectedSchool,setSelectedSchool]=useState(null)
  const [selectedServidor,setSelectedServidor]=useState(null)
  const [transferServidor,setTransferServidor]=useState(null)
  const [transferSuggestion,setTransferSuggestion]=useState(null)
  const [historicoServidor,setHistoricoServidor]=useState(null)
  const [historicoLotacaoEdit,setHistoricoLotacaoEdit]=useState(null)
  const [solicitacaoTransferenciaEdit,setSolicitacaoTransferenciaEdit]=useState(null)
  const [editServidor,setEditServidor]=useState(null)
  const [editarRetorno,setEditarRetorno]=useState(null)
  const [isNovo,setIsNovo]=useState(false)
  const [novoServidorInicial,setNovoServidorInicial]=useState(null)
  const [searchOpen,setSearchOpen]=useState(false)
  const [sidebarOpen,setSidebarOpen]=useState(true)
  const [dataVersion,setDataVersion]=useState(0)
  const [relatorioEfetividade,setRelatorioEfetividade]=useState({ escolaId: null, mesAno: mesAnoAtual() })
  const [previsaoQuadro,setPrevisaoQuadro]=useState(null)
  const [previsaoLoading,setPrevisaoLoading]=useState(false)
  const [previsaoError,setPrevisaoError]=useState('')
  const previsaoRequestRef=useRef(0)
  const {servidores:allServidores,reload:reloadServidores}=useServidores()

  // A prévia contém dados de várias escolas. Não a mantenha em memória ao sair
  // do perfil administrativo ou trocar a sessão autenticada.
  useEffect(()=>{
    if(!admin || !user?.id){
      previsaoRequestRef.current += 1
      setPrevisaoQuadro(null)
      setPrevisaoError('')
      setPrevisaoLoading(false)
    }
  },[admin,user?.id])

  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearchOpen(true)}}
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[])

  const modalAberto = searchOpen || Boolean(selectedServidor || transferServidor || historicoServidor || historicoLotacaoEdit || solicitacaoTransferenciaEdit || editServidor)

  useEffect(() => {
    const body = document.body
    const raiz = document.documentElement
    const overflowBodyAnterior = body.style.overflow
    const overflowRaizAnterior = raiz.style.overflow
    const paddingAnterior = body.style.paddingRight
    if (modalAberto) {
      const larguraBarra = window.innerWidth - raiz.clientWidth
      body.style.overflow = 'hidden'
      raiz.style.overflow = 'hidden'
      if (larguraBarra > 0) body.style.paddingRight = `${larguraBarra}px`
    }
    return () => {
      body.style.overflow = overflowBodyAnterior
      raiz.style.overflow = overflowRaizAnterior
      body.style.paddingRight = paddingAnterior
    }
  }, [modalAberto])

  if(loading)return<div className="min-h-screen brand-page-bg flex items-center justify-center"><Loader2 size={32} className="animate-spin text-slate-400"/></div>
  if(!user)return<LoginPage/>
  if(profile?.exigir_troca_senha)return<TrocaSenhaObrigatoria/>

  async function atualizarPreviaQuadros(){
    if(!admin || previsaoLoading) return
    const requestId=++previsaoRequestRef.current
    setPrevisaoLoading(true)
    setPrevisaoError('')
    try{
      const {data,error:invokeError}=await supabase.functions.invoke('bright-task',{
        body:{
          modo:'PREVIEW_LOTE_CADASTRO_QUADRO',
          grupos_incluir:['ei','ef'],
          aba_quadro:'Quadro Geral',
        },
      })

      if(invokeError){
        let mensagem=invokeError.message || 'A Edge Function não conseguiu concluir a prévia.'
        const contexto=invokeError.context
        if(contexto && typeof contexto.clone==='function'){
          try{
            const payload=await contexto.clone().json()
            mensagem=payload?.erro || payload?.mensagem || mensagem
          }catch{/* A mensagem original permanece disponível. */}
        }
        throw new Error(mensagem)
      }

      if(!data || data.ok!==true || data.modo!=='PREVIEW_LOTE_CADASTRO_QUADRO'){
        throw new Error(data?.erro || data?.mensagem || 'A resposta não corresponde à prévia de Quadro Geral esperada.')
      }

      // Falhar fechado: só mostrar a resposta se o próprio backend confirmar o
      // modo somente leitura e declarar que nenhuma tabela foi alterada.
      if(data.resumo?.gravacao_realizada!==false || !Array.isArray(data.resumo?.tabelas_alteradas) || data.resumo.tabelas_alteradas.length!==0){
        throw new Error('A resposta não confirmou os indicadores de somente leitura. A prévia não foi exibida; confira a versão implantada da função.')
      }

      const possuiContratoLinhas=Array.isArray(data.quadros_com_revisao) || (
        Array.isArray(data.escolas) && data.escolas.some(escola=>Array.isArray(escola?.linhas_com_marcador_revisao))
      )
      if(!possuiContratoLinhas){
        throw new Error('A resposta não contém quadros_com_revisao nem linhas_com_marcador_revisao. Verifique se a função v7 está implantada.')
      }

      if(requestId!==previsaoRequestRef.current || !admin) return
      setPrevisaoQuadro({data,carregadaEm:new Date().toISOString()})
    }catch(error){
      if(requestId!==previsaoRequestRef.current) return
      setPrevisaoError(error?.message || 'Não foi possível carregar a prévia do Quadro Geral.')
    }finally{
      if(requestId===previsaoRequestRef.current) setPrevisaoLoading(false)
    }
  }

  function handleSelectSchool(escola){setSelectedSchool(escola);setView('school-detail')}
  function navigate(id){setView(id);setSelectedSchool(null)}
  function openRelatorioEfetividade(escolaId, mesAno){
    setRelatorioEfetividade({ escolaId, mesAno })
    setView('relatorio-efetividade')
    setSelectedSchool(null)
  }
  function podeEditarServidor(srv){
    if (admin) return true
    return diretora && (srv?.lotacoes ?? []).some(lotacao => String(lotacao.escola_id) === String(profile.escola_id) && !lotacao.data_fim)
  }
  function openNovoServidor(initialData = null){
    setEditarRetorno(null)
    setIsNovo(true)
    setNovoServidorInicial(initialData && typeof initialData === 'object' ? initialData : null)
    setEditServidor({})
    setSelectedServidor(null)
  }
  function prepararCadastroCandidato(candidato){
    if(!admin || !candidato?.nome_fonte || !candidato?.escola_id) return
    const observacoes = [
      'Origem: candidato encontrado no Quadro Geral atualizado do Google Drive.',
      `Escola da fonte: ${candidato.escola_nome || 'não informada'}.`,
      candidato.linha_excel == null ? '' : `Linha da fonte: ${candidato.linha_excel}.`,
      candidato.secao ? `Seção da fonte: ${candidato.secao}.` : '',
      candidato.atuacao ? `Atuação indicada na fonte: ${candidato.atuacao}.` : '',
      'Cadastro preparado a partir de uma prévia; confirmar identidade e dados funcionais antes de salvar.',
    ].filter(Boolean).join(' ')
    openNovoServidor({ origemPrevia: true, nome: String(candidato.nome_fonte).trim(), escola_id: String(candidato.escola_id), observacoes })
  }
  function iniciarTransferenciaDaPrevia(sugestao){
    if(!admin || !sugestao?.servidor || !sugestao.escolaOrigemId || !sugestao.escolaDestinoId) return
    setSelectedServidor(null)
    setTransferSuggestion({
      origemId: String(sugestao.escolaOrigemId),
      destinoId: String(sugestao.escolaDestinoId),
    })
    setTransferServidor(sugestao.servidor)
  }
  function fecharTransferencia(){
    setTransferServidor(null)
    setTransferSuggestion(null)
  }
  async function concluirTransferencia(){
    setPrevisaoQuadro(null)
    setPrevisaoError('')
    setTransferSuggestion(null)
    return handleDataChanged()
  }
  function openEditServidor(srv){
    // Busca dados completos se vieram da busca (poucos campos).
    // Se o detalhe do servidor já estiver aberto, ele permanece montado atrás da edição.
    const completo = allServidores.find(s=>s.id===srv.id)??srv
    setEditarRetorno(selectedServidor?.id === srv.id ? selectedServidor : null)
    setIsNovo(false)
    setNovoServidorInicial(null)
    setEditServidor(completo)
  }
  function fecharEdicao(restaurar = true){
    const retorno = editarRetorno
    setEditarRetorno(null)
    setEditServidor(null)
    setIsNovo(false)
    setNovoServidorInicial(null)
    if (restaurar && retorno) setSelectedServidor(retorno)
  }
  async function handleDataChanged(){
    setDataVersion(version => version + 1)
    return reloadServidores()
  }
  function handleEditorSaved(){
    const retorno = editarRetorno
    const cadastroNovoConcluido = isNovo
    setEditarRetorno(null)
    setEditServidor(null)
    setIsNovo(false)
    setNovoServidorInicial(null)
    if (cadastroNovoConcluido) {
      // A prévia contém candidatos antigos; após criar o servidor, exigir atualização manual.
      setPrevisaoQuadro(null)
      setPrevisaoError('')
    }
    if (!retorno) {
      setSelectedServidor(null)
      void handleDataChanged()
      return
    }
    setSelectedServidor(retorno)
    void handleDataChanged().then(lista => {
      const atualizado = lista?.find(s => s.id === retorno.id)
      if (atualizado) setSelectedServidor(atualizado)
    })
  }

  const navItems=[
    {id:'dashboard',  label:'Visão Geral', icon:Home},
    {id:'schools',    label:'Unidades',   icon:School},
    {id:'servidores', label:'Servidores', icon:Users},
    {id:'efe',        label:'Efetividade',icon:CheckCircle2},
    {id:'relatorios', label:'Relatórios', icon:FileText},
    {id:'revisao', label:'Revisar cadastros', icon:AlertCircle},
  ]
  const currentNavId=view==='school-detail'?'schools':view
  const sideW=sidebarOpen?'w-56':'w-16'
  const mainML=sidebarOpen?'md:ml-56':'md:ml-16'

  return (
    <div className="min-h-screen brand-page-bg" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Sidebar desktop */}
      <aside className={`${sideW} hidden md:flex flex-col bg-white border-r border-slate-100 fixed top-0 left-0 h-screen z-30 transition-all duration-200`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl brand-sidebar-mark flex items-center justify-center shrink-0">
            <GraduationCap size={15} className="text-white"/>
          </div>
          {sidebarOpen&&<div className="overflow-hidden"><p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p><p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p></div>}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${currentNavId===id?'brand-nav-active text-white font-medium':'text-slate-500 hover:bg-[#eef6f7] hover:text-[#0b5e7d]'}`}>
              <Icon size={17} className="shrink-0"/>{sidebarOpen&&<span>{label}</span>}
            </button>
          ))}
          {sidebarOpen&&podeGerenciarServidor&&(
            <button onClick={() => openNovoServidor()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-emerald-600 hover:bg-emerald-50 transition-all mt-2">
              <UserPlus size={17} className="shrink-0"/><span>Novo Servidor</span>
            </button>
          )}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1 shrink-0">
          {sidebarOpen&&profile&&<div className="px-3 py-2"><p className="text-xs font-medium text-slate-700 truncate">{profile.nome||user.email}</p><div className="mt-1"><RoleBadge role={profile.role}/></div></div>}
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <LogOut size={17} className="shrink-0"/>{sidebarOpen&&<span>Sair</span>}
          </button>
          {sidebarOpen&&<p className="text-center text-xs text-slate-300 pt-1 pb-0.5">Desenvolvido por Ramon Castro</p>}
        </div>
      </aside>

      {/* Main */}
      <div className={`flex flex-col min-h-screen ${mainML} md:transition-all md:duration-200`}>
        <header className="h-14 bg-white brand-header flex items-center gap-2 px-3 sm:px-4 shrink-0 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="hidden md:flex p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={17} className="text-slate-500"/>
          </button>
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg brand-sidebar-mark flex items-center justify-center"><GraduationCap size={13} className="text-white"/></div>
            <span className="text-sm font-semibold text-slate-800">EduGestão</span>
          </div>
          <button onClick={()=>setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2 brand-search rounded-xl text-sm text-slate-500 hover:bg-slate-200 transition-colors min-w-0">
            <Search size={14} className="shrink-0"/>
            <span className="flex-1 text-left truncate text-xs sm:text-sm">Buscar servidor ou escola...</span>
            <kbd className="hidden sm:inline text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono shrink-0">⌘K</kbd>
          </button>
          <div className="w-8 h-8 rounded-xl brand-sidebar-mark flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {initials(profile?.nome||user?.email||'U')}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-5xl w-full">
          {!profileLoading && !profile && user && (
            <div className="mb-5 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
              <p className="font-medium">Perfil de acesso não encontrado.</p>
              <p className="text-xs mt-1">A visualização pode funcionar, mas os botões de edição ficam bloqueados. Crie ou ajuste o registro deste usuário em `user_profiles` no Supabase. {profileError && `Detalhe: ${profileError}`}</p>
            </div>
          )}
          {view==='dashboard'&&<VisaoGeral onSelectSchool={handleSelectSchool}/>}
          {view==='schools'&&<SchoolsGrid onSelectSchool={handleSelectSchool}/>}
          {view==='school-detail'&&selectedSchool&&<SchoolQuadro key={dataVersion} escola={selectedSchool} onBack={()=>{setView('schools');setSelectedSchool(null)}} onOpenServidor={setSelectedServidor} admin={admin} servidoresConhecidos={allServidores} previsaoQuadro={previsaoQuadro} previsaoLoading={previsaoLoading} previsaoError={previsaoError} onAtualizarPrevia={atualizarPreviaQuadros} onPrepararCadastro={prepararCadastroCandidato} onIniciarTransferencia={iniciarTransferenciaDaPrevia}/>}
          {view==='servidores'&&<ServidoresList onOpenServidor={setSelectedServidor} onNovoServidor={() => openNovoServidor()} onEdit={openEditServidor} canEdit={podeGerenciarServidor} escolaPermitidaId={diretora ? profile?.escola_id : null} refreshToken={dataVersion}/>}
          {view==='efe'&&<EfetividadeModule onOpenServidor={setSelectedServidor} onOpenRelatorio={openRelatorioEfetividade} canEdit={podeGerenciarServidor} escolaPermitidaId={diretora ? profile?.escola_id : null}/>}
          {view==='relatorio-efetividade'&&<RelatorioEfetividade
            escolaInicialId={relatorioEfetividade.escolaId}
            mesAnoInicial={relatorioEfetividade.mesAno}
            escolaPermitidaId={diretora ? profile?.escola_id : null}
            onBack={()=>setView('efe')}
          />}

          {view==='relatorios'&&<Relatorios onEditSolicitacao={admin ? (item => { const servidor = allServidores.find(s => s.id === item.servidor_id) ?? item.servidor; setSolicitacaoTransferenciaEdit({ servidor, solicitacao: item }) }) : null}/>}
          {view==='revisao'&&<RevisaoCadastros servidores={allServidores} escolas={escolas} onEditServidor={openEditServidor} canEdit={podeGerenciarServidor} refreshToken={dataVersion}/>}
        </main>
      </div>

      <BottomNav currentView={view} onNavigate={navigate} canCreate={podeGerenciarServidor}/>

      {searchOpen&&<SearchOverlay onClose={()=>setSearchOpen(false)} onSelectSchool={handleSelectSchool} onOpenServidor={s=>setSelectedServidor(s)}/>}

      {selectedServidor&&(
        <ServidorModal
          servidor={selectedServidor}
          onClose={()=>setSelectedServidor(null)}
          onEdit={podeEditarServidor(selectedServidor)?openEditServidor:null}
          onTransfer={admin ? (srv => { setSelectedServidor(null); setTransferSuggestion(null); setTransferServidor(srv) }) : null}
          onAddHistorico={admin ? (srv => { setSelectedServidor(null); setHistoricoServidor(srv) }) : null}
          onEditHistorico={admin ? (lotacao => { setHistoricoLotacaoEdit({ servidor: selectedServidor, lotacao }); setSelectedServidor(null) }) : null}
          onAddSolicitacao={admin ? (srv => { setSolicitacaoTransferenciaEdit({ servidor: srv, solicitacao: null }); setSelectedServidor(null) }) : null}
          canEdit={podeEditarServidor(selectedServidor)}
          suspended={Boolean(editServidor)}
        />
      )}

      {transferServidor&&(
        <TransferirLotacaoModal
          servidor={transferServidor}
          escolas={escolas}
          initialOriginId={transferSuggestion?.origemId}
          initialDestinationId={transferSuggestion?.destinoId}
          onClose={fecharTransferencia}
          onSuccess={concluirTransferencia}
        />
      )}

      {historicoServidor&&(
        <AdicionarHistoricoLotacaoModal
          servidor={historicoServidor}
          escolas={escolas}
          onClose={()=>setHistoricoServidor(null)}
          onSuccess={handleDataChanged}
        />
      )}

      {historicoLotacaoEdit&&(
        <EditarHistoricoLotacaoModal
          servidor={historicoLotacaoEdit.servidor}
          lotacao={historicoLotacaoEdit.lotacao}
          onClose={()=>setHistoricoLotacaoEdit(null)}
          onSuccess={()=>{ handleDataChanged(); setHistoricoLotacaoEdit(null) }}
        />
      )}

      {solicitacaoTransferenciaEdit&&(
        <SolicitacaoTransferenciaModal
          servidor={solicitacaoTransferenciaEdit.servidor}
          solicitacao={solicitacaoTransferenciaEdit.solicitacao}
          escolas={escolas}
          onClose={()=>setSolicitacaoTransferenciaEdit(null)}
          onSuccess={()=>{ handleDataChanged(); setSolicitacaoTransferenciaEdit(null) }}
        />
      )}

      {editServidor&&(
        <EditarServidor
          servidor={isNovo?null:editServidor}
          isNovo={isNovo}
          initialData={isNovo ? novoServidorInicial : null}
          escolas={escolas}
          onClose={()=>fecharEdicao(true)}
          onSaved={handleEditorSaved}
          onDeleted={()=>{handleDataChanged();fecharEdicao(false);setSelectedServidor(null)}}
          escolaPermitidaId={diretora ? profile?.escola_id : null}
          somenteEscola={diretora}
          podeExcluir={admin}
        />
      )}
    </div>
  )
}
