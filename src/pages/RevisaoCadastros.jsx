import { useMemo, useState } from 'react'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Edit2, Filter,
  RefreshCw, Search, Users, X, School, GraduationCap,
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

function analisarServidor(servidor) {
  const funcao = String(servidor?.funcao ?? '').trim()
  const funcaoOriginal = String(servidor?.funcao_original ?? '').trim()
  const formacao = String(servidor?.formacao ?? '').trim()
  const fontes = [funcao, funcaoOriginal].filter(Boolean).join(' | ')
  const norm = normalizado(fontes)
  const classificacao = classificarFuncao(servidor)
  const problemas = []

  if (!funcao && !funcaoOriginal) {
    problemas.push({ tipo: 'Sem função', severidade: 'alta', detalhe: 'O cadastro não possui função informada.' })
  }

  if (norm && (TURMA_RE.test(norm) || HORARIO_RE.test(norm) || ATELIE_RE.test(norm) || AREA_RE.test(norm) || DISCIPLINA_RE.test(norm) || LONG_NON_FUNCTION_RE.test(norm))) {
    problemas.push({
      tipo: 'Função possivelmente deslocada',
      severidade: 'alta',
      detalhe: 'O campo função parece conter turma, horário, disciplina ou texto de outro campo.',
    })
  }

  if (!formacao) {
    problemas.push({ tipo: 'Sem formação', severidade: 'média', detalhe: 'Formação não informada.' })
  }

  if (classificacao === 'Professor' && (!norm || !/professor|professora|docent/i.test(norm))) {
    problemas.push({
      tipo: 'Professor inferido',
      severidade: 'média',
      detalhe: 'A classificação semântica identificou possível docência a partir de turma, área ou formação.',
    })
  }

  if (classificacao === 'Atendente de Creche' && !/atendente|cuidador|auxiliar de desenvolvimento infantil|auxiliar maternal/i.test(norm)) {
    problemas.push({
      tipo: 'Atendente inferido',
      severidade: 'média',
      detalhe: 'A classificação semântica encontrou indícios de atuação como atendente/apoio infantil.',
    })
  }

  return {
    servidor,
    classificacao,
    escolas: escolaNomes(servidor),
    problemas,
    prioridade: problemas.some(p => p.severidade === 'alta') ? 'alta' : problemas.length ? 'média' : 'ok',
  }
}

