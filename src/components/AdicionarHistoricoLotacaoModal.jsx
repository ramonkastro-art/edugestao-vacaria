import { useMemo, useState } from 'react'
import { Calendar, CheckCircle2, History, Loader2, School, X } from 'lucide-react'
import { adicionarHistoricoLotacao, hojeISO } from '../hooks/useData'

function dataAnterior(data) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-').map(Number)
  const valor = new Date(ano, mes - 1, dia)
  valor.setDate(valor.getDate() - 1)
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
}

function formatarData(data) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function AdicionarHistoricoLotacaoModal({ servidor, escolas = [], onClose, onSuccess }) {
  const [escolaId, setEscolaId] = useState('')
  const [dataFim, setDataFim] = useState(hojeISO())
  const [dataInicio, setDataInicio] = useState(() => dataAnterior(hojeISO()))
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState('')

  const escolasAtuais = useMemo(
    () => new Set((servidor?.lotacoes ?? []).filter(lotacao => !lotacao.data_fim).map(lotacao => String(lotacao.escola_id))),
    [servidor],
  )
  const escolasDisponiveis = escolas.filter(escola => !escolasAtuais.has(String(escola.id)))

  async function handleSalvar() {
    if (!escolaId || !dataInicio || !dataFim) {
      setErro('Informe a escola e as duas datas do período histórico.')
      return
    }
    if (dataInicio > dataFim) {
      setErro('A data de início não pode ser posterior à data de encerramento.')
      return
    }

    setSaving(true)
    setErro('')
    const { error } = await adicionarHistoricoLotacao({
      servidorId: servidor.id,
      escolaId,
      dataInicio,
      dataFim,
      motivo,
    })
    setSaving(false)

    if (error) {
      setErro(error.message || 'Não foi possível adicionar o vínculo ao histórico.')
      return
    }

    setSaved(true)
    window.setTimeout(() => {
      onSuccess?.()
      onClose?.()
    }, 650)
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-slate-950/30 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>

        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
            <History size={18} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900">Adicionar ao histórico</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{servidor.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors" aria-label="Fechar">
            <X size={17} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-violet-50 border border-violet-100 rounded-2xl">
            <p className="text-xs leading-relaxed text-violet-800">
              Use esta opção para registrar uma passagem anterior que não foi cadastrada. O vínculo será salvo como histórico encerrado e não alterará a escola atual.
            </p>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Escola</span>
            <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
              <School size={15} className="text-slate-400 shrink-0" />
              <select value={escolaId} onChange={event => setEscolaId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800">
                <option value="">Selecionar escola...</option>
                {escolasDisponiveis.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}
              </select>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Início do vínculo</span>
              <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <input type="date" value={dataInicio} max={dataFim} onChange={event => setDataInicio(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" />
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fim do vínculo</span>
              <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <input type="date" value={dataFim} min={dataInicio} max={hojeISO()} onChange={event => setDataFim(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Motivo <span className="normal-case font-normal text-slate-400">(opcional)</span></span>
            <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Ex.: vínculo anterior não importado" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-800 placeholder:text-slate-300 focus:border-slate-400" />
          </label>

          {escolaId && dataInicio && dataFim && <p className="text-xs text-slate-400">Período registrado: <strong className="text-slate-600">{formatarData(dataInicio)}</strong> a <strong className="text-slate-600">{formatarData(dataFim)}</strong>.</p>}
          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
          {saved && <p className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5"><CheckCircle2 size={14} /> Histórico registrado com sucesso.</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button onClick={handleSalvar} disabled={saving || saved || escolasDisponiveis.length === 0} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <><History size={14} /> Adicionar ao histórico</>}
          </button>
        </div>
      </div>
    </div>
  )
}
