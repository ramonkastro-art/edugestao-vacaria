import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── UTILS ───────────────────────────────────────────────────────────────────

export function normStr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

function somenteLotacoesAtuais(servidores = []) {
  return servidores.map(servidor => ({
    ...servidor,
    lotacoes: (servidor.lotacoes ?? []).filter(lotacao => !lotacao.data_fim),
  }))
}

export function hojeISO() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

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

// ─── SERVIDORES (lista completa com lotações) ─────────────────────────────────

export function useServidores() {
  const [servidores, setServidores] = useState([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('servidores')
      .select(`
        id, nome, nome_norm, status, funcao, tipo_vinculo,
        matricula, email, telefone, data_nascimento,
        endereco, formacao, regencia_h, htp_h, hti_h, observacoes,
        lotacoes ( escola_id, principal, data_inicio, data_fim, motivo_saida, escola:escolas(id, name, tipo) )
      `)
      .order('nome')
    if (error) console.error('useServidores:', error)
    setServidores(somenteLotacoesAtuais(data ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { servidores, loading, reload: load }
}

// ─── SERVIDOR ÚNICO ───────────────────────────────────────────────────────────

export function useServidor(id) {
  const [servidor, setServidor] = useState(null)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data } = await supabase
      .from('servidores')
      .select(`
        id, nome, nome_norm, status, funcao, tipo_vinculo,
        matricula, email, telefone, data_nascimento,
        endereco, formacao, regencia_h, htp_h, hti_h, observacoes,
        lotacoes ( escola_id, principal, data_inicio, data_fim, motivo_saida, escola:escolas(id, name, tipo) )
      `)
      .eq('id', id)
      .single()
    setServidor(data ? somenteLotacoesAtuais([data])[0] : null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  return { servidor, loading, reload: load }
}

// ─── SERVIDORES POR ESCOLA ────────────────────────────────────────────────────

export function useServidoresByEscola(escolaId) {
  const [servidores, setServidores] = useState([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    if (!escolaId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('lotacoes')
      .select(`
        escola_id, principal,
        servidor:servidores (
          id, nome, status, funcao, tipo_vinculo, matricula,
          lotacoes ( escola_id, principal, data_inicio, data_fim, motivo_saida, escola:escolas(id, name, tipo) )
        )
      `)
      .eq('escola_id', escolaId)
      .is('data_fim', null)
    setServidores(
      (data ?? [])
        .map(l => l.servidor ? {
          ...l.servidor,
          lotacoes: (l.servidor.lotacoes ?? []).filter(lotacao => !lotacao.data_fim),
          lotacaoAtual: l,
        } : null)
        .filter(Boolean)
        .sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    )
    setLoading(false)
  }, [escolaId])

  useEffect(() => { load() }, [load])
  return { servidores, loading, reload: load }
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
        ;(data ?? []).forEach(e => { map[e.servidor_id] = e })
        setEfe(map)
      })
  }, [escolaId, mesAno])

  async function salvarEfe(servidorId, status, ocorrencia = null) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('efetividade').upsert({
      servidor_id: servidorId,
      escola_id: escolaId,
      mes_ano: mesAno,
      status, ocorrencia,
      registrado_por: user?.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'servidor_id,escola_id,mes_ano' })
    setEfe(prev => ({ ...prev, [servidorId]: { status, ocorrencia } }))
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
        { count: totalServidores },
        { count: totalEscolas },
        { data: lots },
      ] = await Promise.all([
        supabase.from('servidores').select('*', { count: 'exact', head: true }),
        supabase.from('escolas').select('*', { count: 'exact', head: true }),
        supabase.from('lotacoes').select('servidor_id, escola_id').is('data_fim', null),
      ])
      const byServ = {}
      ;(lots ?? []).forEach(l => {
        if (!byServ[l.servidor_id]) byServ[l.servidor_id] = new Set()
        byServ[l.servidor_id].add(l.escola_id)
      })
      setStats({
        totalServidores: totalServidores ?? 0,
        totalEscolas: totalEscolas ?? 0,
        duplos: Object.values(byServ).filter(s => s.size > 1).length,
      })
      setLoading(false)
    }
    load()
  }, [])

  return { stats, loading }
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────

