import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── ESCOLAS ─────────────────────────────────────────────────────────────────

export function useEscolas() {
  const [escolas, setEscolas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('escolas')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setEscolas(data ?? [])
        setLoading(false)
      })
  }, [])

  return { escolas, loading }
}

// ─── PROFESSORES (com nomeações) ─────────────────────────────────────────────

export function useProfessores() {
  const [professores, setProfessores] = useState([])
  const [loading, setLoading]         = useState(true)

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
  const [loading, setLoading]         = useState(true)

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
        // deduplica professores (podem ter 2 nomeações na mesma escola)
        const map = new Map()
        ;(data ?? []).forEach(n => {
          const p = n.professor
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

// ─── EFETIVIDADE ─────────────────────────────────────────────────────────────

export function useEfetividade(escolaId, mesAno) {
  const [efe, setEfe]     = useState({})   // { professor_id: { status, ocorrencia } }
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
    await supabase
      .from('efetividade')
      .upsert({
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
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: totalProfs }, { count: totalEscolas }, { data: noms }] = await Promise.all([
        supabase.from('professores').select('*', { count: 'exact', head: true }),
        supabase.from('escolas').select('*', { count: 'exact', head: true }),
        supabase.from('nomeacoes').select('professor_id, escola_id').eq('ativa', true),
      ])

      // professores com 2+ escolas diferentes
      const byProf = {}
      ;(noms ?? []).forEach(n => {
        if (!byProf[n.professor_id]) byProf[n.professor_id] = new Set()
        byProf[n.professor_id].add(n.escola_id)
      })
      const duplos = Object.values(byProf).filter(s => s.size > 1).length

      setStats({ totalProfs, totalEscolas, totalNomeacoes: noms?.length ?? 0, duplos })
      setLoading(false)
    }
    load()
  }, [])

  return { stats, loading }
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────


// ─── DETALHES DO PROFESSOR ───────────────────────────────────────────────────
export function useProfessorDetalhes(profId) {
  const [prof, setProf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!profId) {
      setProf(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('professores')
      .select(`
        id, nome, status, email, telefone, formacao,
        regencia_h, htp_h, hti_h,
        nomeacoes (
          id, matricula, cargo, tipo_vinculo, observacoes, ativa,
          escola:escolas ( id, name, tipo )
        )
      `)
      .eq('id', profId)
      .single()

    if (error) {
      setError(error)
      setProf(null)
    } else {
      setProf(data ?? null)
    }
    setLoading(false)
  }, [profId])

  useEffect(() => { load() }, [load])

  return { prof, loading, error, reload: load }
}
export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { profs: [], escolas: [] }

  const [{ data: profs }, { data: escolas }] = await Promise.all([
    supabase
      .from('professores')
      .select('id, nome, status, nomeacoes(escola:escolas(id, name))')
      .ilike('nome', `%${query}%`)
      .limit(8),
    supabase
      .from('escolas')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5),
  ])

  return { profs: profs ?? [], escolas: escolas ?? [] }
}
