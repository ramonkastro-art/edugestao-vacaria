import { useState, useEffect } from "react";
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase,
  School, Hash, Save, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const FUNCOES = [
  "Professor(a) Ed. Básica I","Professor(a) Ed. Básica II",
  "Professor(a) Ed. Infantil","Professor(a) Ed. Física",
  "Professor(a) Ed. Especial","Diretor(a)",
  "Coordenador(a) Pedagógico(a)","Secretário(a) Escolar",
  "Assistente Administrativo","Técnico Administrativo",
  "Merendeira","Servente","Zelador(a)","Porteiro(a)","Vigia",
  "Auxiliar de Serviços Gerais","Atendente / Monitor(a)","Outro",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Extrai o UUID correto do objeto servidor unificado:
// - Se tem cadastro.id → é um professor com dados cadastrais → usa cadastro.id (uuid)
// - Se id começa com "cad_" → remove prefixo → uuid
// - Se id é número inteiro (professor sem cadastro) → null (não há cadastro para editar)
function getCadastroId(servidor) {
  if (!servidor) return null;

  // Tem cadastro vinculado → usa o id do cadastro (uuid)
  if (servidor.cadastro?.id) {
    return String(servidor.cadastro.id).replace(/^cad_/, "");
  }

  // id com prefixo cad_ (pessoal T&A puro)
  const sid = String(servidor.id ?? "");
  if (sid.startsWith("cad_")) return sid.replace("cad_", "");

  // id é uuid direto (sem prefixo, sem cadastro separado)
  if (sid.includes("-") && sid.length > 30) return sid;

  // id é inteiro (professor sem registro em servidores_unificado) → sem cadastro
  return null;
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function Field({ icon: Icon, error, disabled, ...props }) {
  return (
    <div>
      <div className={`flex items-center gap-3 px-3 py-3 border rounded-xl transition-colors ${
        disabled
          ? "bg-slate-50 border-slate-100 opacity-60"
          : error
          ? "bg-red-50 border-red-300"
          : "bg-slate-50 border-slate-200 focus-within:border-slate-400"
      }`}>
        {Icon && <Icon size={15} className="shrink-0 text-slate-400"/>}
        <input
          disabled={disabled}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300 text-slate-800 disabled:cursor-not-allowed"
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
    </div>
  );
}

function SelectField({ icon: Icon, disabled, children, ...props }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl ${disabled ? "opacity-60" : ""}`}>
      {Icon && <Icon size={15} className="text-slate-400 shrink-0"/>}
      <select
        disabled={disabled}
        className="flex-1 bg-transparent text-sm outline-none text-slate-800 cursor-pointer disabled:cursor-not-allowed"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

function ConfirmModal({ nome, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600"/>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Confirmar exclusão</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Excluir <strong>{nome}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-2xl text-sm font-medium hover:bg-red-700 transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function EditarServidor({ servidor, onBack, isAdmin }) {
  const cadastroId = getCadastroId(servidor);

  const [form, setForm]           = useState(null);
  const [original, setOriginal]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [erro, setErro]           = useState("");
  const [errors, setErrors]       = useState({});
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!servidor) return;

    // Sem cadastro UUID → monta form com dados básicos do objeto servidor
    if (!cadastroId) {
      const f = {
        nome:            servidor.nome ?? "",
        email:           "",
        telefone:        "",
        data_nascimento: "",
        endereco:        "",
        escola_raw:      (servidor.nomeacoes ?? []).map(n => n.escola?.name).filter(Boolean).join(", "),
        funcao:          servidor.nomeacoes?.[0]?.cargo ?? "",
        tipo_vinculo:    servidor.nomeacoes?.[0]?.tipo_vinculo ?? "",
        matricula:       servidor.nomeacoes?.[0]?.matricula ?? "",
        _semCadastro:    true,
      };
      setForm(f);
      setOriginal(f);
      setLoading(false);
      return;
    }

    // Tem UUID → busca na tabela servidores_unificado
    setLoading(true);
    supabase
      .from("servidores_unificado")
      .select("*")
      .eq("id", cadastroId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          // Fallback: usa dados do objeto servidor em memória
          const f = {
            nome:            servidor.nome ?? "",
            email:           servidor.cadastro?.email ?? "",
            telefone:        servidor.cadastro?.telefone ?? "",
            data_nascimento: servidor.cadastro?.data_nascimento ?? "",
            endereco:        servidor.cadastro?.endereco ?? "",
            escola_raw:      servidor.cadastro?.escola_raw ?? "",
            funcao:          "",
            tipo_vinculo:    "",
            matricula:       "",
            _semCadastro:    false,
          };
          setForm(f);
          setOriginal(f);
          setLoading(false);
          return;
        }
        const f = {
          nome:            data.nome             ?? "",
          email:           data.email            ?? "",
          telefone:        data.telefone         ?? "",
          data_nascimento: data.data_nascimento  ?? "",
          endereco:        data.endereco         ?? "",
          escola_raw:      data.escola_raw       ?? "",
          funcao:          data.funcao           ?? "",
          tipo_vinculo:    data.tipo_vinculo     ?? "",
          matricula:       data.matricula        ?? "",
          _semCadastro:    false,
        };
        setForm(f);
        setOriginal(f);
        setLoading(false);
      });
  }, [servidor, cadastroId]);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
    setSaved(false);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "E-mail inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setErro(""); setSaved(false);

    const nomeNorm = (form.nome || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    const payload = {
      nome:             form.nome.trim(),
      nome_normalizado: nomeNorm,
      email:            form.email.trim()     || null,
      telefone:         form.telefone.trim()  || null,
      data_nascimento:  form.data_nascimento  || null,
      endereco:         form.endereco.trim()  || null,
      escola_raw:       form.escola_raw.trim() || null,
      funcao:           form.funcao           || null,
      tipo_vinculo:     form.tipo_vinculo     || null,
      matricula:        form.matricula.trim() || null,
      updated_at:       new Date().toISOString(),
    };

    let error;

    if (cadastroId) {
      // Atualiza registro existente
      ({ error } = await supabase
        .from("servidores_unificado")
        .update(payload)
        .eq("id", cadastroId));
    } else {
      // Cria novo cadastro para professor sem registro cadastral
      ({ error } = await supabase
        .from("servidores_unificado")
        .insert(payload));
    }

    setSaving(false);
    if (error) {
      setErro(error.message || "Erro ao salvar. Tente novamente.");
    } else {
      setSaved(true);
      setOriginal({ ...form });
    }
  }

  async function handleDelete() {
    setConfirmDel(false);
    if (!cadastroId) { onBack({}); return; }
    const { error } = await supabase
      .from("servidores_unificado")
      .delete()
      .eq("id", cadastroId);
    if (!error) onBack({ deleted: true, nome: form.nome });
    else setErro("Erro ao excluir: " + error.message);
  }

  const dirty = form && original &&
    Object.keys(form)
      .filter(k => k !== "_semCadastro")
      .some(k => (form[k] ?? "") !== (original[k] ?? ""));

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 flex items-center gap-4 shadow-2xl">
        <Loader2 size={22} className="animate-spin text-slate-400"/>
        <p className="text-sm text-slate-600">Carregando dados…</p>
      </div>
    </div>
  );

  if (!form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={() => !dirty && onBack({})}>
      <div
        className="bg-white w-full md:max-w-lg md:mx-4 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200"/>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <button onClick={() => onBack({})} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <ArrowLeft size={17} className="text-slate-500"/>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900 truncate">{form.nome || "Editar Servidor"}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {cadastroId ? "Dados cadastrais" : "Criar cadastro para este servidor"}
            </p>
          </div>
          {dirty && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl shrink-0">
              Não salvo
            </span>
          )}
        </div>

        {/* Corpo — scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Aviso professor sem cadastro */}
          {form._semCadastro && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2">
              <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5"/>
              <p className="text-xs text-blue-700">
                Este professor não tem dados cadastrais registrados. Preencha abaixo para criar o cadastro.
              </p>
            </div>
          )}

          {/* Dados pessoais */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dados Pessoais</p>
            <div>
              <FieldLabel required>Nome completo</FieldLabel>
              <Field icon={User} value={form.nome} onChange={e=>set("nome",e.target.value)}
                placeholder="Nome completo" error={errors.nome} disabled={!isAdmin}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Nascimento</FieldLabel>
                <Field icon={Calendar} type="date" value={form.data_nascimento}
                  onChange={e=>set("data_nascimento",e.target.value)} disabled={!isAdmin}/>
              </div>
              <div>
                <FieldLabel>Telefone</FieldLabel>
                <Field icon={Phone} type="tel" value={form.telefone}
                  onChange={e=>set("telefone",e.target.value)}
                  placeholder="(54) 9 9999-9999" disabled={!isAdmin}/>
              </div>
            </div>
            <div>
              <FieldLabel>E-mail</FieldLabel>
              <Field icon={Mail} type="email" value={form.email}
                onChange={e=>set("email",e.target.value)}
                placeholder="email@exemplo.com" error={errors.email} disabled={!isAdmin}/>
            </div>
            <div>
              <FieldLabel>Endereço</FieldLabel>
              <Field icon={MapPin} value={form.endereco}
                onChange={e=>set("endereco",e.target.value)}
                placeholder="Rua, número, bairro" disabled={!isAdmin}/>
            </div>
          </div>

          {/* Vínculo */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vínculo Funcional</p>
            <div>
              <FieldLabel>Função / Cargo</FieldLabel>
              <SelectField icon={Briefcase} value={form.funcao}
                onChange={e=>set("funcao",e.target.value)} disabled={!isAdmin}>
                <option value="">Não informado</option>
                {FUNCOES.map(f=><option key={f}>{f}</option>)}
              </SelectField>
            </div>
            <div>
              <FieldLabel>Escola(s)</FieldLabel>
              <Field icon={School} value={form.escola_raw}
                onChange={e=>set("escola_raw",e.target.value)}
                placeholder="Ex.: EMEF Coronel Avelino" disabled={!isAdmin}/>
              <p className="text-xs text-slate-400 mt-1">Separe com vírgula para múltiplas escolas</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Matrícula</FieldLabel>
                <Field icon={Hash} value={form.matricula}
                  onChange={e=>set("matricula",e.target.value)}
                  placeholder="2024-0512" disabled={!isAdmin}/>
              </div>
              <div>
                <FieldLabel>Vínculo</FieldLabel>
                <SelectField value={form.tipo_vinculo}
                  onChange={e=>set("tipo_vinculo",e.target.value)} disabled={!isAdmin}>
                  <option value="">Não informado</option>
                  <option>Efetivo</option>
                  <option>Designação</option>
                  <option>Contratado</option>
                  <option>Estágio</option>
                </SelectField>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5"/>
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}
          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600"/>
              <p className="text-sm text-emerald-700">Dados salvos com sucesso!</p>
            </div>
          )}
          {!isAdmin && (
            <p className="text-xs text-slate-400 text-center">
              Apenas Secretaria e RH podem editar cadastros.
            </p>
          )}
        </div>

        {/* Rodapé com botões */}
        {isAdmin && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 px-4 py-3 border border-red-200 text-red-500 rounded-2xl text-sm font-medium hover:bg-red-50 transition-colors">
              <Trash2 size={14}/> Excluir
            </button>
            <button onClick={handleSave} disabled={saving || !dirty}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all">
              {saving
                ? <><Loader2 size={14} className="animate-spin"/> Salvando…</>
                : <><Save size={14}/> {dirty ? "Salvar alterações" : "Sem alterações"}</>
              }
            </button>
          </div>
        )}
      </div>

      {confirmDel && (
        <ConfirmModal
          nome={form.nome}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
