import { useState, useEffect } from 'react'
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase,
  School, Hash, Save, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Trash2, X, GraduationCap, KeyRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { atualizarServidor, atualizarLotacoes, excluirServidor, criarServidor } from '../hooks/useData'

const FUNCOES = [
  { g: 'Docentes',              v: 'Professor(a) Ed. Básica I' },
  { g: 'Docentes',              v: 'Professor(a) Ed. Básica II' },
  { g: 'Docentes',              v: 'Professor(a) Ed. Infantil' },
  { g: 'Docentes',              v: 'Professor(a) Ed. Física' },
  { g: 'Docentes',              v: 'Professor(a) Ed. Especial' },
  { g: 'Gestão',                v: 'Diretor(a)' },
  { g: 'Gestão',                v: 'Coordenador(a) Pedagógico(a)' },
  { g: 'Técnico-Administrativo',v: 'Secretário(a) Escolar' },
  { g: 'Técnico-Administrativo',v: 'Assistente Administrativo' },
  { g: 'Técnico-Administrativo',v: 'Técnico Administrativo' },
  { g: 'Apoio',                 v: 'Merendeira' },
  { g: 'Apoio',                 v: 'Servente' },
  { g: 'Apoio',                 v: 'Zelador(a)' },
  { g: 'Apoio',                 v: 'Porteiro(a)' },
  { g: 'Apoio',                 v: 'Vigia' },
  { g: 'Apoio',                 v: 'Auxiliar de Serviços Gerais' },
  { g: 'Apoio',                 v: 'Atendente / Monitor(a)' },
  { g: 'Outros',                v: 'Outro' },
]
const GRUPOS = [...new Set(FUNCOES.map(f => f.g))]
const VINCULOS = ['Efetivo', 'Designação', 'Contratado', 'Temporário', 'Estágio']

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}
function Input({ icon: Icon, error, disabled, ...props }) {
  return (
    <div>
      <div className={`flex items-center gap-3 px-3 py-3 border rounded-xl transition-colors ${
        disabled ? 'bg-slate-50 border-slate-100 opacity-60'
        : error  ? 'bg-red-50 border-red-300'
                 : 'bg-slate-50 border-slate-200 focus-within:border-slate-400'
      }`}>
        {Icon && <Icon size={15} className="shrink-0 text-slate-400" />}
        <input disabled={disabled}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300 text-slate-800 disabled:cursor-not-allowed"
          {...props} />
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  )
}
function SelectInput({ icon: Icon, disabled, children, ...props }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400 transition-colors ${disabled ? 'opacity-60' : ''}`}>
      {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
      <select disabled={disabled}
        className="flex-1 bg-transparent text-sm outline-none text-slate-800 cursor-pointer disabled:cursor-not-allowed"
        {...props}>
        {children}
      </select>
    </div>
  )
}
function ConfirmModal({ nome, onConfirm, onCancel }) {
  const [confirmacao, setConfirmacao] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [verificando, setVerificando] = useState(false)

  async function confirmarExclusao() {
    const nomeEsperado = String(nome ?? '').trim().toLocaleLowerCase()
    if (!nomeEsperado || confirmacao.trim().toLocaleLowerCase() !== nomeEsperado) {
      setErro('Digite o nome completo exatamente como aparece acima.')
      return
    }
    if (!senha) {
      setErro('Digite sua senha para confirmar a exclusão.')
      return
    }

    setVerificando(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setVerificando(false)
      setErro('Não foi possível identificar o usuário autenticado.')
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senha,
    })
    setVerificando(false)
    if (authError) {
      setErro('Senha incorreta. A exclusão não foi realizada.')
      return
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Excluir servidor permanentemente?</p>
            <p className="text-xs text-slate-500 mt-0.5">Esta ação não pode ser desfeita e remove também vínculos e efetividades relacionados.</p>
          </div>
        </div>
        <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700">
          Para continuar, confirme o servidor <strong>{nome || 'sem nome'}</strong> e informe sua senha de acesso.
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Digite o nome do servidor</span>
          <input value={confirmacao} onChange={event => { setConfirmacao(event.target.value); setErro('') }} autoFocus placeholder={nome || 'Nome completo'} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-800 focus:border-red-300" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Senha do usuário logado</span>
          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-red-300">
            <KeyRound size={15} className="text-slate-400 shrink-0" />
            <input type="password" value={senha} onChange={event => { setSenha(event.target.value); setErro('') }} autoComplete="current-password" placeholder="Sua senha" className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" />
          </div>
        </label>
        {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button onClick={onCancel} disabled={verificando} className="flex-1 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button onClick={confirmarExclusao} disabled={verificando} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-2xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {verificando ? <><Loader2 size={14} className="animate-spin" /> Verificando…</> : 'Confirmar exclusão'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EditarServidor({ servidor, onClose, onSaved, onDeleted, escolas = [], isNovo = false }) {
  const [form, setForm] = useState({
    nome:            servidor?.nome            ?? '',
    status:          servidor?.status          ?? 'Ativo',
    funcao:          servidor?.funcao          ?? '',
    tipo_vinculo:    servidor?.tipo_vinculo    ?? '',
    matricula:       servidor?.matricula       ?? '',
    email:           servidor?.email           ?? '',
    telefone:        servidor?.telefone        ?? '',
    data_nascimento: servidor?.data_nascimento ?? '',
    endereco:        servidor?.endereco        ?? '',
    formacao:        servidor?.formacao        ?? '',
    observacoes:     servidor?.observacoes     ?? '',
  })

  // Escolas vinculadas (ids como strings)
  const [escolasSel, setEscolasSel] = useState(
    (servidor?.lotacoes ?? []).map(l => String(l.escola_id))
  )

  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [erro, setErro]       = useState('')
  const [errors, setErrors]   = useState({})
  const [confirmDel, setConfirmDel] = useState(false)

  function set(k, v) {
    setForm(p => ({ ...p, [k]: v }))
    setSaved(false)
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  function addEscola(id) {
    if (!id || escolasSel.includes(id)) return
    setEscolasSel(p => [...p, id])
    setSaved(false)
  }
  function removeEscola(id) {
    setEscolasSel(p => p.filter(e => e !== id))
    setSaved(false)
  }

  function validate() {
    const errs = {}
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'E-mail inválido'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true); setErro(''); setSaved(false)

    let error
    if (isNovo) {
      const res = await criarServidor(form, escolasSel)
      error = res.error
    } else {
      const r1 = await atualizarServidor(servidor.id, form)
      error = r1.error
      if (!error && lotacoesMudaram) {
        const r2 = await atualizarLotacoes(servidor.id, escolasSel)
        error = r2.error
      }
    }

    setSaving(false)
    if (error) {
      setErro(error.message || 'Erro ao salvar. Tente novamente.')
    } else {
      setSaved(true)
      setTimeout(() => { onSaved?.(); onClose?.() }, 800)
    }
  }

  async function handleDelete() {
    setConfirmDel(false)
    const { error } = await excluirServidor(servidor.id)
    if (!error) { onDeleted?.(); onClose?.() }
    else setErro('Erro ao excluir: ' + error.message)
  }

  const escolasDisponiveis = escolas.filter(e => !escolasSel.includes(String(e.id)))
  const escolasVinculadas  = escolasSel
    .map(id => escolas.find(e => String(e.id) === id))
    .filter(Boolean)
  const escolasOriginais = (servidor?.lotacoes ?? []).map(lotacao => String(lotacao.escola_id)).sort()
  const escolasAtuaisOrdenadas = [...escolasSel].sort()
  const lotacoesMudaram = JSON.stringify(escolasOriginais) !== JSON.stringify(escolasAtuaisOrdenadas)

  const TIPO_COLORS = {
    EMEI: 'bg-violet-50 text-violet-700 border-violet-200',
    EMEF: 'bg-blue-50 text-blue-700 border-blue-200',
    'EMEF Campo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SMED: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white w-full md:max-w-lg md:mx-4 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-0.5rem)] md:max-h-[94vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <ArrowLeft size={17} className="text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900 truncate">
              {isNovo ? 'Novo Servidor' : (form.nome || 'Editar Servidor')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isNovo ? 'Preencha os dados do novo servidor' : 'Editar dados cadastrais'}
            </p>
          </div>
        </div>

        {/* Corpo scrollável */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">

          {/* Dados pessoais */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
              Dados Pessoais
            </p>
            <div>
              <FieldLabel required>Nome completo</FieldLabel>
              <Input icon={User} value={form.nome} onChange={e => set('nome', e.target.value)}
                placeholder="Nome completo" error={errors.nome} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectInput value={form.status} onChange={e => set('status', e.target.value)}>
                  <option>Ativo</option>
                  <option>Afastado</option>
                  <option>Inativo</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Nascimento</FieldLabel>
                <Input icon={Calendar} type="date" value={form.data_nascimento}
                  onChange={e => set('data_nascimento', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Telefone</FieldLabel>
                <Input icon={Phone} type="tel" value={form.telefone}
                  onChange={e => set('telefone', e.target.value)} placeholder="(54) 9 9999-9999" />
              </div>
              <div>
                <FieldLabel>E-mail</FieldLabel>
                <Input icon={Mail} type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="email@..." error={errors.email} />
              </div>
            </div>
            <div>
              <FieldLabel>Endereço</FieldLabel>
              <Input icon={MapPin} value={form.endereco}
                onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, bairro" />
            </div>
            <div>
              <FieldLabel>Formação</FieldLabel>
              <Input icon={GraduationCap} value={form.formacao}
                onChange={e => set('formacao', e.target.value)} placeholder="Ex.: Pedagogia, Letras..." />
            </div>
          </div>

          {/* Vínculo funcional */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
              Vínculo Funcional
            </p>

            <div>
              <FieldLabel>Função / Cargo</FieldLabel>
              <SelectInput icon={Briefcase} value={form.funcao} onChange={e => set('funcao', e.target.value)}>
                <option value="">Não informado</option>
                {GRUPOS.map(g => (
                  <optgroup key={g} label={`── ${g}`}>
                    {FUNCOES.filter(f => f.g === g).map(f => (
                      <option key={f.v}>{f.v}</option>
                    ))}
                  </optgroup>
                ))}
              </SelectInput>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Tipo de vínculo</FieldLabel>
                <SelectInput value={form.tipo_vinculo} onChange={e => set('tipo_vinculo', e.target.value)}>
                  <option value="">Não informado</option>
                  {VINCULOS.map(v => <option key={v}>{v}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Matrícula</FieldLabel>
                <Input icon={Hash} value={form.matricula}
                  onChange={e => set('matricula', e.target.value)} placeholder="2024-0512" />
              </div>
            </div>

            {/* Escolas vinculadas como tags */}
            <div>
              <FieldLabel>Escola(s) de lotação</FieldLabel>
              {!isNovo && <p className="text-xs text-slate-400 mb-2">Remover uma escola encerra o vínculo e preserva o registro no histórico. Para uma mudança de unidade, prefira <strong className="font-medium text-slate-500">Transferir</strong>.</p>}

              {escolasVinculadas.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {escolasVinculadas.map(e => (
                    <div key={e.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-700">
                      <School size={11} />
                      <span className="max-w-[180px] truncate">{e.name}</span>
                      <button onClick={() => removeEscola(String(e.id))}
                        className="ml-0.5 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400 transition-colors">
                <School size={14} className="text-slate-400 shrink-0" />
                <select
                  className="flex-1 bg-transparent text-sm outline-none text-slate-600 cursor-pointer"
                  onChange={e => { addEscola(e.target.value); e.target.value = '' }}
                  defaultValue=""
                >
                  <option value="">+ Adicionar escola...</option>
                  {/* SMED primeiro */}
                  {escolasDisponiveis.filter(e => e.tipo === 'SMED').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                  {['EMEF', 'EMEI', 'EMEF Campo'].map(tipo => (
                    <optgroup key={tipo} label={`── ${tipo}`}>
                      {escolasDisponiveis.filter(e => e.tipo === tipo).map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {escolasVinculadas.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">Nenhuma escola vinculada</p>
              )}
            </div>

            <div>
              <FieldLabel>Observações</FieldLabel>
              <div className="flex items-start gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400 transition-colors">
                <textarea rows={2} value={form.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  placeholder="Observações gerais..."
                  className="flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-slate-300 text-slate-800" />
              </div>
            </div>
          </div>

          {/* Feedback */}
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}
          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <p className="text-sm text-emerald-700">Salvo com sucesso!</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="modal-footer-safe px-4 sm:px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
          {!isNovo && (
            <button onClick={() => setConfirmDel(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 border border-red-200 text-red-600 rounded-2xl text-sm font-medium hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> <span>Excluir servidor</span>
            </button>
          )}
          <button onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Salvando…</>
              : <><Save size={14} /> {isNovo ? 'Criar servidor' : 'Salvar alterações'}</>
            }
          </button>
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal nome={form.nome} onConfirm={handleDelete} onCancel={() => setConfirmDel(false)} />
      )}
    </div>
  )
}
