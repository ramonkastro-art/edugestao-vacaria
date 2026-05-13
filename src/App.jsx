import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, School, Users, Home, FileText, Bell, Settings,
  LogOut, CheckCircle2, AlertCircle, ArrowRightLeft, X,
  Menu, ChevronRight, GraduationCap, UserCheck, UserX,
  Briefcase, Plus, Download, ChevronDown, Filter
} from "lucide-react";
import rawData from "./data/data.json";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  "EMEI":       "bg-violet-50 text-violet-700 border-violet-200",
  "EMEF":       "bg-blue-50   text-blue-700   border-blue-200",
  "EMEF Campo": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const OCORRENCIAS = ["Falta", "Licença Médica", "Licença Maternidade", "Licença Prêmio", "Substituição", "Afastamento"];

// ─── STATE INIT ───────────────────────────────────────────────────────────────

const { schools: SCHOOLS, professores: PROFESSORES_RAW } = rawData;

// Enrich schools with computed stats
const PROFESSORES = PROFESSORES_RAW.map(p => ({
  ...p,
  efetividade: { status: "pendente", ocorrencia: null },
}));

function buildSchoolStats() {
  const stats = {};
  SCHOOLS.forEach(s => {
    stats[s.id] = { ...s, total: 0, professores: [] };
  });
  PROFESSORES.forEach(p => {
    const seen = new Set();
    p.nomeacoes.forEach(n => {
      if (!seen.has(n.escolaId)) {
        seen.add(n.escolaId);
        if (stats[n.escolaId]) {
          stats[n.escolaId].total++;
          stats[n.escolaId].professores.push(p.id);
        }
      }
    });
  });
  return stats;
}

const SCHOOL_STATS = buildSchoolStats();
const MES_VIGENTE = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

