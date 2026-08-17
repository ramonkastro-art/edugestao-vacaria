import { useState, useMemo, useEffect } from 'react'
import {
  Search, School, Users, Home, FileText, LogOut,
  CheckCircle2, AlertCircle, X, Menu, ChevronRight,
  GraduationCap, Briefcase, Loader2, RefreshCw, Shield,
  UserPlus, Edit2, Filter, ArrowRightLeft,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import EditarServidor from './pages/EditarServidor'
import ServidorModal from './components/ServidorModal'
import TransferirLotacaoModal from './components/TransferirLotacaoModal'
import AdicionarHistoricoLotacaoModal from './components/AdicionarHistoricoLotacaoModal'
import {
  useEscolas, useServidores, useServidoresByEscola,
  useEfetividade, useDashboardStats, buscarGlobal,
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
    {id:'dashboard', label:'Início',    icon:Home},
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
          className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-3 transition-colors ${activeId===id?'text-slate-900':'text-slate-400'}`}>
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
    if(query.length<2){setResults({servidores:[],escolas:[]});setSearchError('');return}
    setSearching(true)
    const t=setTimeout(async()=>{
      try {
        const r=await buscarGlobal(query)
        setResults(r??{servidores:[],escolas:[]})
        setSearchError(r?.error || '')
      } catch (error) {
        setResults({servidores:[],escolas:[]})
        setSearchError(error?.message || 'Não foi possível realizar a busca.')
      }
      finally{setSearching(false)}
    },300)
    return()=>clearTimeout(t)
  },[query])

  const total=(results.servidores?.length??0)+(results.escolas?.length??0)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-start md:justify-center md:pt-20 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full md:max-w-xl md:mx-4 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200"/></div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          {searching?<Loader2 size={16} className="animate-spin text-slate-400 shrink-0"/>:<Search size={16} className="text-slate-400 shrink-0"/>}
          <input autoFocus className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent"
            placeholder="Nome do servidor ou escola..." value={query} onChange={e=>setQuery(e.target.value)}/>
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
                const escNomes=[...new Set((s.lotacoes??[]).map(l=>l.escola?.name).filter(Boolean))]
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

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function Dashboard({ onSelectSchool }) {
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
          {label:'Escolas',     val:stats?.totalEscolas,    icon:School,        bg:'bg-slate-50',  text:'text-slate-800',  ib:'bg-slate-200 text-slate-600'},
          {label:'Servidores',  val:stats?.totalServidores, icon:Users,         bg:'bg-blue-50',   text:'text-blue-800',   ib:'bg-blue-200 text-blue-700'},
          {label:'Duplas Lot.', val:stats?.duplos,          icon:Briefcase,     bg:'bg-amber-50',  text:'text-amber-800',  ib:'bg-amber-200 text-amber-700'},
          {label:'Mês vigente', val:mesAnoLabel(mesAnoAtual()).split('/')[0].trim(), icon:CheckCircle2, bg:'bg-emerald-50', text:'text-emerald-800', ib:'bg-emerald-200 text-emerald-700'},
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
          {['EMEF','EMEI','EMEF Campo','SMED'].map(tipo=>{
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
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Todas as unidades</h2>
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

function SchoolQuadro({ escola, onBack, onOpenServidor }) {
  const {servidores,loading,reload,error,migrationWarning}=useServidoresByEscola(escola.id)
  const {efe,salvarEfe,saving}=useEfetividade(escola.id,mesAnoAtual())
  const [search,setSearch]=useState('')
  const filtered=useMemo(()=>servidores.filter(s=>search===''||s.nome.toLowerCase().includes(search.toLowerCase())),[servidores,search])

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
          <ChevronRight size={18} className="text-slate-400 rotate-180"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-slate-900 leading-tight">{escola.name}</h1>
            <Badge className={TIPO_COLORS[escola.tipo]??'bg-slate-100 text-slate-600 border-slate-200'}>{escola.tipo}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{loading?'…':`${servidores.length} servidores`} · {mesAnoLabel(mesAnoAtual())}</p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
          <RefreshCw size={15} className="text-slate-400"/>
        </button>
      </div>
      <DataBanner error={error} migrationWarning={migrationWarning}/>
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
        <Search size={15} className="text-slate-400"/>
        <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar servidor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch('')}><X size={14} className="text-slate-400"/></button>}
      </div>
      {loading?<Spinner/>:(
        <div className="space-y-2">
          {filtered.length===0&&<div className="text-center py-16 text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Nenhum servidor encontrado</p></div>}
          {filtered.map(srv=>{
            const outrasEscolas=(srv.lotacoes??[]).filter(l=>l.escola_id!==escola.id).map(l=>l.escola?.name).filter(Boolean)
            const efeS=efe[srv.id]
            return (
              <div key={srv.id} className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                <div className="cursor-pointer shrink-0" onClick={()=>onOpenServidor(srv)}><AvatarCircle name={srv.nome}/></div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenServidor(srv)}>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{srv.nome}</p>
                  {srv.funcao&&<p className="text-xs text-slate-400 truncate">{srv.funcao}</p>}
                  {outrasEscolas.length>0&&<p className="text-xs text-blue-500 truncate">+ {outrasEscolas.join(', ')}</p>}
                </div>
                <div className="w-full sm:w-auto flex items-center justify-end gap-1 shrink-0">
                  <button onClick={()=>salvarEfe(srv.id,'ok',null)}
                    className={`p-2 rounded-xl transition-all ${efeS?.status==='ok'?'bg-emerald-500 text-white':'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={15}/>
                  </button>
                  <button onClick={()=>salvarEfe(srv.id,'ocorrencia','Falta')}
                    className={`p-2 rounded-xl transition-all ${efeS?.status==='ocorrencia'?'bg-amber-400 text-white':'bg-slate-100 text-slate-500'}`}>
                    <AlertCircle size={15}/>
                  </button>
                  {saving&&<Loader2 size={13} className="animate-spin text-slate-400"/>}
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

function ServidoresList({ onOpenServidor, onNovoServidor, onEdit, canEdit, refreshToken }) {
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
          <button onClick={onNovoServidor} className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            <UserPlus size={15}/> Novo
          </button>
        </div>
      </div>
      <DataBanner error={error} migrationWarning={migrationWarning}/>
      {!canEdit && <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-600">Seu perfil está em modo de consulta. A edição de servidores e vínculos exige role <strong>secretaria</strong> ou <strong>rh</strong> no Supabase.</div>}
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar por nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
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
          const escNomes=[...new Set((s.lotacoes??[]).map(l=>l.escola?.name).filter(Boolean))]
          return (
            <div key={s.id} onClick={()=>onOpenServidor(s)}
              className="flex items-center gap-2.5 sm:gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 active:bg-slate-50 cursor-pointer transition-all">
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                  {(s.lotacoes??[]).length>1&&<Badge className="bg-blue-50 text-blue-600 border-blue-200"><Briefcase size={10}/>{s.lotacoes.length}</Badge>}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status==='Ativo'?'bg-emerald-500':s.status==='Afastado'?'bg-amber-400':'bg-slate-300'}`}/>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{escNomes.join(' · ')||'Sem escola vinculada'}</p>
              </div>
              {canEdit && (
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

// ─── EFE MODULE ──────────────────────────────────────────────────────────────

function EfeModule({ onOpenServidor }) {
  const {servidores,loading,error:servidoresError,migrationWarning}=useServidores()
  const {escolas,error:escolasError}=useEscolas()
  const [escolaFiltro,setEscolaFiltro]=useState('')
  const [search,setSearch]=useState('')
  const escolaSel=useMemo(()=>escolas.find(e=>String(e.id)===escolaFiltro),[escolas,escolaFiltro])
  const {efe,salvarEfe,saving,error:efeError}=useEfetividade(escolaSel?.id,mesAnoAtual())
  const filtered=useMemo(()=>{
    const q=search.toLowerCase()
    return servidores.filter(s=>
      (search===''||s.nome.toLowerCase().includes(q))&&
      (escolaFiltro===''||(s.lotacoes??[]).some(l=>String(l.escola_id)===escolaFiltro))
    ).slice(0,100)
  },[servidores,search,escolaFiltro])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Efetividade — EFE</h1><p className="text-sm text-slate-500 mt-0.5">Registro mensal · {mesAnoLabel(mesAnoAtual())}</p></div>
      <DataBanner error={servidoresError || escolasError || efeError} migrationWarning={migrationWarning}/>
      <div className="space-y-2">
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option value="">Selecionar escola...</option>
          {escolas.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {escolaFiltro&&<div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar servidor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>}
      </div>
      {!escolaFiltro&&<div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">Selecione uma escola para registrar a efetividade.</div>}
      {escolaFiltro&&<p className="text-xs text-slate-400">{filtered.length} servidores {saving&&'· salvando…'}</p>}
      <div className="space-y-2">
        {filtered.map(s=>{
          const efeS=efe[s.id]
          return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenServidor(s)}>
                <p className="text-sm font-semibold text-slate-800 truncate">{s.nome}</p>
                {s.funcao&&<p className="text-xs text-slate-400">{s.funcao}</p>}
              </div>
              <div className="w-full sm:w-auto flex items-center justify-end gap-1.5 shrink-0">
                <button onClick={()=>escolaSel&&salvarEfe(s.id,'ok',null)} disabled={!escolaSel}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${efeS?.status==='ok'?'bg-emerald-500 text-white':'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={13}/><span className="hidden sm:inline ml-1">OK</span>
                </button>
                <select disabled={!escolaSel}
                  value={efeS?.status==='ocorrencia'?efeS.ocorrencia:''}
                  onChange={e=>escolaSel&&salvarEfe(s.id,'ocorrencia',e.target.value)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium outline-none cursor-pointer disabled:opacity-40 max-w-24 sm:max-w-none ${efeS?.status==='ocorrencia'?'bg-amber-400 text-white':'bg-slate-100 text-slate-500'}`}>
                  <option value="">Ocorrência</option>
                  {OCORRENCIAS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── APP SHELL ───────────────────────────────────────────────────────────────

export default function App() {
  const {user,profile,loading,profileLoading,profileError,signOut}=useAuth()
  const admin=isAdmin(profile)
  const {escolas}=useEscolas()
  const [view,setView]=useState('dashboard')
  const [selectedSchool,setSelectedSchool]=useState(null)
  const [selectedServidor,setSelectedServidor]=useState(null)
  const [transferServidor,setTransferServidor]=useState(null)
  const [historicoServidor,setHistoricoServidor]=useState(null)
  const [editServidor,setEditServidor]=useState(null)
  const [isNovo,setIsNovo]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [sidebarOpen,setSidebarOpen]=useState(true)
  const [dataVersion,setDataVersion]=useState(0)
  const {servidores:allServidores,reload:reloadServidores}=useServidores()

  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearchOpen(true)}}
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[])

  if(loading)return<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-slate-400"/></div>
  if(!user)return<LoginPage/>

  function handleSelectSchool(escola){setSelectedSchool(escola);setView('school-detail')}
  function navigate(id){setView(id);setSelectedSchool(null)}
  function openNovoServidor(){setIsNovo(true);setEditServidor({});setSelectedServidor(null)}
  function openEditServidor(srv){
    // Busca dados completos se vieram da busca (poucos campos)
    const completo = allServidores.find(s=>s.id===srv.id)??srv
    setIsNovo(false);setEditServidor(completo);setSelectedServidor(null)
  }
  function handleDataChanged(){
    setDataVersion(version => version + 1)
    reloadServidores()
  }

  const navItems=[
    {id:'dashboard',  label:'Dashboard',  icon:Home},
    {id:'schools',    label:'Unidades',   icon:School},
    {id:'servidores', label:'Servidores', icon:Users},
    {id:'efe',        label:'Efetividade',icon:CheckCircle2},
    {id:'relatorios', label:'Relatórios', icon:FileText},
  ]
  const currentNavId=view==='school-detail'?'schools':view
  const sideW=sidebarOpen?'w-56':'w-16'
  const mainML=sidebarOpen?'ml-56':'ml-16'

  return (
    <div className="min-h-screen bg-slate-50" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Sidebar desktop */}
      <aside className={`${sideW} hidden md:flex flex-col bg-white border-r border-slate-100 fixed top-0 left-0 h-screen z-30 transition-all duration-200`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0">
            <GraduationCap size={15} className="text-white"/>
          </div>
          {sidebarOpen&&<div className="overflow-hidden"><p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p><p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p></div>}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${currentNavId===id?'bg-slate-950 text-white font-medium':'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              <Icon size={17} className="shrink-0"/>{sidebarOpen&&<span>{label}</span>}
            </button>
          ))}
          {sidebarOpen&&admin&&(
            <button onClick={openNovoServidor}
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
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-2 px-3 sm:px-4 shrink-0 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="hidden md:flex p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={17} className="text-slate-500"/>
          </button>
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center"><GraduationCap size={13} className="text-white"/></div>
            <span className="text-sm font-semibold text-slate-800">EduGestão</span>
          </div>
          <button onClick={()=>setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 hover:bg-slate-200 transition-colors min-w-0">
            <Search size={14} className="shrink-0"/>
            <span className="flex-1 text-left truncate text-xs sm:text-sm">Buscar servidor ou escola...</span>
            <kbd className="hidden sm:inline text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono shrink-0">⌘K</kbd>
          </button>
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-semibold text-white shrink-0">
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
          {view==='dashboard'&&<Dashboard onSelectSchool={handleSelectSchool}/>}
          {view==='schools'&&<SchoolsGrid onSelectSchool={handleSelectSchool}/>}
          {view==='school-detail'&&selectedSchool&&<SchoolQuadro key={dataVersion} escola={selectedSchool} onBack={()=>{setView('schools');setSelectedSchool(null)}} onOpenServidor={setSelectedServidor}/>}
          {view==='servidores'&&<ServidoresList onOpenServidor={setSelectedServidor} onNovoServidor={openNovoServidor} onEdit={openEditServidor} canEdit={admin} refreshToken={dataVersion}/>}
          {view==='efe'&&<EfeModule onOpenServidor={setSelectedServidor}/>}
          {view==='relatorios'&&<div className="flex items-center justify-center h-64 text-slate-400"><div className="text-center"><FileText size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Relatórios · em breve</p></div></div>}
        </main>
      </div>

      <BottomNav currentView={view} onNavigate={navigate} canCreate={admin}/>

      {searchOpen&&<SearchOverlay onClose={()=>setSearchOpen(false)} onSelectSchool={handleSelectSchool} onOpenServidor={s=>setSelectedServidor(s)}/>}

      {selectedServidor&&!editServidor&&(
        <ServidorModal
          servidor={selectedServidor}
          onClose={()=>setSelectedServidor(null)}
          onEdit={admin?openEditServidor:null}
          onTransfer={admin ? (srv => { setSelectedServidor(null); setTransferServidor(srv) }) : null}
          onAddHistorico={admin ? (srv => { setSelectedServidor(null); setHistoricoServidor(srv) }) : null}
          canEdit={admin}
        />
      )}

      {transferServidor&&(
        <TransferirLotacaoModal
          servidor={transferServidor}
          escolas={escolas}
          onClose={()=>setTransferServidor(null)}
          onSuccess={handleDataChanged}
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

      {editServidor&&(
        <EditarServidor
          servidor={isNovo?null:editServidor}
          isNovo={isNovo}
          escolas={escolas}
          onClose={()=>{setEditServidor(null);setIsNovo(false)}}
          onSaved={()=>{handleDataChanged();setEditServidor(null);setIsNovo(false)}}
          onDeleted={()=>{handleDataChanged();setEditServidor(null);setSelectedServidor(null)}}
        />
      )}
    </div>
  )
}
