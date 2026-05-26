import { useState } from "react";
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase,
  School, Hash, ChevronDown, CheckCircle2, Loader2,
  AlertCircle, ArrowLeft, UserPlus, FileText,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useEscolas } from "../hooks/useData";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const FUNCOES = [
  { value: "Professor(a) Ed. Básica I",          group: "Docente" },
  { value: "Professor(a) Ed. Básica II",          group: "Docente" },
  { value: "Professor(a) Ed. Infantil",           group: "Docente" },
  { value: "Professor(a) Ed. Física",             group: "Docente" },
  { value: "Professor(a) Ed. Especial",           group: "Docente" },
  { value: "Diretor(a)",                          group: "Docente" },
  { value: "Coordenador(a) Pedagógico(a)",        group: "Docente" },
  { value: "Merendeira",                          group: "Apoio" },
  { value: "Servente / Aux. Limpeza",             group: "Apoio" },
  { value: "Atendente / Monitor(a)",              group: "Apoio" },
  { value: "Auxiliar de Serviços Gerais",         group: "Apoio" },
  { value: "Vigia / Porteiro(a)",                 group: "Apoio" },
  { value: "Técnico(a) Administrativo(a)",        group: "Administrativo" },
  { value: "Secretário(a) Escolar",               group: "Administrativo" },
  { value: "Auxiliar Administrativo",             group: "Administrativo" },
  { value: "Assistente de Educação",              group: "Administrativo" },
  { value: "Outro",                               group: "Outro" },
];

const VINCULOS = ["Efetivo", "Designação", "Contratado", "Temporário", "Estágio"];

const GRUPOS = [...new Set(FUNCOES.map(f => f.group))];

function ehDocente(funcao) {
  return funcao?.toLowerCase().includes("prof") ||
         funcao?.toLowerCase().includes("direto") ||
         funcao?.toLowerCase().includes("coord");
}

