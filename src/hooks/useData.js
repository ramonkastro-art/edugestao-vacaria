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

// ─── PROFESSORES (lista completa com nomeações) ───────────────────────────────

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

// ─── PROFESSORES DE UMA ESCOLA ───────────────────────────────────────────────

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
// Tabela: servidores_unificado (1179 servidores — professores + t&a juntos)
// Sem parâmetros: busca tudo, filtro no front

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
    setLoading(true)
    setError(null)
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
    supabase
      .from('efetividade')
      .select('*')
      .eq('escola_id', escolaId)
      .eq('mes_ano', mesAno)
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
      professor_id: professorId,
      escola_id: escolaId,
      mes_ano: mesAno,
      status,
      ocorrencia,
      registrado_por: user?.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professor_id,escola_id,mes_ano' })
    setEfe(prev => ({ ...prev, [professorId]: { status, ocorrencia } }))
    setSaving(false)
  }

  return { efe, salvarEfe, saving }
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [stats, setStats]   = useState(null)
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
      const duplos = Object.values(byProf).filter(s => s.size > 1).length
      setStats({
        totalProfs: totalProfs ?? 0,
        totalEscolas: totalEscolas ?? 0,
        totalServidores: totalServidores ?? 0,
        totalNomeacoes: noms?.length ?? 0,
        duplos,
      })
      setLoading(false)
    }
    load()
  }, [])

  return { stats, loading }
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────
// Busca professores (tabela professores) E servidores unificados juntos

export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { profs: [], escolas: [], servidores: [] }

  const [
    { data: profs },
    { data: escolas },
    { data: servidores },
  ] = await Promise.all([
    supabase
      .from('professores')
      .select('id, nome, status, nomeacoes(escola:escolas(id,name))')
      .ilike('nome', `%${query}%`)
      .limit(8),
    supabase
      .from('escolas')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5),
    supabase
      .from('servidores_unificado')
      .select('id, nome, escola_raw, telefone, email')
      .ilike('nome_normalizado', `%${query.toUpperCase()}%`)
      .limit(8),
  ])

  return {
    profs:      profs      ?? [],
    escolas:    escolas    ?? [],
    servidores: servidores ?? [],
  }
}