function AvatarCircle({ name, size = "md" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" };
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizes[size]} ${color} rounded-xl flex items-center justify-center font-semibold shrink-0 transition-all`}>
      {initials(name)}
    </div>
  );
}

// ─── PROFESSOR CARD MODAL ────────────────────────────────────────────────────

function ProfessorModal({ prof, onClose }) {
  const [efe, setEfe] = useState({ ...prof.efetividade });

  const uniqueSchools = [...new Map(prof.nomeacoes.map(n => [n.escolaId, n])).values()];
  const hasDuplas = prof.nomeacoes.length > uniqueSchools.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-slate-950 p-6 pb-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white">
              {initials(prof.nome)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">{prof.nome}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  prof.status === "Ativo" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prof.status === "Ativo" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {prof.status}
                </span>
                {prof.nomeacoes.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    <Briefcase size={10} /> {prof.nomeacoes.length} nomeações
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nomeações */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Unidades / Nomeações</p>
            <div className="space-y-2">
              {prof.nomeacoes.map((n, i) => {
                const school = SCHOOLS.find(s => s.id === n.escolaId);
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <School size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{n.escolaNome}</p>
                      {n.obs && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={11} /> {n.obs}
                        </p>
                      )}
                    </div>
                    {school && <Badge className={TIPO_COLORS[school.tipo]}>{school.tipo}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carga horária placeholder */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Carga Horária</p>
            <div className="grid grid-cols-3 gap-2">
              {[["Regência", "—"], ["HTP", "—"], ["HTI", "—"]].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-2xl p-3 text-center">
                  <p className="text-xl font-semibold text-slate-700">{v}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* EFE do mês */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Efetividade — {MES_VIGENTE}
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setEfe({ status: "ok", ocorrencia: null })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  efe.status === "ok"
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <CheckCircle2 size={15} /> OK
              </button>
              <button
                onClick={() => setEfe({ status: "ocorrencia", ocorrencia: efe.ocorrencia || OCORRENCIAS[0] })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  efe.status === "ocorrencia"
                    ? "bg-amber-400 text-white shadow-sm shadow-amber-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <AlertCircle size={15} /> Ocorrência
              </button>
            </div>
            {efe.status === "ocorrencia" && (
              <select
                value={efe.ocorrencia || ""}
                onChange={e => setEfe({ status: "ocorrencia", ocorrencia: e.target.value })}
                className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {OCORRENCIAS.map(o => <option key={o}>{o}</option>)}
              </select>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-1">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <ArrowRightLeft size={14} /> Transferir
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <FileText size={14} /> Ver Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────

function SearchOverlay({ onClose, onSelectSchool, onOpenProf }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return { profs: [], schools: [] };
    return {
      profs: PROFESSORES.filter(p => p.nome.toLowerCase().includes(q)).slice(0, 8),
      schools: SCHOOLS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query]);

  const hasResults = results.profs.length > 0 || results.schools.length > 0;

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            autoFocus
            className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent"
            placeholder="Buscar professor ou escola..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query.length >= 2 && !hasResults && (
            <p className="text-center py-10 text-sm text-slate-400">Nenhum resultado para "{query}"</p>
          )}
          {query.length < 2 && (
            <p className="text-center py-10 text-sm text-slate-400">Digite ao menos 2 letras para buscar</p>
          )}

          {results.schools.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Escolas</p>
              {results.schools.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelectSchool(s); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                    <School size={14} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.tipo} · {SCHOOL_STATS[s.id]?.total ?? 0} professores</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.profs.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Professores</p>
              {results.profs.map(p => {
                const uniqueSchools = [...new Map(p.nomeacoes.map(n => [n.escolaId, n])).values()];
                return (
                  <button
                    key={p.id}
                    onClick={() => { onOpenProf(p); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <AvatarCircle name={p.nome} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{p.nome}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {uniqueSchools.map(n => n.escolaNome).join(" · ")}
                      </p>
                    </div>
                    {p.nomeacoes.length > 1 && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200 ml-auto shrink-0">
                        {p.nomeacoes.length}×
                      </Badge>
                    )}
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

function Dashboard({ onSelectSchool, onOpenProf }) {
  const totalProfs = PROFESSORES.length;
  const totalNomeacoes = PROFESSORES.reduce((a, p) => a + p.nomeacoes.length, 0);
  const duplos = PROFESSORES.filter(p => new Set(p.nomeacoes.map(n => n.escolaId)).size > 1).length;

  const byTipo = useMemo(() => {
    const map = {};
    SCHOOLS.forEach(s => {
      if (!map[s.tipo]) map[s.tipo] = { escolas: 0, profs: 0 };
      map[s.tipo].escolas++;
      map[s.tipo].profs += SCHOOL_STATS[s.id]?.total ?? 0;
    });
    return map;
  }, []);

  const topEscolas = useMemo(() =>
    [...SCHOOLS]
      .map(s => ({ ...s, total: SCHOOL_STATS[s.id]?.total ?? 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
  []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rede Municipal de Ensino · Vacaria–RS · {MES_VIGENTE}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Escolas",            val: SCHOOLS.length, icon: School,    bg: "bg-slate-50",    text: "text-slate-800",   iconBg: "bg-slate-200 text-slate-600" },
          { label: "Professores",        val: totalProfs,     icon: Users,     bg: "bg-blue-50",     text: "text-blue-800",    iconBg: "bg-blue-200 text-blue-700" },
          { label: "Total Nomeações",    val: totalNomeacoes, icon: Briefcase, bg: "bg-violet-50",   text: "text-violet-800",  iconBg: "bg-violet-200 text-violet-700" },
          { label: "Duplas Nomeações",   val: duplos,         icon: ArrowRightLeft, bg: "bg-amber-50", text: "text-amber-800", iconBg: "bg-amber-200 text-amber-700" },
        ].map(({ label, val, icon: Icon, bg, text, iconBg }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
              <Icon size={16} />
            </div>
            <p className={`text-3xl font-semibold ${text}`}>{val}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Por tipo */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por modalidade</h2>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(byTipo).map(([tipo, d]) => (
            <div key={tipo} className="p-4 bg-white border border-slate-100 rounded-2xl">
              <Badge className={`${TIPO_COLORS[tipo]} mb-3`}>{tipo}</Badge>
              <p className="text-2xl font-semibold text-slate-800">{d.profs}</p>
              <p className="text-xs text-slate-400 mt-0.5">{d.escolas} {d.escolas === 1 ? "escola" : "escolas"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top escolas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Maiores quadros de professores</h2>
          <button
            onClick={() => {}}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Ver todas →
          </button>
        </div>
        <div className="space-y-2">
          {topEscolas.map(school => {
            const max = topEscolas[0].total;
            return (
              <div
                key={school.id}
                onClick={() => onSelectSchool(school)}
                className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors shrink-0">
                  <School size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{school.name}</p>
                    <span className="text-xs text-slate-500 ml-2 shrink-0">{school.total}</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${(school.total / max) * 100}%` }}
                    />
                  </div>
                </div>
                <Badge className={TIPO_COLORS[school.tipo]}>{school.tipo}</Badge>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SCHOOL GRID ─────────────────────────────────────────────────────────────

