import Footer from "./components/Footer";
import { useState, useMemo, useEffect } from "react";
import {
  Search, School, Users, Home, FileText, LogOut,
  CheckCircle2, AlertCircle, ArrowRightLeft, X,
  Menu, ChevronRight, GraduationCap, Briefcase,
  Loader2, RefreshCw, Shield, UserCog, Phone,
  MapPin, Calendar, Hash, ExternalLink, Info,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import {
  useEscolas, useProfessores, useProfessoresByEscola,
  useEfetividade, useDashboardStats, buscarGlobal,
  useServidores, useServidorDetalhes,
} from "./hooks/useData";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  EMEI: "bg-violet-50 text-violet-700 border-violet-200",
  EMEF: "bg-blue-50 text-blue-700 border-blue-200",
  "EMEF Campo": "bg-emerald-50 text-emerald-700 border-emerald-200",
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
    secretaria: { l:"Secretaria", c:"bg-violet-50 text-violet-700 border-violet-200" },
    rh:         { l:"RH",         c:"bg-blue-50 text-blue-700 border-blue-200" },
    diretor:    { l:"Diretor",    c:"bg-emerald-50 text-emerald-700 border-emerald-200" },
    professor:  { l:"Professor",  c:"bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { l, c } = map[role] || map.professor;
  return <Badge className={c}><Shield size={10}/>{l}</Badge>;
}
function isAdmin(profile) {
  return profile?.role === "secretaria" || profile?.role === "rh";
}

// ─── PROFESSOR MODAL (visualização completa) ─────────────────────────────────

function ProfessorModal({ prof, onClose, canTransfer }) {
  if (!prof) return null;
  const nomeacoes = prof.nomeacoes ?? [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e=>e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-slate-950 p-6">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <X size={16} className="text-white"/>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white">
              {initials(prof.nome)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-snug">{prof.nome}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${prof.status==="Ativo"?"bg-emerald-500/20 text-emerald-300":"bg-amber-500/20 text-amber-300"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prof.status==="Ativo"?"bg-emerald-400":"bg-amber-400"}`}/>
                  {prof.status}
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

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Nomeações */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Unidades / Nomeações</p>
            <div className="space-y-2">
              {nomeacoes.length === 0 && (
                <p className="text-sm text-slate-400 italic">Nenhuma nomeação registrada</p>
              )}
              {nomeacoes.map((n,i) => {
                const escola = n.escola ?? {};
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <School size={15} className="text-slate-400 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{escola.name ?? "—"}</p>
                      {n.matricula && <p className="text-xs font-mono text-slate-400 mt-0.5">{n.matricula}</p>}
                      {n.cargo && <p className="text-xs text-slate-500">{n.cargo}</p>}
                      {n.observacoes && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={11}/>{n.observacoes}
                        </p>
                      )}
                    </div>
                    {escola.tipo && <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carga horária */}
          {(prof.regencia_h || prof.htp_h || prof.hti_h) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Carga Horária</p>
              <div className="grid grid-cols-3 gap-2">
                {[["Regência",prof.regencia_h],["HTP",prof.htp_h],["HTI",prof.hti_h]].map(([l,v]) => (
                  <div key={l} className="bg-slate-50 rounded-2xl p-3 text-center">
                    <p className="text-xl font-semibold text-slate-700">{v ?? "—"}h</p>
                    <p className="text-xs text-slate-400 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formação */}
          {prof.formacao && (
            <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-2xl">
              <GraduationCap size={16} className="text-violet-500 mt-0.5 shrink-0"/>
              <div>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Formação</p>
                <p className="text-sm text-slate-700 mt-0.5">{prof.formacao}</p>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 pt-1">
            {canTransfer && (
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-950 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
                <ArrowRightLeft size={14}/> Transferir
              </button>
            )}
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <FileText size={14}/> Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SERVIDOR MODAL (ficha completa da tabela servidores_unificado) ───────────

function ServidorModal({ servidorId, onClose, canTransfer }) {
  const { servidor, loading, error } = useServidorDetalhes(servidorId);
  if (!servidorId) return null;

  // Parse escolas (campo escola_raw pode ter várias separadas por vírgula)
  const escolas = servidor?.escola_raw
    ? servidor.escola_raw.split(",").map(e => e.trim()).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e=>e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-slate-950 p-6">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <X size={16} className="text-white"/>
          </button>
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-white/50"/>
              </div>
              <p className="text-white/50 text-sm">Carregando…</p>
            </div>
          ) : error ? (
            <p className="text-red-300 text-sm">Erro ao carregar dados.</p>
          ) : servidor ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white">
                {initials(servidor.nome)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white leading-snug">{servidor.nome}</h2>
                <p className="text-white/50 text-xs mt-1">Servidor Municipal</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Body */}
        {!loading && !error && servidor && (
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

            {/* Dados de contato */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dados Pessoais</p>
              <div className="space-y-2">
                {servidor.data_nascimento && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Calendar size={15} className="text-slate-400 shrink-0"/>
                    <div>
                      <p className="text-xs text-slate-400">Nascimento</p>
                      <p className="text-sm font-medium text-slate-700">
                        {new Date(servidor.data_nascimento+"T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                )}
                {servidor.telefone && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Phone size={15} className="text-slate-400 shrink-0"/>
                    <div>
                      <p className="text-xs text-slate-400">Telefone</p>
                      <p className="text-sm font-medium text-slate-700">{servidor.telefone}</p>
                    </div>
                  </div>
                )}
                {servidor.email && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Hash size={15} className="text-slate-400 shrink-0"/>
                    <div>
                      <p className="text-xs text-slate-400">E-mail</p>
                      <p className="text-sm font-medium text-slate-700 break-all">{servidor.email}</p>
                    </div>
                  </div>
                )}
                {servidor.endereco && (
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs text-slate-400">Endereço</p>
                      <p className="text-sm font-medium text-slate-700 leading-snug">{servidor.endereco}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Escolas */}
            {escolas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {escolas.length > 1 ? "Escolas" : "Escola"}
                </p>
                <div className="space-y-2">
                  {escolas.map((e,i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                      <School size={15} className="text-slate-400 shrink-0"/>
                      <p className="text-sm font-medium text-slate-700">{e}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sem dados */}
            {!servidor.data_nascimento && !servidor.telefone && !servidor.email && !servidor.endereco && (
              <p className="text-sm text-slate-400 italic text-center py-4">
                Nenhum dado adicional registrado.
              </p>
            )}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              {canTransfer && (
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-950 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
                  <ArrowRightLeft size={14}/> Transferir
                </button>
              )}
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <FileText size={14}/> Histórico
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────
// Mostra professores + servidores unificados + escolas
// Cada resultado tem botão "Mais dados" que abre a ficha completa

function SearchOverlay({ onClose, onSelectSchool, onOpenProf, onOpenServidor }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ profs:[], escolas:[], servidores:[] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    if (query.length < 2) {
      setResults({ profs:[], escolas:[], servidores:[] });
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarGlobal(query);
        setResults(r ?? { profs:[], escolas:[], servidores:[] });
      } catch(_) {
        setResults({ profs:[], escolas:[], servidores:[] });
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const hasResults =
    (results.profs ?? []).length > 0 ||
    (results.escolas ?? []).length > 0 ||
    (results.servidores ?? []).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e=>e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          {searching
            ? <Loader2 size={16} className="animate-spin text-slate-400 shrink-0"/>
            : <Search size={16} className="text-slate-400 shrink-0"/>
          }
          <input
            autoFocus
            className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent"
            placeholder="Buscar por nome de servidor ou escola..."
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400"/>
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {query.length >= 2 && !searching && !hasResults && (
            <p className="text-center py-10 text-sm text-slate-400">Nenhum resultado para "{query}"</p>
          )}
          {query.length < 2 && (
            <div className="py-10 text-center space-y-1">
              <p className="text-sm text-slate-400">Digite ao menos 2 letras para buscar</p>
              <p className="text-xs text-slate-300">Busca em professores e servidores cadastrais</p>
            </div>
          )}

          {/* Escolas */}
          {(results.escolas ?? []).length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Escolas</p>
              {(results.escolas ?? []).map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelectSchool(s); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                    <School size={14} className="text-slate-500"/>
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

          {/* Professores (tabela professores) */}
          {(results.profs ?? []).length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Professores</p>
              {(results.profs ?? []).map(p => {
                const esc = (p.nomeacoes ?? []).map(n=>n.escola?.name).filter(Boolean);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <AvatarCircle name={p.nome} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{p.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{esc.join(" · ") || "—"}</p>
                    </div>
                    {/* BOTÃO MAIS DADOS */}
                    <button
                      onClick={() => { onOpenProf(p); onClose(); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 rounded-xl text-xs font-medium transition-colors shrink-0"
                    >
                      <Info size={12}/> Mais dados
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Servidores unificados */}
          {(results.servidores ?? []).length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Dados Cadastrais</p>
              {(results.servidores ?? []).map(s => {
                const escAtual = s.escola_raw
                  ? s.escola_raw.split(",")[0].trim()
                  : null;
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <AvatarCircle name={s.nome} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{s.nome}</p>
                      {escAtual && <p className="text-xs text-slate-400 truncate">{escAtual}</p>}
                    </div>
                    {/* BOTÃO MAIS DADOS */}
                    <button
                      onClick={() => { onOpenServidor(s.id); onClose(); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 rounded-xl text-xs font-medium transition-colors shrink-0"
                    >
                      <Info size={12}/> Mais dados
                    </button>
                  </div>
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
  const { stats, loading } = useDashboardStats();
  const { escolas } = useEscolas();
  if (loading) return <Spinner/>;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">Rede Municipal · Vacaria–RS · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Escolas",         val:stats?.totalEscolas,    icon:School,        bg:"bg-slate-50",  text:"text-slate-800",  ib:"bg-slate-200 text-slate-600" },
          { label:"Professores",     val:stats?.totalProfs,      icon:GraduationCap, bg:"bg-blue-50",   text:"text-blue-800",   ib:"bg-blue-200 text-blue-700" },
          { label:"Dados Cadastrais",val:stats?.totalServidores, icon:UserCog,       bg:"bg-violet-50", text:"text-violet-800", ib:"bg-violet-200 text-violet-700" },
          { label:"Duplas Nomeações",val:stats?.duplos,          icon:ArrowRightLeft,bg:"bg-amber-50",  text:"text-amber-800",  ib:"bg-amber-200 text-amber-700" },
        ].map(({ label, val, icon:Icon, bg, text, ib }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <div className={`w-9 h-9 rounded-xl ${ib} flex items-center justify-center mb-3`}><Icon size={16}/></div>
            <p className={`text-3xl font-semibold ${text}`}>{val ?? "—"}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por modalidade</h2>
        <div className="grid grid-cols-3 gap-3">
          {["EMEF","EMEI","EMEF Campo"].map(tipo => {
            const count = escolas.filter(e=>e.tipo===tipo).length;
            return (
              <div key={tipo} className="p-4 bg-white border border-slate-100 rounded-2xl">
                <Badge className={`${TIPO_COLORS[tipo]} mb-3`}>{tipo}</Badge>
                <p className="text-2xl font-semibold text-slate-800">{count}</p>
                <p className="text-xs text-slate-400 mt-0.5">{count===1?"escola":"escolas"}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Todas as unidades</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {escolas.map(escola => (
            <div
              key={escola.id}
              onClick={() => onSelectSchool(escola)}
              className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all"
            >
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
  const { escolas, loading } = useEscolas();
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => escolas.filter(s =>
      (tipoFiltro==="Todos" || s.tipo===tipoFiltro) &&
      (search==="" || s.name.toLowerCase().includes(search.toLowerCase()))
    ),
    [escolas, tipoFiltro, search]
  );
  if (loading) return <Spinner/>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Unidades Escolares</h1>
        <p className="text-sm text-slate-500 mt-0.5">{escolas.length} escolas · Rede Municipal de Vacaria–RS</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Filtrar escolas..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["Todos","EMEF","EMEI","EMEF Campo"].map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${tipoFiltro===t?"bg-slate-900 text-white":"bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(escola => (
          <div
            key={escola.id}
            onClick={() => onSelectSchool(escola)}
            className="group p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors">
                <School size={17} className="text-slate-500 group-hover:text-white transition-colors"/>
              </div>
              <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-4">{escola.name}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Users size={12}/> Ver quadro</span>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCHOOL QUADRO ───────────────────────────────────────────────────────────

function SchoolQuadro({ escola, onBack, onOpenProf }) {
  const { professores, loading } = useProfessoresByEscola(escola.id);
  const { efe, salvarEfe, saving } = useEfetividade(escola.id, mesAnoAtual());
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => professores.filter(p => search==="" || p.nome.toLowerCase().includes(search.toLowerCase())),
    [professores, search]
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
          <ChevronRight size={18} className="text-slate-400 rotate-180"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{escola.name}</h1>
            <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "…" : `${professores.length} professores`} · {mesAnoLabel(mesAnoAtual())}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
        <Search size={15} className="text-slate-400"/>
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar professor nesta escola..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        {search && <button onClick={()=>setSearch("")}><X size={14} className="text-slate-400"/></button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="space-y-2">
          {filtered.length===0 && (
            <div className="text-center py-16 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Nenhum professor encontrado</p>
            </div>
          )}
          {filtered.map(prof => {
            const outra = (prof.nomeacoes ?? []).find(n=>n.escola?.id!==escola.id);
            const efeProf = efe[prof.id];
            return (
              <div key={prof.id} className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                <div className="cursor-pointer" onClick={()=>onOpenProf(prof)}>
                  <AvatarCircle name={prof.nome}/>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenProf(prof)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{prof.nome}</p>
                    {(prof.nomeacoesAqui ?? []).length > 1 && (
                      <Badge className="bg-violet-50 text-violet-600 border-violet-200">
                        {prof.nomeacoesAqui.length}× nomeações
                      </Badge>
                    )}
                    {outra && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                        <Briefcase size={10}/> 2ª escola
                      </Badge>
                    )}
                  </div>
                  {outra && <p className="text-xs text-slate-400 mt-0.5 truncate">Também em: {outra.escola?.name}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={()=>salvarEfe(prof.id,"ok",null)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${efeProf?.status==="ok"?"bg-emerald-500 text-white":"bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"}`}
                  ><CheckCircle2 size={13}/> OK</button>
                  <button
                    onClick={()=>salvarEfe(prof.id,"ocorrencia","Falta")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${efeProf?.status==="ocorrencia"?"bg-amber-400 text-white":"bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600"}`}
                  ><AlertCircle size={13}/> {efeProf?.ocorrencia ?? "Ocorrência"}</button>
                  {saving && <Loader2 size={13} className="animate-spin text-slate-400"/>}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0 cursor-pointer" onClick={()=>onOpenProf(prof)}/>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PROFESSORES LIST ────────────────────────────────────────────────────────

function ProfessoresList({ onOpenProf }) {
  const { professores, loading, reload } = useProfessores();
  const { escolas } = useEscolas();
  const [search, setSearch] = useState("");
  const [escolaFiltro, setEscolaFiltro] = useState("Todas");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return professores.filter(p =>
      (search==="" || p.nome.toLowerCase().includes(q)) &&
      (escolaFiltro==="Todas" || (p.nomeacoes ?? []).some(n=>n.escola?.name===escolaFiltro))
    );
  }, [professores, search, escolaFiltro]);
  if (loading) return <Spinner/>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Professores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{professores.length} cadastrados na rede</p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Recarregar">
          <RefreshCw size={16} className="text-slate-500"/>
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar professor..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
          {search && <button onClick={()=>setSearch("")}><X size={14} className="text-slate-400"/></button>}
        </div>
        <select
          value={escolaFiltro}
          onChange={e=>setEscolaFiltro(e.target.value)}
          className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer"
        >
          <option>Todas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-400">
        {filtered.length} professor{filtered.length!==1?"es":""} encontrado{filtered.length!==1?"s":""}
      </p>
      <div className="space-y-2">
        {filtered.map(prof => {
          const esc = [...new Set((prof.nomeacoes ?? []).map(n=>n.escola?.name).filter(Boolean))];
          return (
            <div
              key={prof.id}
              onClick={()=>onOpenProf(prof)}
              className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all"
            >
              <AvatarCircle name={prof.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{prof.nome}</p>
                  {esc.length > 1 && (
                    <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                      <Briefcase size={10}/> 2 escolas
                    </Badge>
                  )}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${prof.status==="Ativo"?"text-emerald-600":"text-amber-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prof.status==="Ativo"?"bg-emerald-500":"bg-amber-400"}`}/>
                    {prof.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{esc.join(" · ")}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DADOS CADASTRAIS (servidores_unificado — todos os 1179) ─────────────────

function DadosCadastrais({ onOpenServidor }) {
  const { servidores, loading, reload } = useServidores();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toUpperCase();
    const base = Array.isArray(servidores) ? servidores : [];
    if (!q) return base;
    return base.filter(s => (s.nome_normalizado || s.nome || "").toUpperCase().includes(q));
  }, [servidores, debouncedSearch]);

  if (loading) return <Spinner/>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dados Cadastrais</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {Array.isArray(servidores) ? servidores.length : 0} servidores · todos os vínculos
          </p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Recarregar">
          <RefreshCw size={16} className="text-slate-500"/>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
        <Search size={15} className="text-slate-400"/>
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar pelo nome..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        {search && <button onClick={()=>setSearch("")}><X size={14} className="text-slate-400"/></button>}
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length} resultado{filtered.length!==1?"s":""}
        {debouncedSearch ? ` para "${debouncedSearch}"` : ""}
      </p>

      {filtered.length===0 && !loading && (
        <div className="text-center py-16 text-slate-400">
          <UserCog size={32} className="mx-auto mb-2 opacity-30"/>
          <p className="text-sm">Nenhum servidor encontrado</p>
          {!debouncedSearch && (
            <p className="text-xs mt-1 text-slate-300">Verifique se o seed foi executado no Supabase</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(s => {
          const escAtual = s.escola_raw ? s.escola_raw.split(",")[0].trim() : null;
          const temDados = s.telefone || s.email || s.endereco || s.data_nascimento;
          return (
            <div
              key={s.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <AvatarCircle name={s.nome}/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                {escAtual && <p className="text-xs text-slate-400 truncate mt-0.5">{escAtual}</p>}
                {!temDados && <p className="text-xs text-slate-300 mt-0.5 italic">Sem dados de contato</p>}
              </div>
              {/* BOTÃO MAIS DADOS */}
              <button
                onClick={()=>onOpenServidor(s.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 rounded-xl text-xs font-medium transition-colors shrink-0"
              >
                <Info size={13}/> Mais dados
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EFE MODULE ──────────────────────────────────────────────────────────────

function EfeModule({ onOpenProf }) {
  const { professores, loading } = useProfessores();
  const { escolas } = useEscolas();
  const [escolaFiltro, setEscolaFiltro] = useState("");
  const [search, setSearch] = useState("");
  const escolaSel = useMemo(()=>escolas.find(e=>e.name===escolaFiltro),[escolas,escolaFiltro]);
  const { efe, salvarEfe, saving } = useEfetividade(escolaSel?.id, mesAnoAtual());
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return professores
      .filter(p =>
        (search==="" || p.nome.toLowerCase().includes(q)) &&
        (escolaFiltro==="" || (p.nomeacoes ?? []).some(n=>n.escola?.name===escolaFiltro))
      )
      .slice(0, 100);
  }, [professores, search, escolaFiltro]);
  if (loading) return <Spinner/>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Efetividade — EFE</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registro mensal · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar professor..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
        </div>
        <select
          value={escolaFiltro}
          onChange={e=>setEscolaFiltro(e.target.value)}
          className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer"
        >
          <option value="">Todas as escolas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      {!escolaFiltro && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">
          Selecione uma escola para registrar e salvar a efetividade no banco de dados.
        </div>
      )}
      <p className="text-xs text-slate-400">
        Exibindo {filtered.length} professores {saving && "· salvando…"}
      </p>
      <div className="space-y-2">
        {filtered.map(prof => {
          const esc = [...new Set((prof.nomeacoes ?? []).map(n=>n.escola?.name).filter(Boolean))];
          const efeProf = efe[prof.id];
          return (
            <div key={prof.id} className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
              <AvatarCircle name={prof.nome}/>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenProf(prof)}>
                <p className="text-sm font-semibold text-slate-800 truncate">{prof.nome}</p>
                <p className="text-xs text-slate-400 truncate">{esc.join(" · ")}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={()=>escolaSel && salvarEfe(prof.id,"ok",null)}
                  disabled={!escolaSel}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${efeProf?.status==="ok"?"bg-emerald-500 text-white":"bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"}`}
                ><CheckCircle2 size={13}/> OK</button>
                <select
                  disabled={!escolaSel}
                  value={efeProf?.status==="ocorrencia" ? efeProf.ocorrencia : ""}
                  onChange={e=>escolaSel && salvarEfe(prof.id,"ocorrencia",e.target.value)}
                  className={`px-2 py-1.5 rounded-xl text-xs font-medium outline-none cursor-pointer disabled:opacity-40 ${efeProf?.status==="ocorrencia"?"bg-amber-400 text-white":"bg-slate-100 text-slate-500"}`}
                >
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
  const { user, profile, loading, signOut } = useAuth();
  const admin = isAdmin(profile);
  const [view, setView] = useState("dashboard");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedProf, setSelectedProf] = useState(null);
  const [selectedServidorId, setSelectedServidorId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key==="k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-slate-400"/>
    </div>
  );
  if (!user) return <LoginPage/>;

  function handleSelectSchool(escola) { setSelectedSchool(escola); setView("school-detail"); }
  function navigate(id) { setView(id); setSelectedSchool(null); }

  const navItems = [
    { id:"dashboard",  label:"Dashboard",       icon:Home },
    { id:"schools",    label:"Unidades",         icon:School },
    { id:"professores",label:"Professores",      icon:GraduationCap },
    { id:"servidores", label:"Dados Cadastrais", icon:UserCog },
    { id:"efe",        label:"Efetividade",      icon:CheckCircle2 },
    { id:"relatorios", label:"Relatórios",       icon:FileText },
  ];
  const currentNavId = view==="school-detail" ? "schools" : view;

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily:"'DM Sans', system-ui, sans-serif" }}>

      {/* Sidebar */}
      <aside className={`${sidebarOpen?"w-56":"w-16"} shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all duration-200 fixed top-0 left-0 h-screen z-30`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0">
            <GraduationCap size={15} className="text-white"/>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p>
              <p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon:Icon }) => (
            <button
              key={id}
              onClick={()=>navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${currentNavId===id?"bg-slate-950 text-white font-medium":"text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
            >
              <Icon size={17} className="shrink-0"/>
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          {sidebarOpen && profile && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-medium text-slate-700 truncate">{profile.nome || user.email}</p>
              <div className="mt-1"><RoleBadge role={profile.role}/></div>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <LogOut size={17} className="shrink-0"/>
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen?"ml-56":"ml-16"} transition-all duration-200`}>
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 shrink-0 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={17} className="text-slate-500"/>
          </button>
          <button
            onClick={()=>setSearchOpen(true)}
            className="flex-1 max-w-sm flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <Search size={14}/>
            <span className="flex-1 text-left">Buscar servidor ou escola...</span>
            <kbd className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono">⌘K</kbd>
          </button>
          <div className="ml-auto">
            <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-semibold text-white">
              {initials(profile?.nome || user?.email || "U")}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-5xl w-full">
          {view==="dashboard"    && <Dashboard onSelectSchool={handleSelectSchool}/>}
          {view==="schools"      && <SchoolsGrid onSelectSchool={handleSelectSchool}/>}
          {view==="school-detail" && selectedSchool && (
            <SchoolQuadro
              escola={selectedSchool}
              onBack={()=>{ setView("schools"); setSelectedSchool(null); }}
              onOpenProf={setSelectedProf}
            />
          )}
          {view==="professores"  && <ProfessoresList onOpenProf={setSelectedProf}/>}
          {view==="servidores"   && <DadosCadastrais onOpenServidor={setSelectedServidorId}/>}
          {view==="efe"          && <EfeModule onOpenProf={setSelectedProf}/>}
          {view==="relatorios"   && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Relatórios · em breve</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          onClose={()=>setSearchOpen(false)}
          onSelectSchool={handleSelectSchool}
          onOpenProf={p=>setSelectedProf(p)}
          onOpenServidor={id=>setSelectedServidorId(id)}
        />
      )}

      {/* Modais */}
      {selectedProf && (
        <ProfessorModal
          prof={selectedProf}
          onClose={()=>setSelectedProf(null)}
          canTransfer={admin}
        />
      )}
      {selectedServidorId && (
        <ServidorModal
          servidorId={selectedServidorId}
          onClose={()=>setSelectedServidorId(null)}
          canTransfer={admin}
        />
      )}

      <Footer/>
    </div>
  );
}
