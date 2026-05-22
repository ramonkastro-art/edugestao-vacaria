import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── ESCOLAS ─────────────────────────────────────────────────────────────────

export function useEscolas() {
  const [escolas, setEscolas] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('escolas').select('*').order('name')
      .then(({ data }) => { setEscolas(data ?? []); setLoading(false) })
  }, [])
  return { escolas, loading }
}

// ─── PROFESSORES ─────────────────────────────────────────────────────────────

export function useProfessores() {
  const [professores, setProfessores] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('professores')
      .select(`
        id, nome, status, email, telefone, formacao,
        regencia_h, htp_h, hti_h,
        nomeacoes (
          id, matricula, cargo, tipo_vinculo, observacoes, ativa,
          escola:escolas ( id, name, tipo )
        )
      `)
      .order('nome')
    setProfessores(data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  return { professores, loading, reload: load }
}

// ─── PROFESSORES POR ESCOLA ───────────────────────────────────────────────────

export function useProfessoresByEscola(escolaId) {
  const [professores, setProfessores] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!escolaId) return
    supabase
      .from('nomeacoes')
      .select(`
        id, matricula, cargo, tipo_vinculo, observacoes,
        professor:professores (
          id, nome, status, regencia_h, htp_h, hti_h,
          nomeacoes ( escola:escolas ( id, name, tipo ) )
        )
      `)
      .eq('escola_id', escolaId)
      .eq('ativa', true)
      .then(({ data }) => {
        const map = new Map()
        ;(data ?? []).forEach(n => {
          const p = n.professor
          if (!p) return
          if (!map.has(p.id)) map.set(p.id, { ...p, nomeacoesAqui: [] })
          map.get(p.id).nomeacoesAqui.push({
            id: n.id, matricula: n.matricula, cargo: n.cargo,
            tipo_vinculo: n.tipo_vinculo, observacoes: n.observacoes,
          })
        })
        setProfessores([...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
        setLoading(false)
      })
  }, [escolaId])
  return { professores, loading }
}

// ─── SERVIDORES UNIFICADOS ────────────────────────────────────────────────────

export function useServidores() {
  const [servidores, setServidores] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('servidores_unificado')
      .select('id, nome, nome_normalizado, email, telefone, endereco, data_nascimento, escola_raw')
      .order('nome_normalizado')
    if (error) console.error('useServidores:', error)
    setServidores(data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  return { servidores, loading, reload: load }
}

// ─── DETALHES DE UM SERVIDOR ──────────────────────────────────────────────────

export function useServidorDetalhes(id) {
  const [servidor, setServidor] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  useEffect(() => {
    if (!id) return
    setLoading(true); setError(null)
    supabase
      .from('servidores_unificado')
      .select('id, nome, nome_normalizado, email, telefone, endereco, data_nascimento, escola_raw')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err)
        else setServidor(data)
        setLoading(false)
      })
  }, [id])
  return { servidor, loading, error }
}

// ─── EFETIVIDADE ─────────────────────────────────────────────────────────────

export function useEfetividade(escolaId, mesAno) {
  const [efe, setEfe]       = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!escolaId || !mesAno) return
    supabase.from('efetividade').select('*')
      .eq('escola_id', escolaId).eq('mes_ano', mesAno)
      .then(({ data }) => {
        const map = {}
        ;(data ?? []).forEach(e => { map[e.professor_id] = e })
        setEfe(map)
      })
  }, [escolaId, mesAno])
  async function salvarEfe(professorId, status, ocorrencia = null) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('efetividade').upsert({
      professor_id: professorId, escola_id: escolaId, mes_ano: mesAno,
      status, ocorrencia, registrado_por: user?.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professor_id,escola_id,mes_ano' })
    setEfe(prev => ({ ...prev, [professorId]: { status, ocorrencia } }))
    setSaving(false)
  }
  return { efe, salvarEfe, saving }
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      const [
        { count: totalProfs },
        { count: totalEscolas },
        { count: totalServidores },
        { data: noms },
      ] = await Promise.all([
        supabase.from('professores').select('*', { count: 'exact', head: true }),
        supabase.from('escolas').select('*', { count: 'exact', head: true }),
        supabase.from('servidores_unificado').select('*', { count: 'exact', head: true }),
        supabase.from('nomeacoes').select('professor_id, escola_id').eq('ativa', true),
      ])
      const byProf = {}
      ;(noms ?? []).forEach(n => {
        if (!byProf[n.professor_id]) byProf[n.professor_id] = new Set()
        byProf[n.professor_id].add(n.escola_id)
      })
      setStats({
        totalProfs: totalProfs ?? 0,
        totalEscolas: totalEscolas ?? 0,
        totalServidores: totalServidores ?? 0,
        totalNomeacoes: noms?.length ?? 0,
        duplos: Object.values(byProf).filter(s => s.size > 1).length,
      })
      setLoading(false)
    }
    load()
  }, [])
  return { stats, loading }
}

