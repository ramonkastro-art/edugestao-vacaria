import { useState } from 'react'
import { Calendar, CheckCircle2, Edit3, History, Loader2, School, X } from 'lucide-react'
import { editarHistoricoLotacao, hojeISO } from '../hooks/useData'

function formatarData(data) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function EditarHistoricoLotacaoModal({ lotacao, servidor, onClose, onSuccess }) {
  const [dataInicio, setDataInicio] = useState(lotacao?.data_inicio ?? '')
  const [ativo, setAtivo] = useState(!lotacao?.data_fim)
  const [dataFim, setDataFim] = useState(lotacao?.data_fim ?? '')
  const [motivo, setMotivo] = useState(lotacao?.motivo_saida ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState('')

  function selecionarSituacao(novoAtivo) {
    setAtivo(novoAtivo)
    if (!novoAtivo && !dataFim) setDataFim(hojeISO())
    if (novoAtivo) setErro('')
  }

  async function handleSalvar() {
    const dataFimFinal = ativo ? null : dataFim

    if (!lotacao?.id || !dataInicio) {
      setErro('Informe o início do vínculo.')
      return
    }
    if (!ativo && !dataFimFinal) {
      setErro('Informe o fim do vínculo encerrado.')
      return
    }
    if (dataInicio > hojeISO()) {
      setErro('A data de início não pode estar no futuro.')
      return
    }
    if (dataFimFinal && dataInicio > dataFimFinal) {
      setErro('A data de início não pode ser posterior ao fim do vínculo.')
      return
    }
    if (dataFimFinal && dataFimFinal > hojeISO()) {
      setErro('A data de encerramento não pode estar no futuro.')
      return
    }

    setSaving(true)
    setErro('')
    const { error } = await editarHistoricoLotacao({
      lotacaoId: lotacao.id,
      dataInicio,
      dataFim: dataFimFinal,
      motivo: ativo ? null : motivo,
    })
    setSaving(false)

    if (error) {
      setErro(error.message || 'Não foi possível atualizar o vínculo.')
      return
    }

    setSaved(true)
    window.setTimeout(() => {
      onSuccess?.()
      onClose?.()
    }, 650)
  }

  const escolaNome = lotacao?.escola?.name || 'Escola não encontrada'

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-slate-950/30 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="editar-historico-modal-title" className="bg-white w-full md:max-w-md max-h-[calc(100dvh-0.5rem)] md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>

        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Edit3 size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p id="editar-historico-modal-title" className="text-base font-semibold text-slate-900">Editar vínculo</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{servidor?.nome || 'Servidor'} · {escolaNome}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors" aria-label="Fechar">
            <X size={17} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl">
            <p className="text-xs leading-relaxed text-blue-800">
              Edite somente este vínculo. Escolha <strong>Atual</strong> para manter a escola aberta ou <strong>Encerrada</strong> para informar a data de saída. Os demais vínculos não serão alterados.
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Situação do vínculo</span>
            <div role="group" aria-label="Situação do vínculo" className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => selecionarSituacao(true)} className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${ativo ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                Atual
              </button>
              <button type="button" onClick={() => selecionarSituacao(false)} className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${!ativo ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                Encerrada
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <School size={15} className="text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Escola</p>
              <p className="text-sm font-medium text-slate-800 truncate">{escolaNome}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Início do vínculo</span>
              <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-slate-400">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <input type="date" value={dataInicio} max={ativo ? hojeISO() : (dataFim || hojeISO())} onChange={event => setDataInicio(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" />
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{ativo ? 'Fim do vínculo (opcional)' : 'Fim do vínculo'}</span>
              <div className={`flex items-center gap-2 px-3 py-3 bg-slate-50 border rounded-xl focus-within:border-slate-400 ${ativo ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}>
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <input type="date" value={ativo ? '' : dataFim} min={dataInicio || undefined} max={hojeISO()} disabled={ativo} onChange={event => setDataFim(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800 disabled:cursor-not-allowed" />
              </div>
            </label>
          </div>

          {!ativo && (
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Motivo de saída <span className="normal-case font-normal text-slate-400">(opcional)</span></span>
              <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Ex.: Transferência para outra escola" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-800 placeholder:text-slate-300 focus:border-slate-400" />
            </label>
          )}

          {dataInicio && <p className="text-xs text-slate-400">Início: <strong className="text-slate-600">{formatarData(dataInicio)}</strong>{ativo ? ' · vínculo atual' : dataFim ? <> · fim: <strong className="text-slate-600">{formatarData(dataFim)}</strong></> : ''}</p>}
          {erro && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
          {saved && <p role="status" className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5"><CheckCircle2 size={14} /> Vínculo atualizado com sucesso.</p>}
        </div>

        <div className="modal-footer-safe px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={saving || saved} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <><History size={14} /> Salvar vínculo</>}
          </button>
        </div>
      </div>
    </div>
  )
}
