import { useState, useEffect } from "react";
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase,
  School, Hash, Save, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Trash2, X,
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

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}
function Field({ icon: Icon, error, textarea, ...props }) {
  const base = `w-full bg-slate-50 border rounded-xl text-sm outline-none transition-colors placeholder:text-slate-300 text-slate-800 ${
    error ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-slate-400"
  }`;
  return (
    <div>
      <div className={`flex items-start gap-3 px-3 ${textarea ? "py-2.5" : "py-3"} ${base}`}>
        {Icon && <Icon size={15} className={`shrink-0 mt-0.5 ${error ? "text-red-400" : "text-slate-400"}`}/>}
        {textarea
          ? <textarea rows={2} className="flex-1 bg-transparent outline-none resize-none" {...props}/>
          : <input className="flex-1 bg-transparent outline-none" {...props}/>
        }
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
    </div>
  );
}

// ─── MODAL DE CONFIRMAÇÃO ─────────────────────────────────────────────────────

function ConfirmModal({ msg, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600"/>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Confirmar exclusão</p>
            <p className="text-xs text-slate-500 mt-0.5">{msg}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
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

export default function EditarServidor({ servidorId, onBack, escolas, isAdmin }) {
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState("");
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Carrega dados do servidor
  useEffect(() => {
    if (!servidorId) return;
    setLoading(true);

    // Trata IDs com prefixo "cad_" (servidores sem professor)
    const realId = String(servidorId).replace(/^cad_/, "");

    supabase
      .from("servidores_unificado")
      .select("*")
      .eq("id", realId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErro("Servidor não encontrado na base cadastral.");
          setLoading(false);
          return;
        }
        const f = {
          nome:            data.nome            ?? "",
          email:           data.email           ?? "",
          telefone:        data.telefone        ?? "",
          data_nascimento: data.data_nascimento ?? "",
          endereco:        data.endereco        ?? "",
          escola_raw:      data.escola_raw      ?? "",
          funcao:          data.funcao          ?? "",
          tipo_vinculo:    data.tipo_vinculo    ?? "",
          matricula:       data.matricula       ?? "",
        };
        setForm(f);
        setOriginal(f);
        setLoading(false);
      });
  }, [servidorId]);

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

    const realId = String(servidorId).replace(/^cad_/, "");
    const nomeNorm = (form.nome || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    const { error } = await supabase
      .from("servidores_unificado")
      .update({
        nome:            form.nome.trim(),
        nome_normalizado: nomeNorm,
        email:           form.email.trim()    || null,
        telefone:        form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        endereco:        form.endereco.trim() || null,
        escola_raw:      form.escola_raw.trim() || null,
        funcao:          form.funcao          || null,
        tipo_vinculo:    form.tipo_vinculo    || null,
        matricula:       form.matricula.trim() || null,
        updated_at:      new Date().toISOString(),
      })
      .eq("id", realId);

    setSaving(false);
    if (error) {
      setErro(error.message || "Erro ao salvar. Tente novamente.");
    } else {
      setSaved(true);
      setOriginal({ ...form });
    }
  }

  async function handleDelete() {
    const realId = String(servidorId).replace(/^cad_/, "");
    const { error } = await supabase
      .from("servidores_unificado")
      .delete()
      .eq("id", realId);
    if (!error) onBack({ deleted: true, nome: form.nome });
    else setErro("Erro ao excluir: " + error.message);
    setConfirmDelete(false);
  }

  // Detecta campos alterados
  const dirty = form && original &&
    Object.keys(form).some(k => form[k] !== original[k]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-slate-400"/>
    </div>
  );

  if (erro && !form) return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5"/>
        <p className="text-sm text-red-600">{erro}</p>
      </div>
    </div>
  );

  if (!form) return null;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onBack()} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
          <ArrowLeft size={18} className="text-slate-400"/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 truncate">
            {form.nome || "Editar Servidor"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Dados cadastrais</p>
        </div>
        {dirty && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl shrink-0">
            Alterações pendentes
          </span>
        )}
      </div>

      {/* Card do formulário */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">

        {/* Dados pessoais */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Dados Pessoais
          </h2>
          <div>
            <FieldLabel required>Nome completo</FieldLabel>
            <Field icon={User} value={form.nome} onChange={e=>set("nome",e.target.value)}
              placeholder="Nome do servidor" error={errors.nome} disabled={!isAdmin}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Data de nascimento</FieldLabel>
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
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Vínculo Funcional
          </h2>
          <div>
            <FieldLabel>Função / Cargo</FieldLabel>
            <div className={`flex items-center gap-3 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl ${!isAdmin?"opacity-60":""}`}>
              <Briefcase size={15} className="text-slate-400 shrink-0"/>
              <select
                value={form.funcao}
                onChange={e=>set("funcao",e.target.value)}
                disabled={!isAdmin}
                className="flex-1 bg-transparent text-sm outline-none text-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <option value="">Não informado</option>
                {FUNCOES.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
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
                placeholder="Ex.: 2024-0512" disabled={!isAdmin}/>
            </div>
            <div>
              <FieldLabel>Tipo de vínculo</FieldLabel>
              <div className={`flex items-center gap-3 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl ${!isAdmin?"opacity-60":""}`}>
                <select
                  value={form.tipo_vinculo}
                  onChange={e=>set("tipo_vinculo",e.target.value)}
                  disabled={!isAdmin}
                  className="flex-1 bg-transparent text-sm outline-none text-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="">Não informado</option>
                  <option>Efetivo</option>
                  <option>Designação</option>
                  <option>Contratado</option>
                  <option>Estágio</option>
                </select>
              </div>
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
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0"/>
            <p className="text-sm text-emerald-700">Dados salvos com sucesso!</p>
          </div>
        )}

        {/* Não admin: aviso */}
        {!isAdmin && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
            Apenas Secretaria e RH podem editar cadastros.
          </div>
        )}

        {/* Botões */}
        {isAdmin && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-4 py-3 border border-red-200 text-red-500 rounded-2xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14}/> Excluir
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin"/> Salvando…</>
                : <><Save size={14}/> {dirty ? "Salvar alterações" : "Sem alterações"}</>
              }
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          msg={`Excluir "${form.nome}" permanentemente? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
