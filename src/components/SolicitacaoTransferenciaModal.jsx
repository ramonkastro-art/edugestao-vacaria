import { useState } from 'react'
import { ArrowRightLeft, Calendar, CheckCircle2, Loader2, School, X } from 'lucide-react'
import { hojeISO, salvarSolicitacaoTransferencia } from '../hooks/useData'

const STATUS = ['Pendente', 'Aprovado', 'Atendido', 'Cancelado']

export default function SolicitacaoTransferenciaModal({ servidor, escolas = [], solicitacao = null, onClose, onSuccess }) {
  const lotacoesAtuais = (servidor?.lotacoes ?? []).filter(lotacao => !lotacao.data_fim)
  const escolaPrincipal = lotacoesAtuais.find(lotacao => lotacao.principal) ?? lotacoesAtuais[0]
  const [escolaOrigemId, setEscolaOrigemId] = useState(String(solicitacao?.escola_origem_id ?? escolaPrincipal?.escola_id ?? ''))
  const [escolaDestinoId, setEscolaDestinoId] = useState(String(solicitacao?.escola_destino_id ?? ''))
  const [dataPedido, setDataPedido] = useState(solicitacao?.data_pedido ?? hojeISO())
  const [status, setStatus] = useState(solicitacao?.status ?? 'Pendente')
  const [dataAtendimento, setDataAtendimento] = useState(solicitacao?.data_atendimento ?? '')
  const [observacoes, setObservacoes] = useState(solicitacao?.observacoes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!servidor?.id || !escolaDestinoId || !dataPedido) {
      setErro('Informe a data do pedido e a escola de destino.')
      return
    }
    if (escolaOrigemId && escolaOrigemId === escolaDestinoId) {
      setErro('A escola de destino deve ser diferente da escola de origem.')
      return
    }
    if (dataPedido > hojeISO()) {
      setErro('A data do pedido não pode estar no futuro.')
      return
    }
    if (status === 'Atendido' && !dataAtendimento) {
      setErro('Informe a data de atendimento para um pedido atendido.')
      return
    }
    if (dataAtendimento && dataAtendimento < dataPedido) {
      setErro('A data de atendimento não pode ser anterior à data do pedido.')
      return
    }

    setSaving(true)
    setErro('')
    const { error } = await salvarSolicitacaoTransferencia({
      id: solicitacao?.id,
      servidorId: servidor.id,
      escolaOrigemId,
      escolaDestinoId,
      dataPedido,
      status,
      dataAtendimento: status === 'Atendido' ? dataAtendimento : null,
      observacoes,
    })
    setSaving(false)

    if (error) {
      setErro(error.message || 'Não foi possível salvar a solicitação.')
      return
    }

    setSaved(true)
    window.setTimeout(() => {
      onSuccess?.()
      onClose?.()
    }, 650)
  }

  return (
    <div className="fixed inset-0 z-[82] flex items-end md:items-center justify-center bg-slate-950/30 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md max-h-[calc(100dvh-0.5rem)] md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0"><ArrowRightLeft size={18} className="text-blue-600" /></div>
          <div className="flex-1 min-w-0"><p className="text-base font-semibold text-slate-900">{solicitacao ? 'Editar pedido de transferência' : 'Novo pedido de transferência'}</p><p className="text-xs text-slate-500 mt-0.5 truncate">{servidor?.nome || 'Servidor'}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100" aria-label="Fechar"><X size={17} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl"><p className="text-xs leading-relaxed text-blue-800">Este pedido é apenas administrativo. Salvar o pedido não transfere o servidor automaticamente; a mudança deve ser feita depois pela ação de transferência.</p></div>
          <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Escola de origem <span className="normal-case font-normal text-slate-400">(opcional)</span></span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><School size={15} className="text-slate-400 shrink-0" /><select value={escolaOrigemId} onChange={event => setEscolaOrigemId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800"><option value="">Não informado</option>{lotacoesAtuais.map(lotacao => <option key={lotacao.escola_id} value={lotacao.escola_id}>{lotacao.escola?.name || 'Escola não encontrada'}</option>)}</select></div></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Escola para transferência</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><School size={15} className="text-slate-400 shrink-0" /><select value={escolaDestinoId} onChange={event => setEscolaDestinoId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-slate-800"><option value="">Selecionar escola...</option>{escolas.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}</select></div></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data do pedido</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><Calendar size={15} className="text-slate-400 shrink-0" /><input type="date" value={dataPedido} max={hojeISO()} onChange={event => setDataPedido(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" /></div></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</span><select value={status} onChange={event => setStatus(event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-800">{STATUS.map(item => <option key={item}>{item}</option>)}</select></label>
          </div>
          {status === 'Atendido' && <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data de atendimento</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl"><Calendar size={15} className="text-slate-400 shrink-0" /><input type="date" value={dataAtendimento} min={dataPedido} max={hojeISO()} onChange={event => setDataAtendimento(event.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800" /></div></label>}
          <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Anotações / observações <span className="normal-case font-normal text-slate-400">(opcional)</span></span><textarea rows={3} value={observacoes} onChange={event => setObservacoes(event.target.value)} placeholder="Ex.: interesse em mudança para a escola X" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none text-slate-800 placeholder:text-slate-300 focus:border-slate-400" /></label>
          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
          {saved && <p className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5"><CheckCircle2 size={14} /> Solicitação salva com sucesso.</p>}
        </div>

        <div className="modal-footer-safe px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0"><button onClick={onClose} disabled={saving} className="w-full sm:w-auto px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button><button onClick={handleSalvar} disabled={saving || saved} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-2xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50">{saving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : <><ArrowRightLeft size={14} /> Salvar pedido</>}</button></div>
      </div>
    </div>
  )
}