// ─── HELPERS VISUAIS ─────────────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function Input({ icon: Icon, error, ...props }) {
  return (
    <div>
      <div className={`flex items-center gap-2.5 px-3 py-3 bg-slate-50 border rounded-xl transition-colors focus-within:border-slate-400 ${error ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
        {Icon && <Icon size={16} className={error ? "text-red-400 shrink-0" : "text-slate-400 shrink-0"} />}
        <input
          className={`flex-1 text-sm outline-none bg-transparent placeholder:text-slate-300 ${error ? "text-red-700" : "text-slate-700"}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function SelectField({ icon: Icon, error, children, ...props }) {
  return (
    <div>
      <div className={`flex items-center gap-2.5 px-3 py-3 bg-slate-50 border rounded-xl transition-colors focus-within:border-slate-400 ${error ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
        {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
        <select
          className="flex-1 text-sm outline-none bg-transparent text-slate-700 cursor-pointer appearance-none"
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={14} className="text-slate-400 shrink-0 pointer-events-none" />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{title}</p>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────

const FORM_INICIAL = {
  nome:            "",
  email:           "",
  telefone:        "",
  endereco:        "",
  data_nascimento: "",
  funcao:          "",
  vinculo:         "Efetivo",
  escola_id:       "",
  matricula:       "",
  cargo_especifico:"",
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function NovoCadastro({ onVoltar, onSucesso }) {
  const { escolas } = useEscolas();
  const [form, setForm]     = useState(FORM_INICIAL);
  const [erros, setErros]   = useState({});
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro]     = useState("");

  const isProf = ehDocente(form.funcao);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (erros[field]) setErros(prev => ({ ...prev, [field]: "" }));
  }

  // ── Validação ──────────────────────────────────────────────────────────────
  function validar() {
    const e = {};
    if (!form.nome.trim())   e.nome   = "Nome é obrigatório";
    if (!form.funcao)        e.funcao = "Selecione uma função";
    if (!form.escola_id)     e.escola_id = "Selecione uma escola";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "E-mail inválido";
    if (form.data_nascimento) {
      const d = new Date(form.data_nascimento);
      if (isNaN(d) || d > new Date()) e.data_nascimento = "Data inválida";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function handleSalvar() {
    if (!validar()) return;
    setSaving(true);
    setErro("");

    try {
      const nomeNorm = form.nome
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().trim();

      const escolaSel = escolas.find(e => e.id === parseInt(form.escola_id));

      // 1. Salva na tabela cadastral (todos os servidores)
      const { data: cad, error: cadErr } = await supabase
        .from("servidores_unificado")
        .insert({
          nome:            form.nome.trim(),
          nome_normalizado: nomeNorm,
          email:           form.email || null,
          telefone:        form.telefone || null,
          endereco:        form.endereco || null,
          data_nascimento: form.data_nascimento || null,
          escola_raw:      escolaSel?.name || null,
        })
        .select()
        .single();

      if (cadErr) throw new Error(cadErr.message);

      // 2. Se docente, cria também em professores + nomeacoes
      if (isProf && form.escola_id) {
        const { data: prof, error: profErr } = await supabase
          .from("professores")
          .insert({
            nome:     form.nome.trim(),
            status:   "Ativo",
            email:    form.email    || null,
            telefone: form.telefone || null,
          })
          .select()
          .single();

        if (!profErr && prof) {
          await supabase.from("nomeacoes").insert({
            professor_id: prof.id,
            escola_id:    parseInt(form.escola_id),
            matricula:    form.matricula || null,
            cargo:        form.cargo_especifico || form.funcao,
            tipo_vinculo: form.vinculo || "Efetivo",
            ativa:        true,
          });
        }
      }

      setSucesso(true);
      if (onSucesso) onSucesso(cad);
    } catch (e) {
      setErro(e.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function handleNovoCadastro() {
    setForm(FORM_INICIAL);
    setErros({});
    setSucesso(false);
    setErro("");
  }

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Cadastro realizado!</h2>
          <p className="text-sm text-slate-500 mb-8">
            <strong>{form.nome}</strong> foi cadastrado(a) com sucesso na rede municipal.
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={handleNovoCadastro}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all"
            >
              <UserPlus size={15} /> Novo cadastro
            </button>
            <button
              onClick={onVoltar}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <ArrowLeft size={15} /> Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={onVoltar}
          className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Novo Cadastro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Preencha os dados do novo servidor</p>
        </div>
      </div>

      {/* Seção 1: Dados pessoais */}
      <Section title="Dados Pessoais">
        <div>
          <FieldLabel required>Nome completo</FieldLabel>
          <Input
            icon={User}
            placeholder="Ex.: Maria da Silva Souza"
            value={form.nome}
            onChange={e => set("nome", e.target.value)}
            error={erros.nome}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Data de nascimento</FieldLabel>
            <Input
              icon={Calendar}
              type="date"
              value={form.data_nascimento}
              onChange={e => set("data_nascimento", e.target.value)}
              error={erros.data_nascimento}
            />
          </div>
          <div>
            <FieldLabel>Telefone</FieldLabel>
            <Input
              icon={Phone}
              type="tel"
              placeholder="(54) 9 9999-9999"
              value={form.telefone}
              onChange={e => set("telefone", e.target.value)}
              error={erros.telefone}
            />
          </div>
        </div>
        <div>
          <FieldLabel>E-mail</FieldLabel>
          <Input
            icon={Mail}
            type="email"
            placeholder="email@vacaria.rs.gov.br"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            error={erros.email}
          />
        </div>
        <div>
          <FieldLabel>Endereço</FieldLabel>
          <Input
            icon={MapPin}
            placeholder="Rua, número, bairro"
            value={form.endereco}
            onChange={e => set("endereco", e.target.value)}
            error={erros.endereco}
          />
        </div>
      </Section>

      {/* Seção 2: Função e vínculo */}
      <Section title="Função e Vínculo">
        <div>
          <FieldLabel required>Função</FieldLabel>
          <SelectField
            icon={Briefcase}
            value={form.funcao}
            onChange={e => set("funcao", e.target.value)}
            error={erros.funcao}
          >
            <option value="">Selecionar função...</option>
            {GRUPOS.map(grupo => (
              <optgroup key={grupo} label={`── ${grupo} ──`}>
                {FUNCOES.filter(f => f.group === grupo).map(f => (
                  <option key={f.value} value={f.value}>{f.value}</option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        </div>

        <div>
          <FieldLabel>Tipo de vínculo</FieldLabel>
          <SelectField
            icon={FileText}
            value={form.vinculo}
            onChange={e => set("vinculo", e.target.value)}
          >
            {VINCULOS.map(v => <option key={v}>{v}</option>)}
          </SelectField>
        </div>

        {/* Cargo específico (campo livre) */}
        <div>
          <FieldLabel>Cargo específico <span className="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></FieldLabel>
          <Input
            icon={Hash}
            placeholder="Ex.: Prof. Ed. Básica II — Matemática"
            value={form.cargo_especifico}
            onChange={e => set("cargo_especifico", e.target.value)}
          />
        </div>
      </Section>

      {/* Seção 3: Escola */}
      <Section title="Escola de Trabalho">
        <div>
          <FieldLabel required>Escola</FieldLabel>
          <SelectField
            icon={School}
            value={form.escola_id}
            onChange={e => set("escola_id", e.target.value)}
            error={erros.escola_id}
          >
            <option value="">Selecionar escola...</option>
            {escolas.filter(e => e.tipo === "SMED").map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
            {["EMEF", "EMEI", "EMEF Campo"].map(tipo => (
              <optgroup key={tipo} label={`── ${tipo} ──`}>
                {escolas.filter(e => e.tipo === tipo).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        </div>

        {/* Matrícula (só para docentes) */}
        {isProf && (
          <div>
            <FieldLabel>Matrícula funcional</FieldLabel>
            <Input
              icon={Hash}
              placeholder="Ex.: 2024-0341"
              value={form.matricula}
              onChange={e => set("matricula", e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Para professores, a matrícula é registrada na nomeação.
            </p>
          </div>
        )}
      </Section>

      {/* Preview do cadastro */}
      {form.nome && form.funcao && form.escola_id && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
            Resumo do cadastro
          </p>
          <p className="text-sm font-medium text-slate-800">{form.nome}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {form.funcao} · {form.vinculo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {escolas.find(e => e.id === parseInt(form.escola_id))?.name ?? "—"}
          </p>
          {isProf && (
            <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11} />
              Será cadastrado também como professor com nomeação formal.
            </p>
          )}
        </div>
      )}

      {/* Erro geral */}
      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* Botão salvar */}
      <button
        onClick={handleSalvar}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-950 text-white rounded-2xl text-sm font-semibold hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Salvando…</>
          : <><UserPlus size={16} /> Cadastrar Servidor</>
        }
      </button>

      {/* Espaço para bottom nav no mobile */}
      <div className="h-4" />
    </div>
  );
}