function SchoolsGrid({ onSelectSchool }) {
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [search, setSearch] = useState("");

  const tipos = ["Todos", "EMEF", "EMEI", "EMEF Campo"];

  const filtered = useMemo(() =>
    SCHOOLS
      .filter(s =>
        (tipoFiltro === "Todos" || s.tipo === tipoFiltro) &&
        (search === "" || s.name.toLowerCase().includes(search.toLowerCase()))
      )
      .map(s => ({ ...s, total: SCHOOL_STATS[s.id]?.total ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [tipoFiltro, search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Unidades Escolares</h1>
        <p className="text-sm text-slate-500 mt-0.5">{SCHOOLS.length} escolas · Rede Municipal de Vacaria–RS</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Filtrar escolas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {tipos.map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                tipoFiltro === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} escola{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(school => (
          <div
            key={school.id}
            onClick={() => onSelectSchool(school)}
            className="group p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors">
                <School size={17} className="text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <Badge className={TIPO_COLORS[school.tipo]}>{school.tipo}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-4">{school.name}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users size={12} /> {school.total} professores
              </span>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCHOOL QUADRO ───────────────────────────────────────────────────────────

function SchoolQuadro({ school, onBack, onOpenProf }) {
  const [search, setSearch] = useState("");
  const [efeFilter, setEfeFilter] = useState("Todos");

  const stats = SCHOOL_STATS[school.id];
  const profs = useMemo(() => {
    const profIds = stats?.professores ?? [];
    return PROFESSORES.filter(p =>
      profIds.includes(p.id) &&
      (search === "" || p.nome.toLowerCase().includes(search.toLowerCase()))
    );
  }, [school.id, search, stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronRight size={18} className="text-slate-400 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{school.name}</h1>
            <Badge className={TIPO_COLORS[school.tipo]}>{school.tipo}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{stats?.total ?? 0} professores cadastrados</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0">
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
        <Search size={15} className="text-slate-400" />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar professor nesta escola..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X size={14} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Cabeçalho EFE */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{profs.length} professores</p>
        <p className="text-xs text-slate-400">{MES_VIGENTE}</p>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {profs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum professor encontrado</p>
          </div>
        ) : (
          profs.map(prof => {
            const nomeacoesAqui = prof.nomeacoes.filter(n => n.escolaId === school.id);
            const outraEscola = prof.nomeacoes.find(n => n.escolaId !== school.id);
            return (
              <div
                key={prof.id}
                onClick={() => onOpenProf(prof)}
                className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all"
              >
                <AvatarCircle name={prof.nome} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{prof.nome}</p>
                    {nomeacoesAqui.length > 1 && (
                      <Badge className="bg-violet-50 text-violet-600 border-violet-200">
                        {nomeacoesAqui.length}× nomeações
                      </Badge>
                    )}
                    {outraEscola && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                        <Briefcase size={10} className="mr-0.5" /> 2ª escola
                      </Badge>
                    )}
                    {nomeacoesAqui[0]?.obs && (
                      <Badge className="bg-amber-50 text-amber-600 border-amber-200">
                        <AlertCircle size={10} className="mr-0.5" /> obs.
                      </Badge>
                    )}
                  </div>
                  {outraEscola && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      Também em: {outraEscola.escolaNome}
                    </p>
                  )}
                </div>

                <EFEBadgeInline prof={prof} />
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function EFEBadgeInline({ prof }) {
  const [efe, setEfe] = useState(prof.efetividade);
  if (efe.status === "ok") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl shrink-0">
        <CheckCircle2 size={13} /> OK
      </span>
    );
  }
  if (efe.status === "ocorrencia") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl shrink-0">
        <AlertCircle size={13} /> {efe.ocorrencia}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0">
      Pendente
    </span>
  );
}

// ─── EFE MODULE ──────────────────────────────────────────────────────────────

function EfeModule({ onOpenProf }) {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("Todas");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PROFESSORES.filter(p =>
      (search === "" || p.nome.toLowerCase().includes(q)) &&
      (schoolFilter === "Todas" || p.nomeacoes.some(n => n.escolaNome === schoolFilter))
    ).slice(0, 80);
  }, [search, schoolFilter]);

  const schoolNames = useMemo(() =>
    ["Todas", ...SCHOOLS.map(s => s.name).sort((a, b) => a.localeCompare(b, "pt-BR"))],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Efetividade — EFE</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registro mensal · {MES_VIGENTE}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar professor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={schoolFilter}
          onChange={e => setSchoolFilter(e.target.value)}
          className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 border-none outline-none cursor-pointer"
        >
          {schoolNames.map(n => <option key={n}>{n}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400">
        Exibindo {filtered.length} de {PROFESSORES.length} professores
        {filtered.length === 80 ? " (use o filtro para restringir)" : ""}
      </p>

      <div className="space-y-2">
        {filtered.map(prof => (
          <EfeRow key={prof.id} prof={prof} onOpen={() => onOpenProf(prof)} />
        ))}
      </div>
    </div>
  );
}

function EfeRow({ prof, onOpen }) {
  const [efe, setEfe] = useState({ ...prof.efetividade });
  const uniqueSchools = [...new Map(prof.nomeacoes.map(n => [n.escolaId, n])).values()];

  return (
    <div className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
      <AvatarCircle name={prof.nome} />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className="text-sm font-semibold text-slate-800 truncate">{prof.nome}</p>
        <p className="text-xs text-slate-400 truncate">
          {uniqueSchools.map(n => n.escolaNome).join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setEfe({ status: "ok", ocorrencia: null })}
          title="OK"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            efe.status === "ok"
              ? "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
          }`}
        >
          <CheckCircle2 size={13} />
          <span className="hidden sm:inline">OK</span>
        </button>
        {OCORRENCIAS.slice(0, 3).map(op => (
          <button
            key={op}
            title={op}
            onClick={() => setEfe({ status: "ocorrencia", ocorrencia: op })}
            className={`px-2 py-1.5 rounded-xl text-xs font-medium transition-all hidden sm:block ${
              efe.ocorrencia === op
                ? "bg-amber-400 text-white"
                : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
            }`}
          >
            {op}
          </button>
        ))}
        <button
          onClick={() => setEfe({ status: "ocorrencia", ocorrencia: OCORRENCIAS[0] })}
          title="Registrar ocorrência"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all sm:hidden ${
            efe.status === "ocorrencia"
              ? "bg-amber-400 text-white"
              : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          }`}
        >
          <AlertCircle size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── APP SHELL ───────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedProf, setSelectedProf] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard",    icon: Home },
    { id: "schools",   label: "Unidades",     icon: School },
    { id: "efe",       label: "Efetividade",  icon: CheckCircle2 },
    { id: "relatorios",label: "Relatórios",   icon: FileText },
  ];

  function handleSelectSchool(school) {
    setSelectedSchool(school);
    setView("school-detail");
  }

  function navigate(id) {
    setView(id);
    setSelectedSchool(null);
  }

  const currentNavId = view === "school-detail" ? "schools" : view;

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all duration-200 fixed top-0 left-0 h-screen z-30`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0">
            <GraduationCap size={15} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p>
              <p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                currentNavId === id
                  ? "bg-slate-950 text-white font-medium"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 space-y-1 border-t border-slate-100">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <Settings size={17} className="shrink-0" />
            {sidebarOpen && <span>Configurações</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <LogOut size={17} className="shrink-0" />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content offset */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? "ml-56" : "ml-16"} transition-all duration-200`}>
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Menu size={17} className="text-slate-500" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 max-w-sm flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Buscar professor ou escola...</span>
            <kbd className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Bell size={17} className="text-slate-500" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-semibold text-white">
              GM
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 max-w-5xl w-full">
          {view === "dashboard" && (
            <Dashboard onSelectSchool={handleSelectSchool} onOpenProf={setSelectedProf} />
          )}
          {view === "schools" && (
            <SchoolsGrid onSelectSchool={handleSelectSchool} />
          )}
          {view === "school-detail" && selectedSchool && (
            <SchoolQuadro
              school={selectedSchool}
              onBack={() => { setView("schools"); setSelectedSchool(null); }}
              onOpenProf={setSelectedProf}
            />
          )}
          {view === "efe" && (
            <EfeModule onOpenProf={setSelectedProf} />
          )}
          {view === "relatorios" && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Módulo de Relatórios em desenvolvimento</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modais */}
      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onSelectSchool={handleSelectSchool}
          onOpenProf={p => { setSelectedProf(p); }}
        />
      )}
      {selectedProf && (
        <ProfessorModal
          prof={selectedProf}
          onClose={() => setSelectedProf(null)}
        />
      )}
    </div>
  );
}