function prioridadeLabel(prioridade) {
  if (prioridade === 'alta') return { label: 'Corrigir', className: 'bg-red-50 text-red-700 border-red-200' }
  if (prioridade === 'média') return { label: 'Revisar', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'OK', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

export default function RevisaoCadastros({ servidores = [], escolas = [], onEditServidor, canEdit = false, refreshToken = 0 }) {
  const [busca, setBusca] = useState('')
  const [escolaFiltro, setEscolaFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [mostrarOk, setMostrarOk] = useState(false)

  const analisados = useMemo(() => servidores.map(analisarServidor), [servidores, refreshToken])

  const pendencias = useMemo(() => analisados.filter(item => item.problemas.length > 0), [analisados])
  const altas = useMemo(() => pendencias.filter(item => item.prioridade === 'alta'), [pendencias])
  const semFuncao = useMemo(() => pendencias.filter(item => item.problemas.some(p => p.tipo === 'Sem função')).length, [pendencias])
  const funcaoDeslocada = useMemo(() => pendencias.filter(item => item.problemas.some(p => p.tipo === 'Função possivelmente deslocada')).length, [pendencias])
  const semFormacao = useMemo(() => pendencias.filter(item => item.problemas.some(p => p.tipo === 'Sem formação')).length, [pendencias])

  const filtrados = useMemo(() => {
    const termo = normalizado(busca)
    return (mostrarOk ? analisados : pendencias).filter(item => {
      if (statusFiltro && String(item.servidor?.status ?? '') !== statusFiltro) return false
      if (escolaFiltro && !item.servidor?.lotacoes?.some(l => !l?.data_fim && String(l?.escola_id) === String(escolaFiltro))) return false
      if (tipoFiltro && !item.problemas.some(p => p.tipo === tipoFiltro)) return false
      if (!termo) return true
      const haystack = normalizado([
        item.servidor?.nome,
        item.servidor?.funcao,
        item.servidor?.funcao_original,
        item.servidor?.formacao,
        ...item.escolas,
      ].filter(Boolean).join(' | '))
      return haystack.includes(termo)
    })
  }, [analisados, pendencias, mostrarOk, busca, escolaFiltro, tipoFiltro, statusFiltro])

  const tipoOpcoes = useMemo(() => {
    const set = new Set()
    pendencias.forEach(item => item.problemas.forEach(p => set.add(p.tipo)))
    return [...set].sort()
  }, [pendencias])

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
              <h1 className="text-xl font-semibold text-slate-800">Cadastros a corrigir</h1>
              <p className="text-sm text-slate-400">Revisão inteligente dos 1.186 cadastros, preservando os dados originais.</p>
            </div>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw size={14} /> Atualizar dados
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Com pendências</span><AlertTriangle size={17} className="text-amber-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{pendencias.length}</p>
          <p className="text-xs text-slate-400 mt-1">{altas.length} exigem correção prioritária</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sem função</span><AlertCircle size={17} className="text-red-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{semFuncao}</p>
          <p className="text-xs text-slate-400 mt-1">Campo obrigatório para gestão</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Função deslocada</span><Filter size={17} className="text-red-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{funcaoDeslocada}</p>
          <p className="text-xs text-slate-400 mt-1">Turma, horário, área ou disciplina</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sem formação</span><GraduationCap size={17} className="text-amber-500" /></div>
          <p className="text-3xl font-semibold text-slate-800 mt-2">{semFormacao}</p>
          <p className="text-xs text-slate-400 mt-1">Pendência informativa</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter size={15} /> Filtros de revisão</div>
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={mostrarOk} onChange={e => setMostrarOk(e.target.checked)} /> Mostrar cadastros sem pendências
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <Search size={15} className="text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, função, formação ou escola..." className="flex-1 bg-transparent outline-none text-sm text-slate-700" />
            {busca && <button onClick={() => setBusca('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <select value={escolaFiltro} onChange={e => setEscolaFiltro(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none">
            <option value="">Todas as escolas</option>
            {escolas.filter(e => e.tipo !== 'SMED').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none">
            <option value="">Todos os tipos</option>
            {tipoOpcoes.map(tipo => <option key={tipo}>{tipo}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 outline-none">
            <option value="">Todos os status</option><option>Ativo</option><option>Afastado</option><option>Inativo</option>
          </select>
          {(busca || escolaFiltro || tipoFiltro || statusFiltro) && <button onClick={limpar} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><X size={13} /> Limpar filtros</button>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500"><strong className="text-slate-800">{filtrados.length}</strong> cadastro(s) no recorte</p>
        <p className="text-xs text-slate-400">A classificação é uma sugestão de revisão; não sobrescreve o dado original.</p>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
          <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-medium text-slate-600">Nenhum cadastro encontrado neste recorte.</p>
          <p className="text-sm mt-1">Isso não significa que o cadastro esteja perfeito; significa apenas que nenhum dos critérios atuais foi acionado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(item => {
            const prioridade = prioridadeLabel(item.prioridade)
            const problemasVisiveis = item.problemas.slice(0, 3)
            return (
              <div key={item.servidor.id} className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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

                  <div className="lg:w-[38%] text-sm">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Função informada</div>
                    <div className="mt-1 text-slate-700 break-words">{item.servidor.funcao || item.servidor.funcao_original || <span className="text-red-500">Não informada</span>}</div>
                    <div className="text-xs text-slate-400 mt-1">Sugestão semântica: <strong className="text-slate-600">{item.classificacao}</strong></div>
                  </div>

                  <div className="lg:w-[30%]">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">O que revisar</div>
                    <div className="mt-1 space-y-1">
                      {problemasVisiveis.map(p => <div key={p.tipo} className="text-xs text-slate-600"><span className="font-semibold">{p.tipo}:</span> {p.detalhe}</div>)}
                    </div>
                  </div>

                  {canEdit && onEditServidor && (
                    <button onClick={() => onEditServidor(item.servidor)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 shrink-0">
                      <Edit2 size={13} /> Corrigir cadastro
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
