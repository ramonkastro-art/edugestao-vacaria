import Footer from "./components/Footer";
import { useState, useMemo, useEffect } from "react";
import {
  Search, School, Users, Home, FileText, LogOut, UserPlus, Edit2,
  CheckCircle2, AlertCircle, ArrowRightLeft, X,
  Menu, ChevronRight, GraduationCap, Briefcase,
  Loader2, RefreshCw, Shield, UserCog, Phone,
  MapPin, Calendar, Hash, Info, Clock,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import NovoCadastro from "./pages/NovoCadastro";
import EditarServidor from "./pages/EditarServidor";
import {
  useEscolas, useServidoresUnificados, useProfessoresByEscola,
  useEfetividade, useDashboardStats, buscarGlobal,
} from "./hooks/useData";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  EMEI: "bg-violet-50 text-violet-700 border-violet-200",
  EMEF: "bg-blue-50 text-blue-700 border-blue-200",
  "EMEF Campo": "bg-emerald-50 text-emerald-700 border-emerald-200",
  SMED: "bg-rose-50 text-rose-700 border-rose-200",
};
const OCORRENCIAS = [
  "Falta","Licença Médica","Licença Maternidade",
  "Licença Prêmio","Substituição","Afastamento",
];

function mesAnoAtual() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}
function mesAnoLabel(s) {
  if (!s) return "";
  const [ano,mes] = s.split("-");
  const m = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${m[parseInt(mes)-1]} / ${ano}`;
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────

function initials(name="") {
  return name.split(" ").filter(Boolean).slice(0,2).map(n=>n[0]).join("").toUpperCase();
}
function Badge({ children, className="" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}
function AvatarCircle({ name="", size="md" }) {
  const sizes = { sm:"w-8 h-8 text-xs", md:"w-10 h-10 text-sm", lg:"w-14 h-14 text-base" };
  const cols = [
    "bg-blue-100 text-blue-700","bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700","bg-cyan-100 text-cyan-700",
  ];
  return (
    <div className={`${sizes[size]} ${cols[(name.charCodeAt(0)||0)%cols.length]} rounded-xl flex items-center justify-center font-semibold shrink-0`}>
      {initials(name)}
    </div>
  );
}
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-slate-400"/>
    </div>
  );
}
function RoleBadge({ role }) {
  const map = {
    secretaria:{l:"Secretaria",c:"bg-violet-50 text-violet-700 border-violet-200"},
    rh:{l:"RH",c:"bg-blue-50 text-blue-700 border-blue-200"},
    diretor:{l:"Diretor",c:"bg-emerald-50 text-emerald-700 border-emerald-200"},
    professor:{l:"Professor",c:"bg-slate-100 text-slate-600 border-slate-200"},
  };
  const {l,c} = map[role]||map.professor;
  return <Badge className={c}><Shield size={10}/>{l}</Badge>;
}
function isAdmin(profile) {
  return profile?.role==="secretaria"||profile?.role==="rh";
}

// ─── BOTTOM NAV MOBILE ───────────────────────────────────────────────────────

function BottomNav({ currentView, onNavigate }) {
  const items = [
    {id:"dashboard",  label:"Início",    icon:Home},
    {id:"schools",    label:"Unidades",  icon:School},
    {id:"servidores", label:"Servidores",icon:Users},
    {id:"efe",        label:"EFE",       icon:CheckCircle2},
    {id:"relatorios", label:"Relatórios",icon:FileText},
  ];
  const activeId = currentView==="school-detail"?"schools":currentView;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 flex md:hidden safe-area-bottom">
      {items.map(({id,label,icon:Icon})=>(
        <button key={id} onClick={()=>onNavigate(id)}
          className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-3 transition-colors ${activeId===id?"text-slate-900":"text-slate-400"}`}>
          <Icon size={21} strokeWidth={activeId===id?2.5:1.8}/>
          <span className="text-[10px] leading-none font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── SERVIDOR MODAL UNIFICADO ─────────────────────────────────────────────────
// Um único modal com 3 botões: Transferir | Histórico | Mais Dados
// "Mais Dados" expande uma seção inline com dados cadastrais

