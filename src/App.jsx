import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search, School, Users, Home, FileText, LogOut,
  CheckCircle2, AlertCircle, ArrowRightLeft, X,
  Menu, ChevronRight, GraduationCap, Briefcase,
  Loader2, RefreshCw, Shield, Plus, Edit2, Save,
  ChevronDown, UserPlus, Trash2
} from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import {
  useEscolas, useProfessores, useProfessoresByEscola,
  useServidores, useEfetividade, useDashboardStats, buscarGlobal,
  criarProfessor, atualizarProfessor, adicionarNomeacao, removerNomeacao,
  criarServidor, atualizarServidor
} from './hooks/useData'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  'EMEI':       'bg-violet-50 text-violet-700 border-violet-200',
  'EMEF':       'bg-blue-50   text-blue-700   border-blue-200',
  'EMEF Campo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const OCORRENCIAS = ['Falta','Licença Médica','Licença Maternidade','Licença Prêmio','Substituição','Afastamento']
const CARGOS_SERVIDOR = ['Merendeira','Servente','Secretário(a)','Auxiliar Administrativo','Vigia','Porteiro(a)','Zelador(a)','Assistente de Educação','Auxiliar de Serviços Gerais','Outro']
const VINCULOS = ['Efetivo','Designação','Contratado']

function mesAnoAtual() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
}
function mesAnoLabel(s) {
  if (!s) return ''
  const [ano,mes] = s.split('-')
  const m=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
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
  const sizes={sm:'w-8 h-8 text-xs',md:'w-10 h-10 text-sm',lg:'w-14 h-14 text-base'}
  const cols=['bg-blue-100 text-blue-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700','bg-cyan-100 text-cyan-700']
  return <div className={`${sizes[size]} ${cols[(name.charCodeAt(0)||0)%cols.length]} rounded-xl flex items-center justify-center font-semibold shrink-0`}>{initials(name)}</div>
}
function Spinner() {
  return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400"/></div>
}
function RoleBadge({ role }) {
  const map={secretaria:{l:'Secretaria',c:'bg-violet-50 text-violet-700 border-violet-200'},rh:{l:'RH',c:'bg-blue-50 text-blue-700 border-blue-200'},diretor:{l:'Diretor',c:'bg-emerald-50 text-emerald-700 border-emerald-200'},professor:{l:'Professor',c:'bg-slate-100 text-slate-600 border-slate-200'}}
  const {l,c}=map[role]||map.professor
  return <Badge className={c}><Shield size={10}/>{l}</Badge>
}
function FieldLabel({ children }) {
  return <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">{children}</label>
}
function Input({ className='', ...props }) {
  return <input className={`w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 ${className}`} {...props}/>
}
function Select({ className='', children, ...props }) {
  return <select className={`w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 transition-colors ${className}`} {...props}>{children}</select>
}
function isAdmin(profile) {
  return profile?.role === 'secretaria' || profile?.role === 'rh'
}

// ─── FORMULÁRIO PROFESSOR ────────────────────────────────────────────────────