export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { servidores: [], escolas: [] }
  const palavras = normStr(query).split(/\s+/).filter(w => w.length >= 2)
  if (!palavras.length) return { servidores: [], escolas: [] }

  function matchAll(nome) {
    const n = normStr(nome)
    return palavras.every(p => n.includes(p))
  }

  const [{ data: servsRaw }, { data: escolasRaw }] = await Promise.all([
    supabase
      .from('servidores')
      .select(`
        id, nome, status, funcao, tipo_vinculo, matricula,
        email, telefone, data_nascimento, endereco,
        lotacoes ( escola:escolas(id, name, tipo) )
      `)
      .ilike('nome_norm', `%${palavras[0]}%`)
      .limit(60),
    supabase.from('escolas').select('*')
      .ilike('name', `%${query.trim()}%`).limit(5),
  ])

  return {
    servidores: (servsRaw ?? [])
      .map(s => ({ ...s, lotacoes: (s.lotacoes ?? []).filter(lotacao => !lotacao.data_fim) }))
      .filter(s => matchAll(s.nome))
      .slice(0, 12),
    escolas: escolasRaw ?? [],
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function criarServidor(dados, escolaIds = []) {
  const { data: srv, error } = await supabase
    .from('servidores')
    .insert({
      nome:            dados.nome?.trim(),
      status:          dados.status          || 'Ativo',
      funcao:          dados.funcao          || null,
      tipo_vinculo:    dados.tipo_vinculo    || null,
      matricula:       dados.matricula?.trim() || null,
      email:           dados.email?.trim()   || null,
      telefone:        dados.telefone?.trim() || null,
      data_nascimento: dados.data_nascimento || null,
      endereco:        dados.endereco?.trim() || null,
      formacao:        dados.formacao?.trim() || null,
      observacoes:     dados.observacoes?.trim() || null,
    })
    .select('id').single()

  if (error) return { error }

  if (escolaIds.length) {
    await supabase.from('lotacoes').insert(
      escolaIds.map((eid, i) => ({
        servidor_id: srv.id,
        escola_id:   parseInt(eid),
        principal:   i === 0,
      }))
    )
  }
  return { data: srv }
}

export async function atualizarServidor(id, dados) {
  const { error } = await supabase
    .from('servidores')
    .update({
      nome:            dados.nome?.trim(),
      status:          dados.status,
      funcao:          dados.funcao          || null,
      tipo_vinculo:    dados.tipo_vinculo    || null,
      matricula:       dados.matricula?.trim() || null,
      email:           dados.email?.trim()   || null,
      telefone:        dados.telefone?.trim() || null,
      data_nascimento: dados.data_nascimento || null,
      endereco:        dados.endereco?.trim() || null,
      formacao:        dados.formacao?.trim() || null,
      observacoes:     dados.observacoes?.trim() || null,
    })
    .eq('id', id)
  return { error }
}

export async function atualizarLotacoes(servidorId, escolaIds = [], dataReferencia = hojeISO()) {
  const { data, error } = await supabase.rpc('sincronizar_lotacoes', {
    p_servidor_id: servidorId,
    p_escola_ids: escolaIds.map(id => Number(id)).filter(Number.isInteger),
    p_data_referencia: dataReferencia,
  })
  return { data, error }
}

export async function transferirServidorEscola({
  servidorId,
  escolaOrigemId,
  escolaDestinoId,
  dataTransferencia = hojeISO(),
  motivo = null,
}) {
  const { data, error } = await supabase.rpc('transferir_servidor_escola', {
    p_servidor_id: servidorId,
    p_escola_origem_id: Number(escolaOrigemId),
    p_escola_destino_id: Number(escolaDestinoId),
    p_data_transferencia: dataTransferencia,
    p_motivo: motivo?.trim() || null,
  })
  return { data, error }
}

export async function excluirServidor(id) {
  const { error } = await supabase.from('servidores').delete().eq('id', id)
  return { error }
}
