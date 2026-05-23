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

// ─── SERVIDORES UNIFICADOS ────────────────────────────────────────────────────
// Lista única: cruza professores (com nomeações) + dados cadastrais
// Retorna array de objetos com shape:
// { id, nome, status, nomeacoes[], cadastro: {telefone, email, endereco, ...} | null }

export function useServidoresUnificados() {
  const [servidores, setServidores] = useState([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    // Busca paralela: professores com nomeações + tabela cadastral
    const [{ data: profs }, { data: cadastros }] = await Promise.all([
      supabase
        .from('professores')
        .select(`
          id, nome, status,
          nomeacoes (
            id, matricula, cargo, tipo_vinculo, observacoes, ativa,
            escola:escolas ( id, name, tipo )
          )
        `)
        .order('nome'),
      supabase
        .from('servidores_unificado')
        .select('id, nome, nome_normalizado, email, telefone, endereco, data_nascimento, escola_raw'),
    ])

    // Índice de cadastros pelo nome normalizado para lookup rápido
    const cadastroIdx = {}
    ;(cadastros ?? []).forEach(c => {
      const key = (c.nome_normalizado || c.nome || '').toUpperCase().trim()
      cadastroIdx[key] = c
    })

    // Para cada professor, tenta casar com cadastro pelo nome
    const lista = (profs ?? []).map(p => {
      const key = p.nome.toUpperCase().trim()
      const cadastro = cadastroIdx[key] ?? null
      return { ...p, cadastro }
    })

    // Cadastros que NÃO têm professor correspondente (pessoal T&A puro)
    const nomesProfs = new Set((profs ?? []).map(p => p.nome.toUpperCase().trim()))
    ;(cadastros ?? []).forEach(c => {
      const key = (c.nome_normalizado || c.nome || '').toUpperCase().trim()
      if (!nomesProfs.has(key)) {
        lista.push({
          id: `cad_${c.id}`,   // prefixo para distinguir
          nome: c.nome,
          status: 'Ativo',
          nomeacoes: [],        // sem nomeação formal no sistema
          cadastro: c,
        })
      }
    })

    // Ordena tudo por nome
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    setServidores(lista)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { servidores, loading, reload: load }
}

// ─── PROFESSORES POR ESCOLA (mantido para tela de quadro) ────────────────────

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
        setProfessores([...map.values()].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR')))
        setLoading(false)
      })
  }, [escolaId])
  return { professores, loading }
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
        { count: totalCadastrais },
        { data: noms },
      ] = await Promise.all([
        supabase.from('professores').select('*', { count:'exact', head:true }),
        supabase.from('escolas').select('*', { count:'exact', head:true }),
        supabase.from('servidores_unificado').select('*', { count:'exact', head:true }),
        supabase.from('nomeacoes').select('professor_id, escola_id').eq('ativa', true),
      ])
      const byProf = {}
      ;(noms ?? []).forEach(n => {
        if (!byProf[n.professor_id]) byProf[n.professor_id] = new Set()
        byProf[n.professor_id].add(n.escola_id)
      })
      setStats({
        totalProfs:     totalProfs ?? 0,
        totalEscolas:   totalEscolas ?? 0,
        totalCadastrais: totalCadastrais ?? 0,
        totalNomeacoes: noms?.length ?? 0,
        duplos: Object.values(byProf).filter(s => s.size > 1).length,
      })
      setLoading(false)
    }
    load()
  }, [])
  return { stats, loading }
}

// ─── BUSCA GLOBAL — multi-palavra, resultado unificado ────────────────────────
// Retorna array único de servidores (sem separar professor/cadastral)