// ─── BUSCA GLOBAL — MULTI-PALAVRA ─────────────────────────────────────────────
//
// Estratégia: divide a query em palavras e aplica um filtro para cada uma.
// "Ana Velho" → busca registros que contenham "Ana" E "Velho" no nome,
// independente da ordem ou de palavras no meio.
//
// No Supabase PostgREST, cada .ilike() encadeia como AND automático
// quando chamados em sequência na mesma query.

function buildMultiWordFilter(query) {
  // Remove acentos para comparação mais robusta
  return query
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .trim()
    .split(/\s+/)               // divide por espaços
    .filter(w => w.length >= 2) // ignora palavras muito curtas
}

export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { profs: [], escolas: [], servidores: [] }

  const palavras = buildMultiWordFilter(query)
  if (palavras.length === 0) return { profs: [], escolas: [], servidores: [] }

  // ── Professores: filtra por cada palavra no nome (AND implícito) ──
  // PostgREST não suporta múltiplos ilike AND em uma chamada fluente,
  // então usamos or() com todas as combinações se for 1 palavra,
  // e para múltiplas palavras fazemos a interseção no cliente.
  const profPromise = supabase
    .from('professores')
    .select('id, nome, status, nomeacoes(escola:escolas(id,name))')
    .ilike('nome', `%${query.trim()}%`)  // tentativa direta primeiro
    .limit(20)

  // ── Servidores: busca no nome_normalizado (sem acentos, maiúsculo) ──
  // Para multi-palavra, buscamos com a query completa e também com a
  // primeira palavra para ampliar o recall, depois filtramos no cliente.
  const srvQuery = palavras[0] // primeira palavra para busca inicial ampla
  const srvPromise = supabase
    .from('servidores_unificado')
    .select('id, nome, nome_normalizado, escola_raw, telefone, email')
    .ilike('nome_normalizado', `%${srvQuery}%`)
    .limit(50) // busca mais e filtra no cliente

  const escolaPromise = supabase
    .from('escolas')
    .select('*')
    .ilike('name', `%${query.trim()}%`)
    .limit(5)

  const [
    { data: profsRaw },
    { data: servsRaw },
    { data: escolas },
  ] = await Promise.all([profPromise, srvPromise, escolaPromise])

  // ── Filtragem multi-palavra no cliente ───────────────────────────────
  // Garante que TODAS as palavras da query aparecem no nome do resultado.

  function matchesTodas(nome) {
    const nomeNorm = (nome || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
    return palavras.every(p => nomeNorm.includes(p))
  }

  const profs = (profsRaw ?? []).filter(p => matchesTodas(p.nome)).slice(0, 8)

  // Para professores: se a busca direta não encontrou (ex: "Ana Velho"),
  // faz uma segunda tentativa buscando pela primeira palavra e filtrando
  let profsResult = profs
  if (profs.length === 0 && palavras.length > 1) {
    const { data: profsAmplo } = await supabase
      .from('professores')
      .select('id, nome, status, nomeacoes(escola:escolas(id,name))')
      .ilike('nome', `%${palavras[0]}%`)
      .limit(100)
    profsResult = (profsAmplo ?? []).filter(p => matchesTodas(p.nome)).slice(0, 8)
  }

  const servidores = (servsRaw ?? []).filter(s => matchesTodas(s.nome)).slice(0, 8)

  return {
    profs:      profsResult,
    escolas:    escolas ?? [],
    servidores,
  }
}
