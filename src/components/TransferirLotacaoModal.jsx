import { useMemo, useState } from 'react'
import { ArrowRightLeft, Calendar, CheckCircle2, Loader2, School, X } from 'lucide-react'
import { hojeISO, transferirServidorEscola } from '../hooks/useData'

function formatarData(data) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function TransferirLotacaoModal({ servidor, escolas = [], onClose, onSuccess }) {
  const lotacoesAtuais = useMemo(
    () => (servidor?.lotacoes ?? []).filter(lotacao => !lotacao.data_fim),
    [servidor],
  )
  const [origemId, setOrigemId] = useState(String(lotacoesAtuais[0]?.escola_id ?? ''))
  const [destinoId, setDestinoId] = useState('')
  const [dataTransferencia, setDataTransferencia] = useState(hojeISO())
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [saved, setSaved] = useState(false)

  const destinos = escolas.filter(escola => !lotacoesAtuais.some(lotacao => String(lotacao.escola_id) === String(escola.id)))
  const origem = escolas.find(escola => String(escola.id) === origemId)
  const destino = escolas.find(escola => String(escola.id) === destinoId)

  async function handleTransferir() {
    if (!origemId || !destinoId || !dataTransferencia) {
      setErro('Informe a escola de origem, a escola de destino e a data da transferência.')
      return
    }

    setSaving(true)
    setErro('')
    const { error } = await transferirServidorEscola({
      servidorId: servidor.id,
      escolaOrigemId: origemId,
      escolaDestinoId: destinoId,
      dataTransferencia,
      motivo,
    })
    setSaving(false)

    if (error) {
      setErro(error.message || 'Não foi possível realizar a transferência.')
      return
    }

    setSaved(true)
    window.setTimeout(() => {
      onSuccess?.()
      onClose?.()
    }, 650)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-slate-950/30 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md max-h-[calc(100dvh-0.5rem)] md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <ArrowRightLeft size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900">Transferir servidor</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{servidor.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors" aria-label="Fechar">
            <X size={17} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl">
            <p className="text-xs leading-relaxed text-blue-800">
              A transferência mantém o cadastro, encerra a lotação anterior e registra a nova escola no histórico do servidor.
            </p>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Escola atual</span>
            <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <School size={15} className="text-slate-400 shrink-0" />
              <select value={origemId} onChange={event => setOrigemId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800">
                {lotacoesAtuais.map(lotacao => {
                  const escola = escolas.find(item => String(item.id) === String(lotacao.escola_id))
                  return <option key={lotacao.escola_id} value={lotacao.escola_id}>{escola?.name ?? 'Escola não encontrada'}</option>
                })}
              </select>
            </div>
          </label>

          <div className="flex justify-center -my-2">
            <ArrowRightLeft size={16} className="text-slate-300 rotate-90" />
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nova escola</span>
            <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
              <School size={15} className="text-slate-400 shrink-0" />
              <select value={destinoId} onChange={event => setDestinoId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800">
                <option value="">Selecionar escola de destino...</option>
                {destinos.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}
              </select>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data da troca</span>
              <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <input type="date" value={dataTransferencia} onChange={event => setDataTransferencia(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800" />
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Motivo <span className="normal-case font-normal text-slate-400">(opcional)</span></span>
              <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Ex.: remoção" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-800 placeholder:text-slate-300 focus:border-slate-400" />
            </label>
          </div>

          {origem && destino && <p className="text-xs text-slate-400">De <strong className="text-slate-600">{origem.name}</strong> para <strong className="text-slate-600">{destino.name}</strong> em {formatarData(dataTransferencia)}.</p>}
          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
          {saved && <p className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5"><CheckCircle2 size={14} /> Transferência registrada com sucesso.</p>}
        </div>

        <div className="modal-footer-safe px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
          <button onClick={onClose} disabled={saving} className="w-full sm:w-auto px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button onClick={handleTransferir} disabled={saving || saved || destinos.length === 0} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Registrando…</> : <><ArrowRightLeft size={14} /> Confirmar transferência</>}
          </button>
        </div>
      </div>
    </div>
  )
}
