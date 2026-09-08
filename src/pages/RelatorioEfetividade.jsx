import { useMemo, useState } from 'react'
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Loader2,
  RefreshCw, Printer, Users,
} from 'lucide-react'
import { useEscolas, useServidoresByEscola, useEfetividade } from '../hooks/useData'

const OCORRENCIA_LEGADA = {
  Falta: 'Falta sem atestado',
  Outro: 'Outro motivo de ausência',
}

function rotuloOcorrencia(valor) {
  return OCORRENCIA_LEGADA[valor] ?? valor ?? ''
}

function mesLabel(mesAno) {
  if (!mesAno) return ''
  const [ano, mes] = mesAno.split('-')
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[Number(mes) - 1]} / ${ano}`
}

function nomeFuncao(servidor) {
  return servidor?.funcao || 'Função não informada'
}

function statusLabel(registro) {
  if (registro?.status === 'ok') return 'Tudo OK'
  if (registro?.status === 'ocorrencia') return rotuloOcorrencia(registro.ocorrencia) || 'Ocorrência'
  return 'Pendente'
}

function statusClass(registro) {
  if (registro?.status === 'ok') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (registro?.status === 'ocorrencia') return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-slate-50 border-slate-200 text-slate-500'
}

function escapeCsv(value) {
  const texto = String(value ?? '')
  return `"${texto.replaceAll('"', '""')}"`
}