function FormProfessor({ prof, escolas, onClose, onSaved }) {
  const editando = !!prof
  const [form, setForm] = useState({
    nome: prof?.nome ?? '',
    email: prof?.email ?? '',
    telefone: prof?.telefone ?? '',
    formacao: prof?.formacao ?? '',
    regencia_h: prof?.regencia_h ?? '',
    htp_h: prof?.htp_h ?? '',
    hti_h: prof?.hti_h ?? '',
    status: prof?.status ?? 'Ativo',
  })
  const [nomeacoes, setNomeacoes] = useState(
    prof?.nomeacoes?.map(n => ({ id: n.id, escola_id: n.escola?.id ?? '', matricula: n.matricula ?? '', cargo: n.cargo ?? '', tipo_vinculo: n.tipo_vinculo ?? 'Efetivo', _novo: false })) ?? []
  )
  const [novaEscola, setNovaEscola] = useState({ escola_id: '', matricula: '', cargo: '', tipo_vinculo: 'Efetivo' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })) }

  async function handleSave() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSaving(true); setErro('')
    try {
      if (editando) {
        const { error } = await atualizarProfessor(prof.id, form)
        if (error) throw error
      } else {
        const { data, error } = await criarProfessor({
          ...form,
          regencia_h: form.regencia_h ? parseInt(form.regencia_h) : null,
          htp_h: form.htp_h ? parseInt(form.htp_h) : null,
          hti_h: form.hti_h ? parseInt(form.hti_h) : null,
          nomeacoes: nomeacoes.filter(n => n.escola_id).map(n => ({
            escola_id: parseInt(n.escola_id), matricula: n.matricula, cargo: n.cargo, tipo_vinculo: n.tipo_vinculo
          }))
        })
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch(e) { setErro(e.message ?? 'Erro ao salvar.') }
    setSaving(false)
  }

  async function handleAddNomeacao() {
    if (!novaEscola.escola_id) return
    if (editando && prof.id) {
      await adicionarNomeacao(prof.id, { escola_id: parseInt(novaEscola.escola_id), matricula: novaEscola.matricula, cargo: novaEscola.cargo, tipo_vinculo: novaEscola.tipo_vinculo })
      onSaved()
    } else {
      setNomeacoes(prev => [...prev, { ...novaEscola, _novo: true }])
    }
    setNovaEscola({ escola_id: '', matricula: '', cargo: '', tipo_vinculo: 'Efetivo' })
  }

  async function handleRemoveNomeacao(n, idx) {
    if (n.id && !n._novo) {
      await removerNomeacao(n.id)
      onSaved()
    }
    setNomeacoes(prev => prev.filter((_,i) => i !== idx))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="bg-slate-950 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{editando ? 'Editar Professor' : 'Novo Professor'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{editando ? prof.nome : 'Preencha os dados do professor'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X size={16} className="text-white"/></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Dados pessoais */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados pessoais</p>
            <div className="space-y-3">
              <div>
                <FieldLabel>Nome completo *</FieldLabel>
                <Input value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome do professor"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>E-mail</FieldLabel>
                  <Input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@vacaria.rs.gov.br"/>
                </div>
                <div>
                  <FieldLabel>Telefone</FieldLabel>
                  <Input value={form.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(54) 9 9999-9999"/>
                </div>
              </div>
              <div>
                <FieldLabel>Formação</FieldLabel>
                <Input value={form.formacao} onChange={e=>set('formacao',e.target.value)} placeholder="Ex.: Pedagogia + Especialização"/>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <Select value={form.status} onChange={e=>set('status',e.target.value)}>
                  <option>Ativo</option><option>Afastado</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Carga horária */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Carga horária semanal</p>
            <div className="grid grid-cols-3 gap-3">
              {[['Regência','regencia_h'],['HTP','htp_h'],['HTI','hti_h']].map(([l,k])=>(
                <div key={k}>
                  <FieldLabel>{l} (h)</FieldLabel>
                  <Input type="number" min="0" max="40" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder="0"/>
                </div>
              ))}
            </div>
          </div>

          {/* Nomeações */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Nomeações / Escolas</p>
            <div className="space-y-2 mb-3">
              {nomeacoes.map((n,i)=>{
                const escola = escolas.find(e=>e.id===parseInt(n.escola_id))
                return (
                  <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                    <School size={14} className="text-slate-400 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{escola?.name ?? '—'}</p>
                      {n.matricula&&<p className="text-xs text-slate-400 font-mono">{n.matricula}</p>}
                    </div>
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200">{n.tipo_vinculo}</Badge>
                    <button onClick={()=>handleRemoveNomeacao(n,i)} className="p-1 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={13}/></button>
                  </div>
                )
              })}
              {nomeacoes.length===0&&<p className="text-xs text-slate-400 italic">Nenhuma nomeação. Adicione abaixo.</p>}
            </div>
            {/* Adicionar nomeação */}
            <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500">Adicionar nomeação</p>
              <Select value={novaEscola.escola_id} onChange={e=>setNovaEscola(p=>({...p,escola_id:e.target.value}))}>
                <option value="">Selecionar escola...</option>
                {escolas.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input value={novaEscola.matricula} onChange={e=>setNovaEscola(p=>({...p,matricula:e.target.value}))} placeholder="Matrícula"/>
                <Input value={novaEscola.cargo} onChange={e=>setNovaEscola(p=>({...p,cargo:e.target.value}))} placeholder="Cargo"/>
              </div>
              <div className="flex gap-2">
                <Select value={novaEscola.tipo_vinculo} onChange={e=>setNovaEscola(p=>({...p,tipo_vinculo:e.target.value}))}>
                  {VINCULOS.map(v=><option key={v}>{v}</option>)}
                </Select>
                <button onClick={handleAddNomeacao} disabled={!novaEscola.escola_id} className="px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-40 shrink-0">
                  <Plus size={13}/>
                </button>
              </div>
            </div>
          </div>

          {erro&&<div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{erro}</div>}
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-950 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
            {saving?'Salvando…':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FORMULÁRIO SERVIDOR ─────────────────────────────────────────────────────

function FormServidor({ servidor, escolas, onClose, onSaved }) {
  const editando = !!servidor
  const [form, setForm] = useState({
    nome: servidor?.nome ?? '',
    email: servidor?.email ?? '',
    telefone: servidor?.telefone ?? '',
    cargo: servidor?.cargo ?? '',
    escola_id: servidor?.escola?.id ?? '',
    status: servidor?.status ?? 'Ativo',
    observacoes: servidor?.observacoes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })) }

  async function handleSave() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSaving(true); setErro('')
    const payload = { ...form, escola_id: form.escola_id ? parseInt(form.escola_id) : null }
    try {
      if (editando) {
        const { error } = await atualizarServidor(servidor.id, payload)
        if (error) throw error
      } else {
        const { error } = await criarServidor(payload)
        if (error) throw error
      }
      onSaved(); onClose()
    } catch(e) { setErro(e.message ?? 'Erro ao salvar.') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="bg-slate-950 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{editando ? 'Editar Servidor' : 'Novo Servidor'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pessoal técnico-administrativo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X size={16} className="text-white"/></button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <FieldLabel>Nome completo *</FieldLabel>
            <Input value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome do servidor"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>E-mail</FieldLabel>
              <Input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@"/>
            </div>
            <div>
              <FieldLabel>Telefone</FieldLabel>
              <Input value={form.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(54) 9..."/>
            </div>
          </div>
          <div>
            <FieldLabel>Cargo / Função</FieldLabel>
            <Select value={form.cargo} onChange={e=>set('cargo',e.target.value)}>
              <option value="">Selecionar cargo...</option>
              {CARGOS_SERVIDOR.map(c=><option key={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Escola</FieldLabel>
            <Select value={form.escola_id} onChange={e=>set('escola_id',e.target.value)}>
              <option value="">Sem escola vinculada</option>
              {escolas.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Ativo</option><option>Afastado</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Observações</FieldLabel>
            <textarea value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} rows={2} placeholder="Opcional..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 transition-colors resize-none placeholder:text-slate-300"/>
          </div>
          {erro&&<div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{erro}</div>}
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-950 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
            {saving?'Salvando…':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PROFESSOR MODAL (visualização) ──────────────────────────────────────────

function ProfessorModal({ prof, onClose, onEdit, isAdmin }) {
  if (!prof) return null
  const nomeacoes = prof.nomeacoes ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="relative bg-slate-950 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white">{initials(prof.nome)}</div>
              <div>
                <h2 className="text-lg font-semibold text-white leading-snug">{prof.nome}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${prof.status==='Ativo'?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/20 text-amber-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prof.status==='Ativo'?'bg-emerald-400':'bg-amber-400'}`}/>{prof.status}
                  </span>
                  {nomeacoes.length>1&&<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300"><Briefcase size={10}/>{nomeacoes.length} nomeações</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin&&<button onClick={()=>onEdit(prof)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors" title="Editar"><Edit2 size={15} className="text-white"/></button>}
              <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X size={16} className="text-white"/></button>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nomeações / Escolas</p>
            <div className="space-y-2">
              {nomeacoes.length===0&&<p className="text-sm text-slate-400 italic">Nenhuma nomeação</p>}
              {nomeacoes.map((n,i)=>{
                const escola=n.escola??{}
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <School size={15} className="text-slate-400 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{escola.name??'—'}</p>
                      {n.matricula&&<p className="text-xs font-mono text-slate-400 mt-0.5">{n.matricula}</p>}
                      {n.cargo&&<p className="text-xs text-slate-500">{n.cargo}</p>}
                      {n.observacoes&&<p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><AlertCircle size={11}/>{n.observacoes}</p>}
                    </div>
                    {escola.tipo&&<Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>}
                  </div>
                )
              })}
            </div>
          </div>
          {(prof.regencia_h||prof.htp_h||prof.hti_h)&&(
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Carga Horária</p>
              <div className="grid grid-cols-3 gap-2">
                {[['Regência',prof.regencia_h],['HTP',prof.htp_h],['HTI',prof.hti_h]].map(([l,v])=>(
                  <div key={l} className="bg-slate-50 rounded-2xl p-3 text-center">
                    <p className="text-xl font-semibold text-slate-700">{v??'—'}h</p>
                    <p className="text-xs text-slate-400 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {prof.formacao&&(
            <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-2xl">
              <GraduationCap size={16} className="text-violet-500 mt-0.5 shrink-0"/>
              <div>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Formação</p>
                <p className="text-sm text-slate-700 mt-0.5">{prof.formacao}</p>
              </div>
            </div>
          )}
          {(prof.email||prof.telefone)&&(
            <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
              {prof.email&&<p className="text-sm text-slate-600 flex items-center gap-2"><span className="text-slate-400 w-16 text-xs">Email</span>{prof.email}</p>}
              {prof.telefone&&<p className="text-sm text-slate-600 flex items-center gap-2"><span className="text-slate-400 w-16 text-xs">Telefone</span>{prof.telefone}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SERVIDOR MODAL (visualização) ───────────────────────────────────────────

function ServidorModal({ servidor, onClose, onEdit, isAdmin }) {
  if (!servidor) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="relative bg-slate-950 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-base font-semibold text-white">{initials(servidor.nome)}</div>
              <div>
                <h2 className="text-base font-semibold text-white">{servidor.nome}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{servidor.cargo ?? 'Cargo não informado'}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${servidor.status==='Ativo'?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/20 text-amber-300'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${servidor.status==='Ativo'?'bg-emerald-400':'bg-amber-400'}`}/>{servidor.status}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin&&<button onClick={()=>onEdit(servidor)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><Edit2 size={15} className="text-white"/></button>}
              <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X size={16} className="text-white"/></button>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {servidor.escola&&(
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <School size={15} className="text-slate-400 shrink-0"/>
              <div>
                <p className="text-sm font-medium text-slate-700">{servidor.escola.name}</p>
                <Badge className={TIPO_COLORS[servidor.escola.tipo]}>{servidor.escola.tipo}</Badge>
              </div>
            </div>
          )}
          {(servidor.email||servidor.telefone)&&(
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              {servidor.email&&<p className="text-sm text-slate-600"><span className="text-slate-400 text-xs w-16 inline-block">Email</span>{servidor.email}</p>}
              {servidor.telefone&&<p className="text-sm text-slate-600"><span className="text-slate-400 text-xs w-16 inline-block">Telefone</span>{servidor.telefone}</p>}
            </div>
          )}
          {servidor.observacoes&&(
            <div className="p-3 bg-amber-50 rounded-xl">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">Observações</p>
              <p className="text-sm text-amber-800">{servidor.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────

function SearchOverlay({ onClose, onSelectSchool, onOpenProf, onOpenServidor }) {
  const [query,setQuery]=useState('')
  const [results,setResults]=useState({profs:[],escolas:[],servidores:[]})
  const [searching,setSearching]=useState(false)
  useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose])
  useEffect(()=>{
    if(query.length<2){setResults({profs:[],escolas:[],servidores:[]});return}
    setSearching(true)
    const t=setTimeout(async()=>{const r=await buscarGlobal(query);setResults(r);setSearching(false)},250)
    return()=>clearTimeout(t)
  },[query])
  const hasResults=results.profs.length>0||results.escolas.length>0||results.servidores.length>0
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          {searching?<Loader2 size={16} className="animate-spin text-slate-400 shrink-0"/>:<Search size={16} className="text-slate-400 shrink-0"/>}
          <input autoFocus className="flex-1 text-base outline-none placeholder:text-slate-300 bg-transparent" placeholder="Buscar professor, servidor ou escola..." value={query} onChange={e=>setQuery(e.target.value)}/>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={16} className="text-slate-400"/></button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {query.length>=2&&!searching&&!hasResults&&<p className="text-center py-10 text-sm text-slate-400">Nenhum resultado para "{query}"</p>}
          {query.length<2&&<p className="text-center py-10 text-sm text-slate-400">Digite ao menos 2 letras para buscar</p>}
          {results.escolas.length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Escolas</p>
              {results.escolas.map(s=>(
                <button key={s.id} onClick={()=>{onSelectSchool(s);onClose()}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center"><School size={14} className="text-slate-500"/></div>
                  <div><p className="text-sm font-medium text-slate-700">{s.name}</p><p className="text-xs text-slate-400">{s.tipo}</p></div>
                </button>
              ))}
            </div>
          )}
          {results.profs.length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Professores</p>
              {results.profs.map(p=>{
                const esc=(p.nomeacoes??[]).map(n=>n.escola?.name).filter(Boolean)
                return (
                  <button key={p.id} onClick={()=>{onOpenProf(p);onClose()}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <AvatarCircle name={p.nome} size="sm"/>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700">{p.nome}</p><p className="text-xs text-slate-400 truncate">{esc.join(' · ')}</p></div>
                    {(p.nomeacoes??[]).length>1&&<Badge className="bg-blue-50 text-blue-600 border-blue-200 ml-auto shrink-0">{p.nomeacoes.length}×</Badge>}
                  </button>
                )
              })}
            </div>
          )}
          {results.servidores.length>0&&(
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Servidores T&A</p>
              {results.servidores.map(s=>(
                <button key={s.id} onClick={()=>{onOpenServidor(s);onClose()}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <AvatarCircle name={s.nome} size="sm"/>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700">{s.nome}</p><p className="text-xs text-slate-400">{s.cargo} · {s.escola?.name}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function Dashboard({ onSelectSchool }) {
  const {stats,loading}=useDashboardStats()
  const {escolas}=useEscolas()
  if(loading)return<Spinner/>
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">Rede Municipal · Vacaria–RS · {mesAnoLabel(mesAnoAtual())}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:'Escolas',val:stats?.totalEscolas,icon:School,bg:'bg-slate-50',text:'text-slate-800',ib:'bg-slate-200 text-slate-600'},
          {label:'Professores',val:stats?.totalProfs,icon:GraduationCap,bg:'bg-blue-50',text:'text-blue-800',ib:'bg-blue-200 text-blue-700'},
          {label:'Servidores T&A',val:stats?.totalServidores,icon:Users,bg:'bg-violet-50',text:'text-violet-800',ib:'bg-violet-200 text-violet-700'},
          {label:'Duplas Nomeações',val:stats?.duplos,icon:ArrowRightLeft,bg:'bg-amber-50',text:'text-amber-800',ib:'bg-amber-200 text-amber-700'},
        ].map(({label,val,icon:Icon,bg,text,ib})=>(
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <div className={`w-9 h-9 rounded-xl ${ib} flex items-center justify-center mb-3`}><Icon size={16}/></div>
            <p className={`text-3xl font-semibold ${text}`}>{val??'—'}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por modalidade</h2>
        <div className="grid grid-cols-3 gap-3">
          {['EMEF','EMEI','EMEF Campo'].map(tipo=>{
            const count=escolas.filter(e=>e.tipo===tipo).length
            return (
              <div key={tipo} className="p-4 bg-white border border-slate-100 rounded-2xl">
                <Badge className={`${TIPO_COLORS[tipo]} mb-3`}>{tipo}</Badge>
                <p className="text-2xl font-semibold text-slate-800">{count}</p>
                <p className="text-xs text-slate-400 mt-0.5">{count===1?'escola':'escolas'}</p>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Todas as unidades</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {escolas.map(escola=>(
            <div key={escola.id} onClick={()=>onSelectSchool(escola)} className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all">
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
  )
}

// ─── SCHOOLS GRID ────────────────────────────────────────────────────────────

function SchoolsGrid({ onSelectSchool }) {
  const {escolas,loading}=useEscolas()
  const [tipoFiltro,setTipoFiltro]=useState('Todos')
  const [search,setSearch]=useState('')
  const filtered=useMemo(()=>escolas.filter(s=>(tipoFiltro==='Todos'||s.tipo===tipoFiltro)&&(search===''||s.name.toLowerCase().includes(search.toLowerCase()))),[escolas,tipoFiltro,search])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold text-slate-900">Unidades Escolares</h1><p className="text-sm text-slate-500 mt-0.5">{escolas.length} escolas · Rede Municipal de Vacaria–RS</p></div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Filtrar escolas..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['Todos','EMEF','EMEI','EMEF Campo'].map(t=>(
            <button key={t} onClick={()=>setTipoFiltro(t)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${tipoFiltro===t?'bg-slate-900 text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(escola=>(
          <div key={escola.id} onClick={()=>onSelectSchool(escola)} className="group p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-md cursor-pointer transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors"><School size={17} className="text-slate-500 group-hover:text-white transition-colors"/></div>
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
  )
}

// ─── SCHOOL QUADRO ───────────────────────────────────────────────────────────

function SchoolQuadro({ escola, onBack, onOpenProf }) {
  const {professores,loading}=useProfessoresByEscola(escola.id)
  const {efe,salvarEfe,saving}=useEfetividade(escola.id,mesAnoAtual())
  const [search,setSearch]=useState('')
  const filtered=useMemo(()=>professores.filter(p=>search===''||p.nome.toLowerCase().includes(search.toLowerCase())),[professores,search])
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"><ChevronRight size={18} className="text-slate-400 rotate-180"/></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{escola.name}</h1>
            <Badge className={TIPO_COLORS[escola.tipo]}>{escola.tipo}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{loading?'…':`${professores.length} professores`} · {mesAnoLabel(mesAnoAtual())}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
        <Search size={15} className="text-slate-400"/>
        <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar professor nesta escola..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch('')}><X size={14} className="text-slate-400"/></button>}
      </div>
      {loading?<Spinner/>:(
        <div className="space-y-2">
          {filtered.length===0&&<div className="text-center py-16 text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Nenhum professor encontrado</p></div>}
          {filtered.map(prof=>{
            const outra=(prof.nomeacoes??[]).find(n=>n.escola?.id!==escola.id)
            const efeProf=efe[prof.id]
            return (
              <div key={prof.id} className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                <div className="cursor-pointer" onClick={()=>onOpenProf(prof)}><AvatarCircle name={prof.nome}/></div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenProf(prof)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{prof.nome}</p>
                    {prof.nomeacoesAqui?.length>1&&<Badge className="bg-violet-50 text-violet-600 border-violet-200">{prof.nomeacoesAqui.length}× nomeações</Badge>}
                    {outra&&<Badge className="bg-blue-50 text-blue-600 border-blue-200"><Briefcase size={10}/> 2ª escola</Badge>}
                  </div>
                  {outra&&<p className="text-xs text-slate-400 mt-0.5 truncate">Também em: {outra.escola?.name}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={()=>salvarEfe(prof.id,'ok',null)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${efeProf?.status==='ok'?'bg-emerald-500 text-white':'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}><CheckCircle2 size={13}/> OK</button>
                  <button onClick={()=>salvarEfe(prof.id,'ocorrencia','Falta')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${efeProf?.status==='ocorrencia'?'bg-amber-400 text-white':'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`}><AlertCircle size={13}/>{efeProf?.ocorrencia??'Ocorrência'}</button>
                  {saving&&<Loader2 size={13} className="animate-spin text-slate-400"/>}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0 cursor-pointer" onClick={()=>onOpenProf(prof)}/>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PROFESSORES LIST ────────────────────────────────────────────────────────

function ProfessoresList({ onOpenProf, adminMode, escolas }) {
  const {professores,loading,reload}=useProfessores()
  const [search,setSearch]=useState('')
  const [escolaFiltro,setEscolaFiltro]=useState('Todas')
  const [showForm,setShowForm]=useState(false)
  const filtered=useMemo(()=>{
    const q=search.toLowerCase()
    return professores.filter(p=>(search===''||p.nome.toLowerCase().includes(q))&&(escolaFiltro==='Todas'||(p.nomeacoes??[]).some(n=>n.escola?.name===escolaFiltro)))
  },[professores,search,escolaFiltro])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Professores</h1><p className="text-sm text-slate-500 mt-0.5">{professores.length} cadastrados · rede municipal</p></div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Recarregar"><RefreshCw size={16} className="text-slate-500"/></button>
          {adminMode&&<button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"><UserPlus size={15}/> Novo</button>}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar professor..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch('')}><X size={14} className="text-slate-400"/></button>}
        </div>
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)} className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option>Todas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-400">{filtered.length} professor{filtered.length!==1?'es':''} encontrado{filtered.length!==1?'s':''}</p>
      <div className="space-y-2">
        {filtered.map(prof=>{
          const esc=[...new Set((prof.nomeacoes??[]).map(n=>n.escola?.name).filter(Boolean))]
          return (
            <div key={prof.id} onClick={()=>onOpenProf(prof)} className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all">
              <AvatarCircle name={prof.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{prof.nome}</p>
                  {esc.length>1&&<Badge className="bg-blue-50 text-blue-600 border-blue-200"><Briefcase size={10}/> 2 escolas</Badge>}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${prof.status==='Ativo'?'text-emerald-600':'text-amber-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prof.status==='Ativo'?'bg-emerald-500':'bg-amber-400'}`}/>{prof.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{esc.join(' · ')}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
            </div>
          )
        })}
      </div>
      {showForm&&<FormProfessor escolas={escolas} onClose={()=>setShowForm(false)} onSaved={reload}/>}
    </div>
  )
}

// ─── SERVIDORES LIST (técnico-administrativo APENAS) ─────────────────────────

function ServidoresList({ onOpenServidor, adminMode, escolas }) {
  const {servidores,loading,reload}=useServidores()
  const [search,setSearch]=useState('')
  const [escolaFiltro,setEscolaFiltro]=useState('Todas')
  const [showForm,setShowForm]=useState(false)
  const filtered=useMemo(()=>{
    const q=search.toLowerCase()
    return servidores.filter(s=>(search===''||s.nome.toLowerCase().includes(q))&&(escolaFiltro==='Todas'||s.escola?.name===escolaFiltro))
  },[servidores,search,escolaFiltro])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Servidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pessoal técnico e administrativo · {servidores.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><RefreshCw size={16} className="text-slate-500"/></button>
          {adminMode&&<button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"><UserPlus size={15}/> Novo</button>}
        </div>
      </div>
      {/* Info box deixando claro a separação */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <Users size={16} className="text-slate-500 shrink-0"/>
        <p className="text-xs text-slate-600">Esta lista é exclusiva para pessoal técnico-administrativo: merendeiras, serventes, secretários, vigilantes, etc. Professores possuem cadastro próprio no menu <strong>Professores</strong>.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar servidor..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch('')}><X size={14} className="text-slate-400"/></button>}
        </div>
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)} className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option>Todas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      {filtered.length===0&&!loading?(
        <div className="text-center py-16 text-slate-400">
          <Users size={32} className="mx-auto mb-2 opacity-30"/>
          <p className="text-sm">Nenhum servidor técnico-administrativo cadastrado ainda.</p>
          {adminMode&&<button onClick={()=>setShowForm(true)} className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors mx-auto"><Plus size={14}/> Cadastrar primeiro servidor</button>}
        </div>
      ):(
        <div className="space-y-2">
          {filtered.map(serv=>(
            <div key={serv.id} onClick={()=>onOpenServidor(serv)} className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all">
              <AvatarCircle name={serv.nome}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{serv.nome}</p>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${serv.status==='Ativo'?'text-emerald-600':'text-amber-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${serv.status==='Ativo'?'bg-emerald-500':'bg-amber-400'}`}/>{serv.status}
                  </span>
                  {serv.cargo&&<Badge className="bg-slate-100 text-slate-600 border-slate-200">{serv.cargo}</Badge>}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{serv.escola?.name??'Escola não vinculada'}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
            </div>
          ))}
        </div>
      )}
      {showForm&&<FormServidor escolas={escolas} onClose={()=>setShowForm(false)} onSaved={reload}/>}
    </div>
  )
}

// ─── EFE MODULE ──────────────────────────────────────────────────────────────

function EfeModule({ onOpenProf }) {
  const {professores,loading}=useProfessores()
  const {escolas}=useEscolas()
  const [escolaFiltro,setEscolaFiltro]=useState('')
  const [search,setSearch]=useState('')
  const escolaSel=useMemo(()=>escolas.find(e=>e.name===escolaFiltro),[escolas,escolaFiltro])
  const {efe,salvarEfe,saving}=useEfetividade(escolaSel?.id,mesAnoAtual())
  const filtered=useMemo(()=>{
    const q=search.toLowerCase()
    return professores.filter(p=>(search===''||p.nome.toLowerCase().includes(q))&&(escolaFiltro===''||(p.nomeacoes??[]).some(n=>n.escola?.name===escolaFiltro))).slice(0,100)
  },[professores,search,escolaFiltro])
  if(loading)return<Spinner/>
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold text-slate-900">Efetividade — EFE</h1><p className="text-sm text-slate-500 mt-0.5">Registro mensal · {mesAnoLabel(mesAnoAtual())}</p></div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-slate-400"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar professor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select value={escolaFiltro} onChange={e=>setEscolaFiltro(e.target.value)} className="px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 outline-none cursor-pointer">
          <option value="">Todas as escolas</option>
          {escolas.map(e=><option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      {!escolaFiltro&&<div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">Selecione uma escola para registrar e salvar a efetividade no banco de dados.</div>}
      <p className="text-xs text-slate-400">Exibindo {filtered.length} professores {saving&&'· salvando…'}</p>
      <div className="space-y-2">
        {filtered.map(prof=>{
          const esc=[...new Set((prof.nomeacoes??[]).map(n=>n.escola?.name).filter(Boolean))]
          const efeProf=efe[prof.id]
          return (
            <div key={prof.id} className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
              <AvatarCircle name={prof.nome}/>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenProf(prof)}>
                <p className="text-sm font-semibold text-slate-800 truncate">{prof.nome}</p>
                <p className="text-xs text-slate-400 truncate">{esc.join(' · ')}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={()=>escolaSel&&salvarEfe(prof.id,'ok',null)} disabled={!escolaSel} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${efeProf?.status==='ok'?'bg-emerald-500 text-white':'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}><CheckCircle2 size={13}/> OK</button>
                <select disabled={!escolaSel} value={efeProf?.status==='ocorrencia'?efeProf.ocorrencia:''} onChange={e=>escolaSel&&salvarEfe(prof.id,'ocorrencia',e.target.value)} className={`px-2 py-1.5 rounded-xl text-xs font-medium outline-none cursor-pointer disabled:opacity-40 ${efeProf?.status==='ocorrencia'?'bg-amber-400 text-white':'bg-slate-100 text-slate-500'}`}>
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
  const {user,profile,loading,signOut}=useAuth()
  const {escolas}=useEscolas()
  const [view,setView]=useState('dashboard')
  const [selectedSchool,setSelectedSchool]=useState(null)
  const [selectedProf,setSelectedProf]=useState(null)
  const [editProf,setEditProf]=useState(null)
  const [selectedServidor,setSelectedServidor]=useState(null)
  const [editServidor,setEditServidor]=useState(null)
  const [searchOpen,setSearchOpen]=useState(false)
  const [sidebarOpen,setSidebarOpen]=useState(true)
  const admin=isAdmin(profile)

  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearchOpen(true)}}
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[])

  if(loading)return<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-slate-400"/></div>
  if(!user)return<LoginPage/>

  function handleSelectSchool(escola){setSelectedSchool(escola);setView('school-detail')}
  function navigate(id){setView(id);setSelectedSchool(null)}

  const navItems=[
    {id:'dashboard',label:'Dashboard',icon:Home},
    {id:'schools',label:'Unidades',icon:School},
    {id:'professores',label:'Professores',icon:GraduationCap},
    {id:'servidores',label:'Servidores T&A',icon:Users},
    {id:'efe',label:'Efetividade',icon:CheckCircle2},
    {id:'relatorios',label:'Relatórios',icon:FileText},
  ]
  const currentNavId=view==='school-detail'?'schools':view

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen?'w-56':'w-16'} shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all duration-200 fixed top-0 left-0 h-screen z-30`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center shrink-0"><GraduationCap size={15} className="text-white"/></div>
          {sidebarOpen&&<div className="overflow-hidden"><p className="text-sm font-semibold text-slate-800 leading-tight">EduGestão</p><p className="text-xs text-slate-400 leading-tight">Vacaria · RS</p></div>}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>navigate(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${currentNavId===id?'bg-slate-950 text-white font-medium':'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              <Icon size={17} className="shrink-0"/>{sidebarOpen&&<span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          {sidebarOpen&&profile&&(
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-medium text-slate-700 truncate">{profile.nome||user.email}</p>
              <div className="mt-1"><RoleBadge role={profile.role}/></div>
            </div>
          )}
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <LogOut size={17} className="shrink-0"/>{sidebarOpen&&<span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen?'ml-56':'ml-16'} transition-all duration-200`}>
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 shrink-0 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><Menu size={17} className="text-slate-500"/></button>
          <button onClick={()=>setSearchOpen(true)} className="flex-1 max-w-sm flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 hover:bg-slate-200 transition-colors">
            <Search size={14}/><span className="flex-1 text-left">Buscar...</span>
            <kbd className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-mono">⌘K</kbd>
          </button>
          <div className="ml-auto">
            <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-semibold text-white">{initials(profile?.nome||user?.email||'U')}</div>
          </div>
        </header>
        <main className="flex-1 p-6 max-w-5xl w-full">
          {view==='dashboard'&&<Dashboard onSelectSchool={handleSelectSchool}/>}
          {view==='schools'&&<SchoolsGrid onSelectSchool={handleSelectSchool}/>}
          {view==='school-detail'&&selectedSchool&&<SchoolQuadro escola={selectedSchool} onBack={()=>{setView('schools');setSelectedSchool(null)}} onOpenProf={setSelectedProf}/>}
          {view==='professores'&&<ProfessoresList onOpenProf={setSelectedProf} adminMode={admin} escolas={escolas}/>}
          {view==='servidores'&&<ServidoresList onOpenServidor={setSelectedServidor} adminMode={admin} escolas={escolas}/>}
          {view==='efe'&&<EfeModule onOpenProf={setSelectedProf}/>}
          {view==='relatorios'&&<div className="flex items-center justify-center h-64 text-slate-400"><div className="text-center"><FileText size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Relatórios · em breve</p></div></div>}
        </main>
      </div>

      {/* Search */}
      {searchOpen&&<SearchOverlay onClose={()=>setSearchOpen(false)} onSelectSchool={handleSelectSchool} onOpenProf={p=>{setSelectedProf(p)}} onOpenServidor={s=>{setSelectedServidor(s)}}/>}

      {/* Professor modal/form */}
      {selectedProf&&!editProf&&<ProfessorModal prof={selectedProf} onClose={()=>setSelectedProf(null)} onEdit={p=>{setEditProf(p);setSelectedProf(null)}} isAdmin={admin}/>}
      {editProf&&<FormProfessor prof={editProf} escolas={escolas} onClose={()=>setEditProf(null)} onSaved={()=>{}}/>}

      {/* Servidor modal/form */}
      {selectedServidor&&!editServidor&&<ServidorModal servidor={selectedServidor} onClose={()=>setSelectedServidor(null)} onEdit={s=>{setEditServidor(s);setSelectedServidor(null)}} isAdmin={admin}/>}
      {editServidor&&<FormServidor servidor={editServidor} escolas={escolas} onClose={()=>setEditServidor(null)} onSaved={()=>{}}/>}
    </div>
  )
}
