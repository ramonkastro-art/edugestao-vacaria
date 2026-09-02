import { useMemo, useState } from 'react'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Edit2, Filter,
  Info, RefreshCw, Search, Users, X, School, Eye,
} from 'lucide-react'
import { classificarFuncao, normalizar } from '../lib/semantic'

const TURMA_RE = /(^|\s)(?:pre|bercario|maternal)\s*[a-z0-9]|\b[1-9](?:º|o|°)?\s*ano\b|\bturma\b|\bmultisseriada\b|\b(?:b1|b2|b3|bia|bib|biia|biib|biiia|biiib|biiic)\b/i
const HORARIO_RE = /\b\d{1,2}(?::\d{2})?\s*(?:h|hs)?\s*(?:às|a)\s*\d{1,2}(?::\d{2})?/i
const ATELIE_RE = /\bateli[êe]\b|\batelie\b|\bcomponentes curriculares integrados\b/i
const AREA_RE = /\b(?:área|area)\s*(?:i|ii|1|2)\b/i
const DISCIPLINA_RE = /\b(?:matemática|matematica|língua portuguesa|lingua portuguesa|língua inglesa|lingua inglesa|história|historia|geografia|ciências|ciencias|educação física|educacao fisica|artes?|ensino religioso)\b/i
const LONG_NON_FUNCTION_RE = /@|\b(?:rua|bairro|cpf|telefone|gmail|contrato início|contratoinicio)\b/i

function normalizado(value = '') {
  return normalizar(value)
}

function escolaNomes(servidor) {
  const nomes = (servidor?.lotacoes ?? [])
    .filter(l => !l?.data_fim)
    .map(l => l?.escola?.name)
    .filter(Boolean)
  return [...new Set(nomes)]
}

function motivosFuncao(funcao) {
  const norm = normalizado(funcao)
  const motivos = []
  if (TURMA_RE.test(norm)) motivos.push('turma')
  if (HORARIO_RE.test(norm)) motivos.push('horário')
  if (ATELIE_RE.test(norm)) motivos.push('atividade/ateliê')
  if (AREA_RE.test(norm)) motivos.push('Área I/II')
  if (DISCIPLINA_RE.test(norm)) motivos.push('disciplina/área')
  if (LONG_NON_FUNCTION_RE.test(norm)) motivos.push('dados de outro campo')
  return motivos
}

function analisarServidor(servidor) {
  const funcao = String(servidor?.funcao ?? '').trim()
  const funcaoOriginal = String(servidor?.funcao_original ?? '').trim()
  const formacao = String(servidor?.formacao ?? '').trim()
  const fontes = [funcao, funcaoOriginal].filter(Boolean).join(' | ')
  const motivos = motivosFuncao(fontes)
  const classificacao = classificarFuncao(servidor)
  const problemas = []
  const informativos = []

  if (!funcao && !funcaoOriginal) {
    problemas.push({
      tipo: 'Sem função',
      severidade: 'alta',
      detalhe: 'A função não foi informada. Esta é uma correção prioritária porque impede uma classificação administrativa confiável.',
    })
  }

  if (fontes && motivos.length > 0) {
    problemas.push({
      tipo: 'Função possivelmente preenchida em campo incorreto',
      severidade: 'alta',
      detalhe: `O valor informado parece conter ${motivos.join(', ')} em vez de apenas uma função.`,
      evidencia: fontes,
    })
  }

  if (!formacao) {
    informativos.push({
      tipo: 'Formação profissional não informada',
      severidade: 'informativa',
      detalhe: 'Isto não é considerado erro por si só. Muitos cargos podem não exigir uma formação profissional específica. O cadastro pode ser completado posteriormente.',
    })
  }

  if (classificacao === 'Professor' && (!normalizado(fontes) || !/professor|professora|docent/i.test(normalizado(fontes)))) {
    informativos.push({
      tipo: 'Classificação sugerida: Professor',
      severidade: 'informativa',
      detalhe: 'O sistema encontrou indícios de docência em turma, área ou formação. Confirme antes de transformar a sugestão em dado oficial.',
    })
  }

  if (classificacao === 'Atendente de Creche' && !/atendente|cuidador|auxiliar de desenvolvimento infantil|auxiliar maternal/i.test(normalizado(fontes))) {
    informativos.push({
      tipo: 'Classificação sugerida: Atendente de Creche',
      severidade: 'informativa',
      detalhe: 'O sistema encontrou indícios de atuação como atendente/apoio infantil. Confirme antes de transformar a sugestão em dado oficial.',
    })
  }

  return {
    servidor,
    classificacao,
    escolas: escolaNomes(servidor),
    problemas,
    informativos,
    prioridade: problemas.some(p => p.severidade === 'alta') ? 'alta' : 'ok',
  }
}

