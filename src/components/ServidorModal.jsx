import { useEffect, useMemo, useState } from 'react'
import {
  X, School, AlertCircle, GraduationCap, Briefcase,
  Phone, Mail, MapPin, Calendar, Hash, ArrowRightLeft,
  FileText, Clock, Info, Edit2, ChevronRight, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const TIPO_COLORS = {
  EMEI: 'bg-violet-50 text-violet-700 border-violet-200',
  EMEF: 'bg-blue-50 text-blue-700 border-blue-200',
  'EMEF Campo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SMED: 'bg-rose-50 text-rose-700 border-rose-200',
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{children}</span>
}
function formatarData(data) {
  if (!data) return 'Não informada'
  const [ano, mes, dia] = String(data).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : 'Não informada'
}

export default function ServidorModal({
  servidor,
  onClose,
  onEdit,
  onTransfer,
  onAddHistorico,
  onEditHistorico,
  onAddSolicitacao,
  canEdit,
}) {
  const [tab, setTab] = useState('escola') // 'escola' | 'dados' | 'historico'
  const [cadastro, setCadastro] = useState(null)
  const [loadingCadastro, setLoadingCadastro] = useState(false)
  const [cadastroErro, setCadastroErro] = useState('')
  const [historico, setHistorico] = useState(null)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [historicoErro, setHistoricoErro] = useState('')

  const servidorId = servidor?.id
  const lotacoesRecebidas = servidor?.lotacoes ?? []
  const lotacoes = useMemo(() => [...lotacoesRecebidas].sort((a, b) => {
    const aAtual = !a.data_fim
    const bAtual = !b.data_fim
    if (aAtual !== bAtual) return aAtual ? -1 : 1
    return String(b.data_inicio ?? '').localeCompare(String(a.data_inicio ?? ''))
  }), [lotacoesRecebidas])
  const lotacoesExibidas = historico ?? lotacoes
  const lotacoesAtuais = lotacoesExibidas.filter(lotacao => !lotacao.data_fim)
  const escolas = lotacoesAtuais.map(l => l.escola).filter(Boolean)

  useEffect(() => {
    setTab('escola')
    setCadastro(null)
    setCadastroErro('')
    setHistorico(null)
    setHistoricoErro('')
  }, [servidorId])

  useEffect(() => {
    if (tab !== 'historico' || !servidorId) {
      setLoadingHistorico(false)
      return
    }

    let cancelada = false
    setLoadingHistorico(true)
    setHistoricoErro('')
    supabase
      .from('lotacoes')
      .select('id, servidor_id, escola_id, principal, data_inicio, data_fim, motivo_saida, escola:escolas(id, name, tipo)')
      .eq('servidor_id', servidorId)
      .order('data_fim', { ascending: true, nullsFirst: true })
      .order('data_inicio', { ascending: false })
      .then(({ data, error }) => {
        if (cancelada) return
        if (error) {
          console.error('ServidorModal histórico:', error)
          setHistoricoErro(error.message || 'Não foi possível carregar o histórico.')
          setHistorico(null)
        } else {
          setHistorico(data ?? [])
        }
        setLoadingHistorico(false)
      })
      .catch(error => {
        if (cancelada) return
        setHistoricoErro(error?.message || 'Não foi possível carregar o histórico.')
        setHistorico(null)
        setLoadingHistorico(false)
      })

    return () => { cancelada = true }
  }, [tab, servidorId])

  useEffect(() => {
    function fecharComEscape(event) {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => window.removeEventListener('keydown', fecharComEscape)
  }, [onClose])

  // Quando abre a aba Dados, garante que temos todos os campos.
  useEffect(() => {
    if (tab !== 'dados' || cadastro || !servidorId) return
    let cancelada = false
    setLoadingCadastro(true)
    setCadastroErro('')
    supabase
      .from('servidores')
      .select('*')
      .eq('id', servidorId)
      .single()
      .then(({ data, error }) => {
        if (cancelada) return
        if (error) setCadastroErro(error.message || 'Não foi possível carregar os dados cadastrais.')
        else setCadastro(data)
        setLoadingCadastro(false)
      })
      .catch(error => {
        if (cancelada) return
        setCadastroErro(error?.message || 'Não foi possível carregar os dados cadastrais.')
        setLoadingCadastro(false)
      })
    return () => { cancelada = true }
  }, [tab, servidorId, cadastro])

  if (!servidor) return null

  const dadosBase = cadastro ?? servidor

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="servidor-modal-title"
        className="bg-white w-full md:max-w-md md:mx-4 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="relative bg-slate-950 px-6 py-5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-semibold text-white shrink-0">
                {initials(servidor.nome)}
              </div>
              <div>
                <h2 id="servidor-modal-title" className="text-base font-semibold text-white leading-snug">{servidor.nome}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    servidor.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${servidor.status === 'Ativo' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {servidor.status}
                  </span>
                  {servidor.funcao && (
                    <span className="text-white/50 text-xs">{servidor.funcao}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button
                  onClick={() => { onClose(); onEdit(servidor) }}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  title="Editar"
                >
                  <Edit2 size={15} className="text-white" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {[
            { id: 'escola',   label: 'Escola',    icon: School },
            { id: 'dados',    label: 'Dados',     icon: Info },
            { id: 'historico',label: 'Histórico', icon: Clock },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                tab === id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* ABA: Escola */}
          {tab === 'escola' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {escolas.length > 1 ? 'Escolas / Lotações' : 'Escola / Lotação'}
              </p>
              {escolas.length === 0 && (
                <p className="text-sm text-slate-400 italic">Sem escola vinculada</p>
              )}
              {escolas.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <School size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{e.name}</p>
                    {servidor.matricula && (
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{servidor.matricula}</p>
                    )}
                  </div>
                  {e.tipo && <Badge className={TIPO_COLORS[e.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>{e.tipo}</Badge>}
                </div>
              ))}
              {servidor.tipo_vinculo && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <Briefcase size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Vínculo</p>
                    <p className="text-sm font-medium text-slate-700">{servidor.tipo_vinculo}</p>
                  </div>
                </div>
              )}
              {canEdit && (onTransfer || onAddSolicitacao) && (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {onTransfer && <button onClick={() => onTransfer(servidor)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"><ArrowRightLeft size={14} /> Transferir para outra escola</button>}
                  {onAddSolicitacao && <button onClick={() => onAddSolicitacao(servidor)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"><FileText size={14} /> Registrar pedido de transferência</button>}
                </div>
              )}
            </div>
          )}

          {/* ABA: Dados cadastrais */}
          {tab === 'dados' && (
            loadingCadastro ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {cadastroErro && <div className="p-3 mb-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800">{cadastroErro}</div>}
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados Pessoais</p>
                {dadosBase.cpf && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Hash size={15} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">CPF</p>
                      <p className="text-sm font-medium text-slate-700 font-mono">{dadosBase.cpf}</p>
                    </div>
                  </div>
                )}
                {dadosBase.data_nascimento && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Calendar size={15} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Nascimento</p>
                      <p className="text-sm font-medium text-slate-700">
                        {new Date(dadosBase.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}
                {dadosBase.telefone && (
                  <a href={`tel:${dadosBase.telefone.replace(/\D/g, '')}`}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                    <Phone size={15} className="text-slate-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400">Telefone</p>
                      <p className="text-sm font-medium text-slate-700">{dadosBase.telefone}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300" />
                  </a>
                )}
                {dadosBase.email && (
                  <a href={`mailto:${dadosBase.email}`}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                    <Mail size={15} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">E-mail</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{dadosBase.email}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 shrink-0" />
                  </a>
                )}
                {dadosBase.endereco && (
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Endereço</p>
                      <p className="text-sm font-medium text-slate-700 leading-snug">{dadosBase.endereco}</p>
                    </div>
                  </div>
                )}
                {dadosBase.formacao && (
                  <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-2xl">
                    <GraduationCap size={15} className="text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-violet-400">Formação</p>
                      <p className="text-sm text-slate-700 mt-0.5">{dadosBase.formacao}</p>
                    </div>
                  </div>
                )}
                {!dadosBase.data_nascimento && !dadosBase.telefone && !dadosBase.email && !dadosBase.endereco && (
                  <div className="text-center py-8 text-slate-400">
                    <Info size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sem dados cadastrais registrados</p>
                    {canEdit && (
                      <button onClick={() => { onClose(); onEdit(servidor) }}
                        className="mt-3 text-xs text-slate-500 underline">
                        Clique em Editar para preencher
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* ABA: Histórico */}
          {tab === 'historico' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Histórico de escolas</p>
                  <p className="text-xs text-slate-400 mt-1">{lotacoesExibidas.length} vínculo{lotacoesExibidas.length === 1 ? '' : 's'} registrado{lotacoesExibidas.length === 1 ? '' : 's'}</p>
                </div>
                {canEdit && onAddHistorico && (
                  <button onClick={() => onAddHistorico(servidor)} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors">
                    <FileText size={13} /> Adicionar histórico
                  </button>
                )}
              </div>

              {loadingHistorico ? (
                <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /><span className="text-xs ml-2">Carregando histórico…</span></div>
              ) : (
                <>
                  {historicoErro && <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800"><p className="font-medium">Não foi possível consultar o histórico completo.</p><p className="mt-1 break-words">{historicoErro}</p><p className="mt-2 text-amber-700">Confirme se as migrações de histórico foram executadas no Supabase.</p></div>}
                  {lotacoesExibidas.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                      <Clock size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum vínculo registrado</p>
                      {canEdit && onAddHistorico && <p className="text-xs text-slate-300 mt-1">Adicione uma passagem anterior pela ação acima.</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                  {lotacoesExibidas.map(lotacao => {
                    const atual = !lotacao.data_fim
                    const escola = lotacao.escola
                    return (
                      <div key={lotacao.id ?? `${lotacao.escola_id}-${lotacao.data_inicio}-${lotacao.data_fim ?? 'atual'}`} className={`p-3 rounded-2xl border ${atual ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${atual ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                            <School size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800 leading-snug">{escola?.name || 'Escola não encontrada'}</p>
                              <Badge className={atual ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}>{atual ? 'Atual' : 'Encerrada'}</Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatarData(lotacao.data_inicio)} {atual ? '· presente' : `· ${formatarData(lotacao.data_fim)}`}
                            </p>
                            {lotacao.motivo_saida && <p className="text-xs text-slate-400 mt-1">Motivo: {lotacao.motivo_saida}</p>}
                            {canEdit && onEditHistorico && (
                              <button onClick={() => onEditHistorico(lotacao)} className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors">
                                <Edit2 size={12} /> {atual ? 'Editar vínculo atual' : 'Editar histórico'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canEdit && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0">
            <button
              onClick={() => { onClose(); onEdit(servidor) }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all"
            >
              <Edit2 size={14} /> Editar cadastro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