function ServidorModal({ servidor, onClose, canTransfer, onEdit }) {
  const [tab, setTab] = useState("nomeacoes");
  const [cadastroExtra, setCadastroExtra] = useState(null);

  // Se veio sem cadastro (ex: SchoolQuadro), busca pelo nome no Supabase
  useEffect(() => {
    if (!servidor || servidor.cadastro) { setCadastroExtra(null); return; }
    const nomeNorm = (servidor.nome || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    supabase
      .from('servidores_unificado')
      .select('*')
      .eq('nome_normalizado', nomeNorm)
      .maybeSingle()
      .then(({ data }) => { if (data) setCadastroExtra(data); });
  }, [servidor]);

  if (!servidor) return null;
  const cadastroFinal = servidor.cadastro ?? cadastroExtra;

  const nomeacoes  = servidor.nomeacoes ?? [];
  const cadastro   = cadastroFinal ?? null;
  const escolas    = cadastro?.escola_raw
    ? cadastro.escola_raw.split(",").map(e=>e.trim()).filter(Boolean)
    : [];

  // Escolas das nomeações formais (tabela professores)
  const escolasNomeacao = [...new Set(
    nomeacoes.filter(n=>n.escola?.name).map(n=>n.escola.name)
  )];

  // Para exibir escola na aba nomeações mesmo sem nomeação formal
  const escolasVisiveis = escolasNomeacao.length > 0
    ? escolasNomeacao
    : escolas;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md md:mx-4 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
        onClick={e=>e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200"/>
        </div>

        {/* Header */}
        <div className="relative bg-slate-950 px-6 py-5">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <X size={16} className="text-white"/>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white">
              {initials(servidor.nome)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white leading-snug">{servidor.nome}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${servidor.status==="Ativo"?"bg-emerald-500/20 text-emerald-300":"bg-amber-500/20 text-amber-300"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${servidor.status==="Ativo"?"bg-emerald-400":"bg-amber-400"}`}/>
                  {servidor.status}
                </span>
                {nomeacoes.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    <Briefcase size={10}/>{nomeacoes.length} nomeações
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Escola(s) — sempre visível */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {escolasVisiveis.length > 1 ? "Escolas / Nomeações" : "Escola / Nomeação"}
          </p>
          <div className="space-y-2">
            {escolasVisiveis.length === 0 && (
              <p className="text-sm text-slate-400 italic">Sem escola registrada</p>
            )}
            {nomeacoes.length > 0
              ? nomeacoes.map((n,i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <School size={15} className="text-slate-400 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{n.escola?.name ?? "—"}</p>
                      {n.matricula && <p className="text-xs font-mono text-slate-400 mt-0.5">{n.matricula}</p>}
                      {n.cargo     && <p className="text-xs text-slate-500">{n.cargo}</p>}
                      {n.observacoes && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={11}/>{n.observacoes}
                        </p>
                      )}
                    </div>
                    {n.escola?.tipo && <Badge className={TIPO_COLORS[n.escola.tipo]}>{n.escola.tipo}</Badge>}
                  </div>
                ))
              : escolas.map((e,i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <School size={15} className="text-slate-400 shrink-0"/>
                    <p className="text-sm font-medium text-slate-700">{e}</p>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Seção expansível por tab */}
        {tab === "historico" && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Histórico</p>
            <div className="p-4 bg-slate-50 rounded-2xl text-center">
              <Clock size={24} className="mx-auto mb-2 text-slate-300"/>
              <p className="text-sm text-slate-400">Histórico de movimentações</p>
              <p className="text-xs text-slate-300 mt-1">Em desenvolvimento</p>
            </div>
          </div>
        )}

        {tab === "dados" && cadastro && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dados Pessoais</p>
            {cadastro.data_nascimento && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                <Calendar size={15} className="text-slate-400 shrink-0"/>
                <div>
                  <p className="text-xs text-slate-400">Nascimento</p>
                  <p className="text-sm font-medium text-slate-700">
                    {new Date(cadastro.data_nascimento+"T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            )}
            {cadastro.telefone && (
              <a href={`tel:${cadastro.telefone.replace(/\D/g,"")}`}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                <Phone size={15} className="text-slate-400 shrink-0"/>
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Telefone</p>
                  <p className="text-sm font-medium text-slate-700">{cadastro.telefone}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300"/>
              </a>
            )}
            {cadastro.email && (
              <a href={`mailto:${cadastro.email}`}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                <Hash size={15} className="text-slate-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">E-mail</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{cadastro.email}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0"/>
              </a>
            )}
            {cadastro.endereco && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs text-slate-400">Endereço</p>
                  <p className="text-sm font-medium text-slate-700 leading-snug">{cadastro.endereco}</p>
                </div>
              </div>
            )}
            {!cadastro.data_nascimento && !cadastro.telefone && !cadastro.email && !cadastro.endereco && (
              <p className="text-sm text-slate-400 italic text-center py-4">Nenhum dado cadastral registrado.</p>
            )}
          </div>
        )}

        {tab === "dados" && !cadastro && (
          <div className="px-5 pb-4">
            <div className="p-4 bg-slate-50 rounded-2xl text-center">
              <Info size={24} className="mx-auto mb-2 text-slate-300"/>
              <p className="text-sm text-slate-400">Dados cadastrais não encontrados</p>
              <p className="text-xs text-slate-300 mt-1">Nome não localizado na base cadastral</p>
            </div>
          </div>
        )}

        {/* Botões de ação — 3 opções */}
        <div className="px-5 pb-5 pt-2 flex gap-2">
          {canTransfer && (
            <button
              onClick={() => alert("Módulo de transferência em desenvolvimento")}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all"
            >
              <ArrowRightLeft size={14}/> Transferir
            </button>
          )}
          {canTransfer && onEdit && (
            <button
              onClick={() => onEdit(servidor)}
              className="flex items-center justify-center gap-1.5 px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Edit2 size={14}/>
            </button>
          )}
          <button
            onClick={() => setTab(tab==="historico" ? "nomeacoes" : "historico")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-medium border transition-all active:scale-95 ${tab==="historico"?"bg-slate-900 text-white border-slate-900":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Clock size={14}/> Histórico
          </button>
          <button
            onClick={() => setTab(tab==="dados" ? "nomeacoes" : "dados")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-medium border transition-all active:scale-95 ${tab==="dados"?"bg-slate-900 text-white border-slate-900":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Info size={14}/> Mais Dados
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH OVERLAY — resultado único por servidor ───────────────────────────

function SearchOverlay({ onClose, onOpenServidor, onSelectSchool }) {
  const [query,setQuery]     = useState("");
  const [results,setResults] = useState({ servidores:[], escolas:[] });
  const [searching,setSearching] = useState(false);

  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[onClose]);

  useEffect(()=>{
    if(query.length<2){setResults({servidores:[],escolas:[]});return;}
    setSearching(true);
    const t=setTimeout(async()=>{
      try{const r=await buscarGlobal(query);setResults(r??{servidores:[],escolas:[]});}
      catch(_){setResults({servidores:[],escolas:[]});}
      finally{setSearching(false);}
    },300);
    return()=>clearTimeout(t);
  },[query]);

  const total=(results.servidores?.length??0)+(results.escolas?.length??0);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-start md:justify-center md:pt-20 bg-black/30 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white w-full md:max-w-xl md:mx-4 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200"/>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          {searching
            ?<Loader2 size={16} className="animate-spin text-slate-400 shrink-0"/>
            :<Search size={16} className="text-slate-400 shrink-0"/>
          }
          <input autoFocus
            className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent"
            placeholder="Nome do servidor ou escola..."
            value={query} onChange={e=>setQuery(e.target.value)}/>
          {query
            ?<button onClick={()=>setQuery("")} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-400"/></button>
            :<button onClick={onClose} className="text-xs text-slate-400 px-2 py-1 hover:bg-slate-100 rounded-lg">Fechar</button>
          }
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.length>=2&&!searching&&total===0&&(
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-slate-300 mt-1">Tente partes do nome: "Ana Velho"</p>
            </div>
          )}
          {query.length<2&&(
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Digite ao menos 2 letras</p>
              <p className="text-xs text-slate-300 mt-1">"Ana Velho" encontra "Ana Tshiedel Velho"</p>
            </div>
          )}

          {/* Escolas */}
          {(results.escolas??[]).length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Escolas</p>
              {results.escolas.map(s=>(
                <button key={s.id} onClick={()=>{onSelectSchool(s);onClose();}}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-left transition-colors">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <School size={15} className="text-slate-500"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.tipo}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0"/>
                </button>
              ))}
            </div>
          )}

          {/* Servidores — UM resultado por pessoa */}
          {(results.servidores??[]).length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Servidores</p>
              {results.servidores.map(s=>{
                const escAtual = s.nomeacoes?.length>0
                  ? [...new Set(s.nomeacoes.map(n=>n.escola?.name).filter(Boolean))].join(" · ")
                  : s.cadastro?.escola_raw?.split(",")[0].trim() ?? "—";
                return (
                  <button key={s.id}
                    onClick={()=>{onOpenServidor(s);onClose();}}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-left transition-colors">
                    <AvatarCircle name={s.nome} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{s.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{escAtual}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      Ver ficha <ChevronRight size={12}/>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function Dashboard({ onSelectSchool }) {
  const {stats,loading}=useDashboardStats();
  const {escolas}=useEscolas();
  if(loading)return<Spinner/>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">Rede Municipal · Vacaria–RS · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          {label:"Escolas",     val:stats?.totalEscolas,    icon:School,        bg:"bg-slate-50",  text:"text-slate-800",  ib:"bg-slate-200 text-slate-600"},
          {label:"Professores", val:stats?.totalProfs,      icon:GraduationCap, bg:"bg-blue-50",   text:"text-blue-800",   ib:"bg-blue-200 text-blue-700"},
          {label:"Cadastrais",  val:stats?.totalCadastrais, icon:UserCog,       bg:"bg-violet-50", text:"text-violet-800", ib:"bg-violet-200 text-violet-700"},
          {label:"Duplas",      val:stats?.duplos,          icon:ArrowRightLeft,bg:"bg-amber-50",  text:"text-amber-800",  ib:"bg-amber-200 text-amber-700"},
        ].map(({label,val,icon:Icon,bg,text,ib})=>(
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${ib} flex items-center justify-center mb-2`}><Icon size={15}/></div>
            <p className={`text-2xl font-semibold ${text}`}>{val??"—"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por modalidade</h2>
        <div className="grid grid-cols-3 gap-2">
          {["EMEF","EMEI","EMEF Campo"].map(tipo=>{
            const count=escolas.filter(e=>e.tipo===tipo).length;
            return (
              <div key={tipo} className="p-3 bg-white border border-slate-100 rounded-2xl">
                <Badge className={`${TIPO_COLORS[tipo]} mb-2`}>{tipo}</Badge>
                <p className="text-xl font-semibold text-slate-800">{count}</p>
                <p className="text-xs text-slate-400">{count===1?"escola":"escolas"}</p>
              </div>
            );
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
              <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SCHOOLS GRID ────────────────────────────────────────────────────────────

function SchoolsGrid({ onSelectSchool }) {
  const {escolas,loading}=useEscolas();
  const [tipoFiltro,setTipoFiltro]=useState("Todos");
  const [search,setSearch]=useState("");
  const filtered=useMemo(
    ()=>escolas.filter(s=>(tipoFiltro==="Todos"||s.tipo===tipoFiltro)&&(search===""||s.name.toLowerCase().includes(search.toLowerCase()))),
    [escolas,tipoFiltro,search]
  );
  if(loading)return<Spinner/>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Unidades Escolares</h1>
        <p className="text-sm text-slate-500 mt-0.5">{escolas.length} escolas · Rede Municipal</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Filtrar escolas..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["Todos","EMEF","EMEI","EMEF Campo"].map(t=>(
            <button key={t} onClick={()=>setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${tipoFiltro===t?"bg-slate-900 text-white":"bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {t}
            </button>
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
              <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-3">{escola.name}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1"><Users size={11}/> Ver quadro</span>
              <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-600 transition-colors"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCHOOL QUADRO ───────────────────────────────────────────────────────────

function SchoolQuadro({ escola, onBack, onOpenServidor }) {
  const {professores,loading}=useProfessoresByEscola(escola.id);
  const {efe,salvarEfe,saving}=useEfetividade(escola.id,mesAnoAtual());
  const [search,setSearch]=useState("");
  const filtered=useMemo(
    ()=>professores.filter(p=>search===""||p.nome.toLowerCase().includes(search.toLowerCase())),
    [professores,search]
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
          <ChevronRight size={18} className="text-slate-400 rotate-180"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-slate-900 leading-tight">{escola.name}</h1>
            <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading?"…":`${professores.length} servidores`} · {mesAnoLabel(mesAnoAtual())}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
        <Search size={15} className="text-slate-400"/>
        <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar servidor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch("")}><X size={14} className="text-slate-400"/></button>}
      </div>
      {loading?<Spinner/>:(
        <div className="space-y-2">
          {filtered.length===0&&(
            <div className="text-center py-16 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Nenhum servidor encontrado</p>
            </div>
          )}
          {filtered.map(prof=>{
            const outra=(prof.nomeacoes??[]).find(n=>n.escola?.id!==escola.id);
            const efeProf=efe[prof.id];
            return (
              <div key={prof.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                <div className="cursor-pointer shrink-0"
                  onClick={()=>onOpenServidor({id:prof.id, nome:prof.nome, status:prof.status, nomeacoes:prof.nomeacoes??[], cadastro:null})}>
                  <AvatarCircle name={prof.nome}/>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer"
                  onClick={()=>onOpenServidor({id:prof.id, nome:prof.nome, status:prof.status, nomeacoes:prof.nomeacoes??[], cadastro:null})}>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{prof.nome}</p>
                  {outra&&<p className="text-xs text-slate-400 truncate">+ {outra.escola?.name}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={()=>salvarEfe(prof.id,"ok",null)}
                    className={`p-2 rounded-xl transition-all ${efeProf?.status==="ok"?"bg-emerald-500 text-white":"bg-slate-100 text-slate-500"}`}>
                    <CheckCircle2 size={15}/>
                  </button>
                  <button onClick={()=>salvarEfe(prof.id,"ocorrencia","Falta")}
                    className={`p-2 rounded-xl transition-all ${efeProf?.status==="ocorrencia"?"bg-amber-400 text-white":"bg-slate-100 text-slate-500"}`}>
                    <AlertCircle size={15}/>
                  </button>
                  {saving&&<Loader2 size={13} className="animate-spin text-slate-400"/>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SERVIDORES LIST — lista unificada ───────────────────────────────────────

function ServidoresList({ onOpenServidor }) {
  const {servidores,loading,reload}=useServidoresUnificados();
  const {escolas}=useEscolas();
  const [search,setSearch]=useState("");
  const [debouncedSearch,setDebouncedSearch]=useState("");
  const [escolaFiltro,setEscolaFiltro]=useState("Todas");

  useEffect(()=>{
    const t=setTimeout(()=>setDebouncedSearch(search),300);
    return()=>clearTimeout(t);
  },[search]);

  const filtered=useMemo(()=>{
    const q=(debouncedSearch).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const base=Array.isArray(servidores)?servidores:[];
    return base.filter(s=>{
      const nomeOk = !q || (s.nome||"").normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(q);
      const escolaOk = escolaFiltro==="Todas" ||
        (s.nomeacoes??[]).some(n=>n.escola?.name===escolaFiltro) ||
        (s.cadastro?.escola_raw||"").includes(escolaFiltro);
      return nomeOk && escolaOk;
    });
  },[servidores,debouncedSearch,escolaFiltro]);

  if(loading)return<Spinner/>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Servidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{servidores.length} servidores · rede municipal</p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <RefreshCw size={16} className="text-slate-500"/>
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar por nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch("")}><X size={14} className="text-slate-400"/></button>}
        </div>
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option>Todas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-400">{filtered.length} encontrado{filtered.length!==1?"s":""}</p>
      {filtered.length===0&&!loading&&(
        <div className="text-center py-16 text-slate-400">
          <Users size={32} className="mx-auto mb-2 opacity-30"/>
          <p className="text-sm">Nenhum servidor encontrado</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map(s=>{
          const escAtual=s.nomeacoes?.length>0
            ?[...new Set(s.nomeacoes.map(n=>n.escola?.name).filter(Boolean))].join(" · ")
            :s.cadastro?.escola_raw?.split(",")[0].trim()??"—";
          return (
            <div key={s.id} onClick={()=>onOpenServidor(s)}
              className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 active:bg-slate-50 cursor-pointer transition-all">
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                  {(s.nomeacoes?.length??0)>1&&(
                    <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                      <Briefcase size={10}/> {s.nomeacoes.length}
                    </Badge>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status==="Ativo"?"bg-emerald-500":"bg-amber-400"}`}/>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{escAtual}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0"/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EFE MODULE ──────────────────────────────────────────────────────────────

function EfeModule({ onOpenServidor }) {
  const {servidores,loading}=useServidoresUnificados();
  const {escolas}=useEscolas();
  const [escolaFiltro,setEscolaFiltro]=useState("");
  const [search,setSearch]=useState("");
  const escolaSel=useMemo(()=>escolas.find(e=>e.name===escolaFiltro),[escolas,escolaFiltro]);
  const {efe,salvarEfe,saving}=useEfetividade(escolaSel?.id,mesAnoAtual());

  // EFE só funciona para quem tem nomeação formal (id numérico)
  const filtered=useMemo(()=>{
    const q=search.toLowerCase();
    return servidores
      .filter(s=>
        typeof s.id==="number" && // só professores com nomeação
        (search===""||s.nome.toLowerCase().includes(q))&&
        (escolaFiltro===""||( s.nomeacoes??[]).some(n=>n.escola?.name===escolaFiltro))
      ).slice(0,100);
  },[servidores,search,escolaFiltro]);

  if(loading)return<Spinner/>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Efetividade — EFE</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registro mensal · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <div className="space-y-2">
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option value="">Selecionar escola...</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
        {escolaFiltro&&(
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-400"/>
            <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Buscar servidor..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        )}
      </div>
      {!escolaFiltro&&(
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">
          Selecione uma escola para registrar a efetividade.
        </div>
      )}
      {escolaFiltro&&<p className="text-xs text-slate-400">{filtered.length} servidores {saving&&"· salvando…"}</p>}
      <div className="space-y-2">
        {filtered.map(s=>{
          const esc=[...new Set((s.nomeacoes??[]).map(n=>n.escola?.name).filter(Boolean))];
          const efeS=efe[s.id];
          return (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenServidor(s)}>
                <p className="text-sm font-semibold text-slate-800 truncate">{s.nome}</p>
                <p className="text-xs text-slate-400 truncate">{esc.join(" · ")}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={()=>escolaSel&&salvarEfe(s.id,"ok",null)} disabled={!escolaSel}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${efeS?.status==="ok"?"bg-emerald-500 text-white":"bg-slate-100 text-slate-500"}`}>
                  <CheckCircle2 size={13}/><span className="hidden sm:inline ml-1">OK</span>
                </button>
                <select disabled={!escolaSel}
                  value={efeS?.status==="ocorrencia"?efeS.ocorrencia:""}
                  onChange={e=>escolaSel&&salvarEfe(s.id,"ocorrencia",e.target.value)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium outline-none cursor-pointer disabled:opacity-40 max-w-24 sm:max-w-none ${efeS?.status==="ocorrencia"?"bg-amber-400 text-white":"bg-slate-100 text-slate-500"}`}>
                  <option value="">Ocorrência</option>
                  {OCORRENCIAS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── APP SHELL ───────────────────────────────────────────────────────────────

export default function App() {
  const {user,profile,loading,signOut}=useAuth();
  const admin=isAdmin(profile);
  const {escolas}=useEscolas();
  const [view,setView]=useState("dashboard");
  const [selectedSchool,setSelectedSchool]=useState(null);
  const [selectedServidor,setSelectedServidor]=useState(null);
  const [editServidor,setEditServidor]=useState(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);

  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setSearchOpen(true);}};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);

  if(loading)return(
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-slate-400"/>
    </div>
  );
  if(!user)return<LoginPage/>;

  function handleSelectSchool(escola){setSelectedSchool(escola);setView("school-detail");}
  function navigate(id){setView(id);setSelectedSchool(null);}

  const navItems=[
    {id:"dashboard",  label:"Dashboard",   icon:Home},
    {id:"schools",    label:"Unidades",    icon:School},
    {id:"servidores", label:"Servidores",  icon:Users},
    {id:"efe",        label:"Efetividade", icon:CheckCircle2},
    {id:"relatorios", label:"Relatórios",  icon:FileText},
    {id:"novo",       label:"Novo Cadastro",icon:UserPlus},
  ];
  const currentNavId=view==="school-detail"?"schools":view;
  const sideW=sidebarOpen?"w-56":"w-16";
  const mainML=sidebarOpen?"ml-56":"ml-16";

  return (
    <div className="min-h-screen bg-slate-50" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Sidebar desktop */}
      <aside className={`${sideW} hidden md:flex flex-col bg-white border-r border-slate-100 fixed top-0 left-0 h-screen z-30 transition-all duration-200`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0">
            <GraduationCap size={15} className="text-white"/>
          </div>
          {sidebarOpen&&(
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p>
              <p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${currentNavId===id?"bg-slate-950 text-white font-medium":"text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
              <Icon size={17} className="shrink-0"/>
              {sidebarOpen&&<span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1 shrink-0">
          {sidebarOpen&&profile&&(
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-slate-700 truncate">{profile.nome||user.email}</p>
              <div className="mt-1"><RoleBadge role={profile.role}/></div>
            </div>
          )}
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <LogOut size={17} className="shrink-0"/>
            {sidebarOpen&&<span>Sair</span>}
          </button>
          {sidebarOpen&&(
            <p className="text-center text-xs text-slate-300 pt-2 pb-1">Desenvolvido por Ramon Castro</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`flex flex-col min-h-screen ${mainML} md:transition-all md:duration-200`}>
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-2 px-3 sm:px-4 shrink-0 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={17} className="text-slate-500"/>
          </button>
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center">
              <GraduationCap size={13} className="text-white"/>
            </div>
            <span className="text-sm font-semibold text-slate-800">EduGestão</span>
          </div>
          <button onClick={()=>setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 hover:bg-slate-200 transition-colors min-w-0">
            <Search size={14} className="shrink-0"/>
            <span className="flex-1 text-left truncate text-xs sm:text-sm">Buscar servidor ou escola...</span>
            <kbd className="hidden sm:inline text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono shrink-0">⌘K</kbd>
          </button>
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {initials(profile?.nome||user?.email||"U")}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-5xl w-full">
          {view==="dashboard"     &&<Dashboard onSelectSchool={handleSelectSchool}/>}
          {view==="schools"       &&<SchoolsGrid onSelectSchool={handleSelectSchool}/>}
          {view==="school-detail" &&selectedSchool&&(
            <SchoolQuadro escola={selectedSchool}
              onBack={()=>{setView("schools");setSelectedSchool(null);}}
              onOpenServidor={setSelectedServidor}/>
          )}
          {view==="servidores"    &&<ServidoresList onOpenServidor={setSelectedServidor}/>}
          {view==="efe"           &&<EfeModule onOpenServidor={setSelectedServidor}/>}
          {view==="novo"          &&<NovoCadastro onBack={()=>navigate("dashboard")} escolas={escolas}/> }
          {view==="relatorios"    &&(
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Relatórios · em breve</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <BottomNav currentView={view} onNavigate={navigate}/>

      {searchOpen&&(
        <SearchOverlay
          onClose={()=>setSearchOpen(false)}
          onSelectSchool={handleSelectSchool}
          onOpenServidor={s=>setSelectedServidor(s)}/>
      )}
      {selectedServidor&&!editServidor&&(
        <ServidorModal
          servidor={selectedServidor}
          onClose={()=>setSelectedServidor(null)}
          canTransfer={admin}
          onEdit={s=>{setEditServidor(s);setSelectedServidor(null);}}/>
      )}
      {editServidor&&(
        <EditarServidor
          servidor={editServidor}
          escolas={escolas}
          isAdmin={admin}
          onBack={(res)=>{
            setEditServidor(null);
            if(res?.deleted) setSelectedServidor(null);
          }}/>
      )}
      <Footer/>
    </div>
  );
}