function prioridadeLabel(prioridade) {
  if (prioridade === 'alta') return { label: 'Corrigir / revisar', className: 'bg-red-50 text-red-700 border-red-200' }
  return { label: 'Sem correção apontada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

export default function RevisaoCadastros({ servidores = [], escolas = [], onEditServidor, canEdit = false, refreshToken = 0 }) {
  const [busca, setBusca] = useState('')
  const [escolaFiltro, setEscolaFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [escopoFiltro, setEscopoFiltro] = useState('correcoes')

  const analisados = useMemo(() => servidores.map(analisarServidor), [servidores, refreshToken])

  const correcoes = useMemo(() => analisados.filter(item => item.problemas.length > 0), [analisados])
  const altas = useMemo(() => correcoes.filter(item => item.prioridade === 'alta'), [correcoes])
  const semFuncao = useMemo(() => correcoes.filter(item => item.problemas.some(p => p.tipo === 'Sem função')).length, [correcoes])
  const funcaoDeslocada = useMemo(() => correcoes.filter(item => item.problemas.some(p => p.tipo === 'Função possivelmente preenchida em campo incorreto')).length, [correcoes])
  const formacaoNaoInformada = useMemo(() => analisados.filter(item => item.informativos.some(p => p.tipo === 'Formação profissional não informada')).length, [analisados])
  const classificacoesSugeridas = useMemo(() => analisados.filter(item => item.informativos.some(p => p.tipo.startsWith('Classificação sugerida'))).length, [analisados])

  const filtrados = useMemo(() => {
    const termo = normalizado(busca)
    let base = analisados
    if (escopoFiltro === 'correcoes') base = correcoes
    if (escopoFiltro === 'informativos') base = analisados.filter(item => item.informativos.length > 0)

    return base.filter(item => {
      if (statusFiltro && String(item.servidor?.status ?? '') !== statusFiltro) return false
      if (escolaFiltro && !item.servidor?.lotacoes?.some(l => !l?.data_fim && String(l?.escola_id) === String(escolaFiltro))) return false
      if (tipoFiltro && !item.problemas.some(p => p.tipo === tipoFiltro) && !item.informativos.some(p => p.tipo === tipoFiltro)) return false
      if (!termo) return true
      const haystack = normalizado([
        item.servidor?.nome,
        item.servidor?.funcao,
        item.servidor?.funcao_original,
        item.servidor?.formacao,
        item.classificacao,
        ...item.escolas,
      ].filter(Boolean).join(' | '))
      return haystack.includes(termo)
    })
  }, [analisados, correcoes, escopoFiltro, busca, escolaFiltro, tipoFiltro, statusFiltro])

  const tipoOpcoes = useMemo(() => {
    const set = new Set()
    analisados.forEach(item => {
      item.problemas.forEach(p => set.add(p.tipo))
      item.informativos.forEach(p => set.add(p.tipo))
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [analisados])

  function limpar() {
    setBusca('')
    setEscolaFiltro('')
    setTipoFiltro('')
    setStatusFiltro('')
  }

  return (
    <div className="space-y-5" key={refreshToken}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Revisão de cadastros</h1>
              <p className="text-sm text-slate-400">O sistema aponta evidências para revisão; ele não declara que um cadastro está errado automaticamente.</p>
            </div>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw size={14} /> Atualizar dados
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Para corrigir / revisar</span><AlertTriangle size={17} className="text-amber-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{altas.length}</p>
          <p className="text-xs text-slate-400 mt-1">Somente problemas acionáveis</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sem função</span><AlertCircle size={17} className="text-red-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{semFuncao}</p>
          <p className="text-xs text-slate-400 mt-1">Correção prioritária</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Revisar função</span><Eye size={17} className="text-red-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{funcaoDeslocada}</p>
          <p className="text-xs text-slate-400 mt-1">Suspeita baseada no conteúdo do campo</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informação faltante</span><Info size={17} className="text-sky-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{formacaoNaoInformada}</p>
          <p className="text-xs text-slate-400 mt-1">Formação profissional não informada — não é erro automático</p>
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-sm text-sky-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Como interpretar esta tela</p>
            <p className="text-xs mt-1 text-sky-800">“Sem função” é uma correção objetiva. “Revisar função” é uma suspeita baseada no conteúdo do campo. Já a ausência de formação profissional é apenas informativa: ela não significa que o servidor esteja irregular. O sistema também pode sugerir uma função, mas a decisão final continua sendo humana.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter size={15} /> Filtros de revisão</div>
          <span className="ml-auto text-xs text-slate-400">{classificacoesSugeridas} classificação(ões) automática(s) sugerida(s)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <Search size={15} className="text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, função, formação ou escola..." className="flex-1 bg-transparent outline-none text-sm text-slate-700" />
            {busca && <button onClick={() => setBusca('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <select value={escopoFiltro} onChange={e => setEscopoFiltro(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none">
            <option value="correcoes">Somente correções / suspeitas</option>
            <option value="informativos">Informações faltantes / sugestões</option>
            <option value="todos">Todos os cadastros</option>
          </select>
          <select value={escolaFiltro} onChange={e => setEscolaFiltro(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none">
            <option value="">Todas as escolas</option>
            {escolas.filter(e => e.tipo !== 'SMED').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 outline-none">
            <option value="">Todos os tipos</option>
            {tipoOpcoes.map(tipo => <option key={tipo}>{tipo}</option>)}
          </select>
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 outline-none">
            <option value="">Todos os status</option><option>Ativo</option><option>Afastado</option><option>Inativo</option>
          </select>
          {(busca || escolaFiltro || tipoFiltro || statusFiltro || escopoFiltro !== 'correcoes') && <button onClick={() => { limpar(); setEscopoFiltro('correcoes') }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><X size={13} /> Limpar filtros</button>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500"><strong className="text-slate-800">{filtrados.length}</strong> cadastro(s) no recorte</p>
        <p className="text-xs text-slate-400">As sugestões não sobrescrevem os dados originais.</p>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
          <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-medium text-slate-600">Nenhuma revisão encontrada neste recorte.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(item => {
            const prioridade = prioridadeLabel(item.prioridade)
            const problemasVisiveis = item.problemas.slice(0, 3)
            const informativosVisiveis = item.informativos.slice(0, 2)
            return (
              <div key={item.servidor.id} className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Users size={17} className="text-slate-500" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-slate-800">{item.servidor.nome}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${prioridade.className}`}>{prioridade.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
                        <span className="inline-flex items-center gap-1"><School size={12} /> {item.escolas.join(' · ') || 'Sem escola'}</span>
                        <span>• {item.servidor.status || 'Sem status'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-[28%] text-sm">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Valor informado</div>
                    <div className="mt-1 text-slate-700 break-words">{item.servidor.funcao || item.servidor.funcao_original || <span className="text-red-500">Não informada</span>}</div>
                    <div className="text-xs text-slate-400 mt-1">Classificação sugerida: <strong className="text-slate-600">{item.classificacao || 'Não classificado'}</strong></div>
                  </div>

                  <div className="lg:w-[34%]">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Por que o sistema chamou atenção</div>
                    <div className="mt-1 space-y-2">
                      {problemasVisiveis.map(p => (
                        <div key={p.tipo} className="text-xs text-slate-600">
                          <div><span className="font-semibold text-red-700">{p.tipo}:</span> {p.detalhe}</div>
                          {p.evidencia && <div className="mt-1 rounded-lg bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-500">Evidência: <span className="font-medium text-slate-600">{p.evidencia}</span></div>}
                        </div>
                      ))}
                      {problemasVisiveis.length === 0 && informativosVisiveis.map(p => (
                        <div key={p.tipo} className="text-xs text-slate-600">
                          <span className="font-semibold text-sky-700">{p.tipo}:</span> {p.detalhe}
                        </div>
                      ))}
                    </div>
                  </div>

                  {canEdit && onEditServidor && (
                    <button onClick={() => onEditServidor(item.servidor)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 shrink-0">
                      <Edit2 size={13} /> Abrir cadastro
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