export default function RelatorioEfetividade({ escolaInicialId = null, mesAnoInicial, escolaPermitidaId = null, onBack }) {
  const { escolas, loading: loadingEscolas, error: escolasError } = useEscolas()
  const [escolaId, setEscolaId] = useState(escolaInicialId ? String(escolaInicialId) : (escolaPermitidaId ? String(escolaPermitidaId) : ''))
  const [mesAno, setMesAno] = useState(mesAnoInicial || (() => {
    const agora = new Date()
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  }))
  const [filtro, setFiltro] = useState('todos')

  const escolasVisiveis = useMemo(
    () => escolaPermitidaId ? escolas.filter(escola => String(escola.id) === String(escolaPermitidaId)) : escolas.filter(escola => escola.tipo !== 'SMED'),
    [escolas, escolaPermitidaId],
  )

  const escolaSelecionada = useMemo(
    () => escolas.find(escola => String(escola.id) === String(escolaId)) || null,
    [escolas, escolaId],
  )

  const { servidores, loading: loadingServidores, error: servidoresError, reload } = useServidoresByEscola(escolaId ? Number(escolaId) : null)
  const { efe, saving, error: efetividadeError } = useEfetividade(escolaId ? Number(escolaId) : null, mesAno)

  const rows = useMemo(() => {
    return servidores
      .filter(servidor => servidor.status !== 'Inativo')
      .map(servidor => ({ servidor, registro: efe[servidor.id] }))
      .filter(({ registro }) => {
        if (filtro === 'ok') return registro?.status === 'ok'
        if (filtro === 'ocorrencia') return registro?.status === 'ocorrencia'
        if (filtro === 'pendente') return !registro || (registro.status !== 'ok' && registro.status !== 'ocorrencia')
        return true
      })
      .sort((a, b) => a.servidor.nome.localeCompare(b.servidor.nome, 'pt-BR'))
  }, [servidores, efe, filtro])

  const todosRows = useMemo(
    () => servidores.filter(servidor => servidor.status !== 'Inativo').map(servidor => ({ servidor, registro: efe[servidor.id] })),
    [servidores, efe],
  )

  const indicadores = useMemo(() => {
    let tudoOk = 0
    let ocorrencias = 0
    let atestados = 0
    let licencas = 0
    let pendentes = 0
    let dias = 0

    todosRows.forEach(({ registro }) => {
      if (registro?.status === 'ok') tudoOk += 1
      else if (registro?.status === 'ocorrencia') {
        ocorrencias += 1
        const ocorrencia = rotuloOcorrencia(registro.ocorrencia)
        if (ocorrencia === 'Atestado') atestados += 1
        if (ocorrencia === 'Licença') licencas += 1
        dias += Number(registro?.dias_ausencia) || 0
      } else pendentes += 1
    })

    return {
      total: todosRows.length,
      tudoOk,
      ocorrencias,
      atestados,
      licencas,
      dias,
      pendentes,
      percentualConcluido: todosRows.length ? Math.round(((todosRows.length - pendentes) / todosRows.length) * 100) : 0,
    }
  }, [todosRows])

  const erro = escolasError || servidoresError || efetividadeError

  function exportarCsv() {
    const cabecalho = ['Servidor', 'Função', 'Status', 'Ocorrência', 'Dias', 'Detalhamento', 'Observações']
    const linhas = todosRows.map(({ servidor, registro }) => [
      servidor.nome,
      nomeFuncao(servidor),
      statusLabel(registro),
      registro?.status === 'ocorrencia' ? rotuloOcorrencia(registro.ocorrencia) : '',
      registro?.dias_ausencia ?? '',
      registro?.detalhes_ocorrencia ?? '',
      registro?.observacoes ?? '',
    ])
    const csv = [cabecalho, ...linhas].map(linha => linha.map(escapeCsv).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `efetividade-${escolaSelecionada?.name || 'escola'}-${mesAno}.csv`.replaceAll(' ', '_')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="print-report space-y-5 print:space-y-0">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }

          html,
          body {
            background: #fff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            font-size: 9px !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Remove o shell do aplicativo: deixa a folha dedicada ao relatório. */
          body header,
          body nav,
          .no-print {
            display: none !important;
          }

          .print-report {
            display: block !important;
            width: 100vw !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-card {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border-color: #dbe4ea !important;
            border-radius: 8px !important;
          }

          .print-compact-header {
            padding: 7px 9px !important;
            margin-bottom: 5px !important;
          }

          .print-compact-header h2 {
            font-size: 16px !important;
            line-height: 1.1 !important;
            margin-top: 2px !important;
          }

          .print-compact-header p {
            font-size: 8.5px !important;
            line-height: 1.15 !important;
          }

          .print-summary {
            display: flex !important;
            width: 100% !important;
          }

          .screen-summary {
            display: none !important;
          }

          .print-table-wrap {
            overflow: visible !important;
            width: 100% !important;
            max-width: none !important;
          }

          .print-table {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          .print-table thead {
            display: table-header-group !important;
          }

          .print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-table th,
          .print-table td {
            padding: 2.5px 4px !important;
            font-size: 8.5px !important;
            line-height: 1.12 !important;
            vertical-align: top !important;
            word-break: normal !important;
            overflow-wrap: anywhere !important;
          }

          .print-table th {
            padding-top: 3px !important;
            padding-bottom: 3px !important;
            font-size: 7.2px !important;
            line-height: 1.05 !important;
            letter-spacing: .035em !important;
          }

          .print-table td:nth-child(1),
          .print-table th:nth-child(1) { width: 17%; }

          .print-table td:nth-child(2),
          .print-table th:nth-child(2) { width: 22%; }

          .print-table td:nth-child(3),
          .print-table th:nth-child(3) { width: 10%; }

          .print-table td:nth-child(4),
          .print-table th:nth-child(4) { width: 12%; }

          .print-table td:nth-child(5),
          .print-table th:nth-child(5) { width: 5%; }

          .print-table td:nth-child(6),
          .print-table th:nth-child(6) { width: 19%; }

          .print-table td:nth-child(7),
          .print-table th:nth-child(7) { width: 15%; }

          .print-status {
            padding: 1.5px 4px !important;
            font-size: 7px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          .print-footer {
            margin-top: 4px !important;
            font-size: 7px !important;
          }
        }

        @media screen {
          .print-summary { display: none; }
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 no-print">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0b5e7d] mb-3">
            <ArrowLeft size={14} /> Voltar para efetividade
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Relatório de Efetividade</h1>
          <p className="text-sm text-slate-500 mt-1">Resumo mensal completo da unidade, incluindo conferidos, ocorrências, dias e pendências.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => reload()} disabled={!escolaId || loadingServidores || saving} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={14} className={loadingServidores ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button type="button" onClick={exportarCsv} disabled={!escolaId || !todosRows.length} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold disabled:opacity-50">
            <Download size={14} /> CSV
          </button>
          <button type="button" onClick={() => window.print()} disabled={!escolaId || !todosRows.length} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl brand-primary text-white text-xs font-semibold disabled:opacity-50">
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 no-print">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unidade escolar</span>
          <select value={escolaId} onChange={event => setEscolaId(event.target.value)} disabled={loadingEscolas || Boolean(escolaPermitidaId)} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#0f789c] disabled:opacity-70">
            <option value="">Selecionar escola...</option>
            {escolasVisiveis.map(escola => <option key={escola.id} value={escola.id}>{escola.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Competência</span>
          <input type="month" value={mesAno} onChange={event => setMesAno(event.target.value)} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#0f789c]" />
        </label>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700 no-print"><p className="font-semibold">Não foi possível carregar todos os dados.</p><p className="text-xs mt-1 break-words">{erro}</p></div>}

      {!escolaId ? (
        <div className="p-8 bg-[#fff3df] border border-[#f8d6a5] rounded-2xl text-sm text-[#8f4d0b] no-print"><p className="font-semibold">Selecione uma escola para gerar o relatório.</p></div>
      ) : loadingServidores ? (
        <div className="flex items-center justify-center py-20 no-print"><Loader2 size={28} className="animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="print-card print-compact-header bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">EduGestão Vacaria</p>
                <h2 className="text-xl font-semibold text-slate-900 mt-1">{escolaSelecionada?.name || 'Unidade escolar'}</h2>
                <p className="text-sm text-slate-500 mt-1">Efetividade — {mesLabel(mesAno)}</p>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${indicadores.pendentes === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {indicadores.pendentes === 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {indicadores.pendentes === 0 ? 'Efetividade concluída' : `${indicadores.pendentes} pendente(s)`}
              </div>
            </div>
          </div>

          <div className="screen-summary grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="brand-card-blue rounded-2xl p-4"><Users size={16} className="text-[#0f789c] mb-2" /><p className="text-2xl font-semibold text-[#0b5e7d]">{indicadores.total}</p><p className="text-xs text-slate-500 mt-0.5">Servidores</p></div>
            <div className="brand-card-green rounded-2xl p-4"><CheckCircle2 size={16} className="text-[#3c9c5a] mb-2" /><p className="text-2xl font-semibold text-[#287346]">{indicadores.tudoOk}</p><p className="text-xs text-slate-500 mt-0.5">Tudo OK</p></div>
            <div className="brand-card-orange rounded-2xl p-4"><AlertCircle size={16} className="text-[#d96f0d] mb-2" /><p className="text-2xl font-semibold text-[#9a4f08]">{indicadores.atestados}</p><p className="text-xs text-slate-500 mt-0.5">Atestados</p></div>
            <div className="brand-card-orange rounded-2xl p-4"><FileText size={16} className="text-[#d96f0d] mb-2" /><p className="text-2xl font-semibold text-[#9a4f08]">{indicadores.licencas}</p><p className="text-xs text-slate-500 mt-0.5">Licenças</p></div>
            <div className="brand-card-neutral rounded-2xl p-4"><Users size={16} className="text-[#0f789c] mb-2" /><p className="text-2xl font-semibold text-[#20234f]">{indicadores.dias}</p><p className="text-xs text-slate-500 mt-0.5">Dias de ausência</p></div>
            <div className="brand-card-neutral rounded-2xl p-4"><AlertCircle size={16} className="text-[#0f789c] mb-2" /><p className="text-2xl font-semibold text-[#20234f]">{indicadores.pendentes}</p><p className="text-xs text-slate-500 mt-0.5">Pendentes</p></div>
          </div>

          <div className="print-summary items-center justify-between gap-3 border-b border-slate-200 pb-2 mb-2 text-[8px] text-slate-700">
            <span><strong>{indicadores.total}</strong> servidores</span>
            <span><strong>{indicadores.tudoOk}</strong> OK</span>
            <span><strong>{indicadores.atestados}</strong> atestados</span>
            <span><strong>{indicadores.licencas}</strong> licenças</span>
            <span><strong>{indicadores.dias}</strong> dias de ausência</span>
            <span><strong>{indicadores.pendentes}</strong> pendentes</span>
            <span><strong>{indicadores.percentualConcluido}%</strong> concluído</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
            <p className="text-xs text-slate-500">Conclusão: <strong className="text-slate-700">{indicadores.percentualConcluido}%</strong> dos servidores conferidos.</p>
            <select value={filtro} onChange={event => setFiltro(event.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 outline-none">
              <option value="todos">Todos</option>
              <option value="ok">Tudo OK</option>
              <option value="ocorrencia">Com ocorrência</option>
              <option value="pendente">Pendentes</option>
            </select>
          </div>

          <div className="print-card bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="print-table-wrap overflow-x-auto">
              <table className="print-table w-full min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Servidor</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Função</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Situação</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ocorrência</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dias</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Detalhamento</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ servidor, registro }) => (
                    <tr key={servidor.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{servidor.nome}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{nomeFuncao(servidor)}</td>
                      <td className="px-4 py-3"><span className={`print-status inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-semibold ${statusClass(registro)}`}>{statusLabel(registro)}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{registro?.status === 'ocorrencia' ? rotuloOcorrencia(registro.ocorrencia) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-slate-700">{registro?.dias_ausencia ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{registro?.detalhes_ocorrencia || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{registro?.observacoes || '—'}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">Nenhum servidor corresponde ao filtro.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <p className="print-footer text-[11px] text-slate-400 no-print">O relatório considera os servidores ativos apresentados no quadro da unidade e os lançamentos da competência selecionada.</p>
          <p className="print-footer hidden print:block text-[7.5px] text-slate-400 mt-2">Relatório gerado pelo EduGestão Vacaria · {new Date().toLocaleString('pt-BR')}</p>
        </>
      )}
    </div>
  )
}