function normStr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { servidores: [], escolas: [] }

  const palavras = normStr(query).split(/\s+/).filter(w => w.length >= 2)
  if (palavras.length === 0) return { servidores: [], escolas: [] }

  function matchAll(nome) {
    const n = normStr(nome)
    return palavras.every(p => n.includes(p))
  }

  // Busca pela primeira palavra em ambas as tabelas (mais ampla)
  const p1 = palavras[0]
  const [
    { data: profsRaw },
    { data: cadastrosRaw },
    { data: escolasRaw },
  ] = await Promise.all([
    supabase
      .from('professores')
      .select('id, nome, status, nomeacoes(escola:escolas(id,name,tipo))')
      .ilike('nome', `%${p1}%`)
      .limit(60),
    supabase
      .from('servidores_unificado')
      .select('id, nome, nome_normalizado, escola_raw, telefone, email, endereco, data_nascimento')
      .ilike('nome_normalizado', `%${p1}%`)
      .limit(60),
    supabase
      .from('escolas')
      .select('*')
      .ilike('name', `%${query.trim()}%`)
      .limit(5),
  ])

  // Filtra multi-palavra no cliente
  const profs     = (profsRaw ?? []).filter(p => matchAll(p.nome))
  const cadastros = (cadastrosRaw ?? []).filter(c => matchAll(c.nome_normalizado || c.nome))

  // Índice de nomes dos professores para deduplicação
  const nomeProfs = new Set(profs.map(p => normStr(p.nome)))

  // Cadastros que já têm professor correspondente → enriquecem o professor
  const cadastroIdx = {}
  cadastros.forEach(c => { cadastroIdx[normStr(c.nome_normalizado || c.nome)] = c })

  // Resultado unificado
  const resultado = []

  profs.forEach(p => {
    resultado.push({
      _tipo: 'servidor',
      id: p.id,
      nome: p.nome,
      status: p.status,
      nomeacoes: p.nomeacoes ?? [],
      cadastro: cadastroIdx[normStr(p.nome)] ?? null,
    })
  })

  // Cadastros sem professor correspondente (pessoal T&A puro)
  cadastros.forEach(c => {
    const key = normStr(c.nome_normalizado || c.nome)
    if (!nomeProfs.has(key)) {
      resultado.push({
        _tipo: 'servidor',
        id: `cad_${c.id}`,
        nome: c.nome,
        status: 'Ativo',
        nomeacoes: [],
        cadastro: c,
      })
    }
  })

  resultado.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return { servidores: resultado.slice(0, 12), escolas: escolasRaw ?? [] }
}

// ─── SALVAR NOVO SERVIDOR ────────────────────────────────────────────────────
// Insere em servidores_unificado (dados pessoais)
// Se for professor, insere também em professores + nomeacoes

export async function salvarNovoServidor(dados) {
  const {
    nome, email, telefone, endereco, data_nascimento,
    funcao, escola_raw,
    // campos só para professores
    matricula, cargo, tipo_vinculo, escola_id,
  } = dados

  const nomeNorm = (nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim()

  // 1. Insere na tabela cadastral (todos os servidores)
  const { data: cad, error: cadErr } = await supabase
    .from('servidores_unificado')
    .insert({
      nome: nome.trim(),
      nome_normalizado: nomeNorm,
      email:            email     || null,
      telefone:         telefone  || null,
      endereco:         endereco  || null,
      data_nascimento:  data_nascimento || null,
      escola_raw:       escola_raw || null,
    })
    .select()
    .single()

  if (cadErr) return { error: cadErr }

  // 2. Se for professor, insere também na tabela professores + nomeações
  const ehProfessor = funcao?.toLowerCase().includes('professor') ||
                      funcao?.toLowerCase().includes('prof')

  if (ehProfessor && escola_id) {
    const { data: prof, error: profErr } = await supabase
      .from('professores')
      .insert({
        nome:   nome.trim(),
        status: 'Ativo',
        email:  email    || null,
        telefone: telefone || null,
      })
      .select()
      .single()

    if (!profErr && prof) {
      await supabase.from('nomeacoes').insert({
        professor_id:   prof.id,
        escola_id:      parseInt(escola_id),
        matricula:      matricula    || null,
        cargo:          cargo        || funcao,
        tipo_vinculo:   tipo_vinculo || 'Efetivo',
        ativa:          true,
      })
    }
  }

  return { data: cad, error: null }
}
