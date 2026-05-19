import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ─── ESCOLAS ─────────────────────────────────────────────────────────────────

export function useEscolas() {
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("escolas")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setEscolas(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { escolas, loading };
}

// ─── PROFESSORES (com nomeações) ─────────────────────────────────────────────

export function useProfessores() {
  const [professores, setProfessores] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("professores")
        .select(
          `
        id, nome, status, email, telefone, formacao,
        regencia_h, htp_h, hti_h,
        nomeacoes (
          id, matricula, cargo, tipo_vinculo, observacoes, ativa,
          escola:escolas ( id, name, tipo )
        )
      `,
        )
        .order("nome");
      setProfessores(data ?? []);
    } catch (err) {
      setProfessores([]);
      // opcional: console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { professores, loading, reload: load };
}

// ─── PROFESSORES DE UMA ESCOLA ───────────────────────────────────────────────

export function useProfessoresByEscola(escolaId) {
  const [professores, setProfessores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!escolaId) return;
    setLoading(true);

    supabase
      .from("nomeacoes")
      .select(
        `
        id, matricula, cargo, tipo_vinculo, observacoes,
        professor:professores (
          id, nome, status, regencia_h, htp_h, hti_h,
          nomeacoes ( escola:escolas ( id, name, tipo ) )
        )
      `,
      )
      .eq("escola_id", escolaId)
      .eq("ativa", true)
      .then(({ data }) => {
        // deduplica professores (podem ter 2 nomeações na mesma escola)
        const map = new Map();
        (data ?? []).forEach((n) => {
          const p = n.professor;
          if (!p?.id) return;
          if (!map.has(p.id)) map.set(p.id, { ...p, nomeacoesAqui: [] });
          map.get(p.id).nomeacoesAqui.push({
            id: n.id,
            matricula: n.matricula,
            cargo: n.cargo,
            tipo_vinculo: n.tipo_vinculo,
            observacoes: n.observacoes,
          });
        });
        setProfessores(
          [...map.values()].sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR"),
          ),
        );
        setLoading(false);
      })
      .catch(() => {
        setProfessores([]);
        setLoading(false);
      });
  }, [escolaId]);

  return { professores, loading };
}

// ─── EFETIVIDADE ─────────────────────────────────────────────────────────────

export function useEfetividade(escolaId, mesAno) {
  const [efe, setEfe] = useState({}); // { professor_id: { status, ocorrencia } }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId || !mesAno) return;
    supabase
      .from("efetividade")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("mes_ano", mesAno)
      .then(({ data }) => {
        const map = {};
        (data ?? []).forEach((e) => {
          map[e.professor_id] = e;
        });
        setEfe(map);
      })
      .catch(() => setEfe({}));
  }, [escolaId, mesAno]);

  async function salvarEfe(professorId, status, ocorrencia = null) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("efetividade").upsert(
        {
          professor_id: professorId,
          escola_id: escolaId,
          mes_ano: mesAno,
          status,
          ocorrencia,
          registrado_por: user?.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "professor_id,escola_id,mes_ano" },
      );

      setEfe((prev) => ({ ...prev, [professorId]: { status, ocorrencia } }));
    } catch (err) {
      // opcional: console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return { efe, salvarEfe, saving };
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [{ count: totalProfs }, { count: totalEscolas }, { data: noms }] =
          await Promise.all([
            supabase
              .from("professores")
              .select("*", { count: "exact", head: true }),
            supabase
              .from("escolas")
              .select("*", { count: "exact", head: true }),
            supabase
              .from("nomeacoes")
              .select("professor_id, escola_id")
              .eq("ativa", true),
          ]);

        // professores com 2+ escolas diferentes
        const byProf = {};
        (noms ?? []).forEach((n) => {
          if (!byProf[n.professor_id]) byProf[n.professor_id] = new Set();
          byProf[n.professor_id].add(n.escola_id);
        });
        const duplos = Object.values(byProf).filter((s) => s.size > 1).length;

        setStats({
          totalProfs,
          totalEscolas,
          totalNomeacoes: noms?.length ?? 0,
          duplos,
        });
      } catch (err) {
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { stats, loading };
}

// ─── SERVIDORES (cadastro único + matrículas + vínculos) ─────────────────────
// Requer as tabelas: servidores, servidor_matriculas, servidor_vinculos

export function useServidores({ query = "", limit = 500 } = {}) {
  const [servidores, setServidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (opts = {}) => {
      setLoading(true);
      setError(null);

      try {
        let q = supabase
          .from("servidores")
          .select("id, nome")
          .order("nome")
          .limit(limit);

        if (query && query.trim().length >= 2) {
          q = q.ilike("nome", `%${query.trim()}%`);
        }

        const { data, error } = await q;

        if (error) {
          setError(error);
          setServidores([]);
        } else {
          setServidores(data ?? []);
        }
      } catch (err) {
        setError(err);
        setServidores([]);
      } finally {
        setLoading(false);
      }
    },
    [query, limit],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { servidores, loading, error, reload: load };
}

// ─── useServidorDetalhes (detalhes por id: servidor + vínculos + matriculas) ──

/**
 * useServidorDetalhes
 * Fetch detalhado de um servidor: linha de 'servidores' + vínculos + matriculas.
 * Retorna { servidor, vinculos, matriculas, loading, error, reload }
 *
 * Observação: ajuste os nomes das tabelas ('servidores', 'servidor_vinculos', 'servidor_matriculas')
 * caso no seu Supabase os objetos tenham nomes diferentes.
 */
export function useServidorDetalhes(servidorId) {
  const [servidor, setServidor] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!servidorId) {
      setServidor(null);
      setVinculos([]);
      setMatriculas([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) servidor (linha principal)
      const { data: sData, error: sError } = await supabase
        .from("servidores")
        .select("*")
        .eq("id", servidorId)
        .single();

      if (sError) throw sError;

      // 2) vínculos (busca separada para evitar problemas de embed)
      const { data: vData, error: vError } = await supabase
        .from("servidor_vinculos")
        .select(
          "id, servidor_id, cargo, atuacao, escola, turno, tipo_vinculo, ativo",
        )
        .eq("servidor_id", servidorId)
        .order("id", { ascending: true });

      if (vError) throw vError;

      // 3) matriculas (se existir)
      const { data: mData, error: mError } = await supabase
        .from("servidor_matriculas")
        .select(
          "id, matricula_raw, matricula_norm, data_inicio, area_nomeacao, nivel",
        )
        .eq("servidor_id", servidorId)
        .order("data_inicio", { ascending: true });

      if (mError) throw mError;

      setServidor(sData ?? null);
      setVinculos(vData ?? []);
      setMatriculas(mData ?? []);
    } catch (err) {
      setError(err);
      setServidor(null);
      setVinculos([]);
      setMatriculas([]);
    } finally {
      setLoading(false);
    }
  }, [servidorId]);

  useEffect(() => {
    load();
  }, [load]);

  return { servidor, vinculos, matriculas, loading, error, reload: load };
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────

export async function buscarGlobal(query) {
  if (!query || query.length < 2)
    return { profs: [], escolas: [], servidores: [] };

  try {
    const [{ data: profs }, { data: escolas }, { data: servidores }] =
      await Promise.all([
        supabase
          .from("professores")
          .select("id, nome, status, nomeacoes(escola:escolas(id, name))")
          .ilike("nome", `%${query}%`)
          .limit(8),
        supabase
          .from("escolas")
          .select("*")
          .ilike("name", `%${query}%`)
          .limit(5),
        supabase
          .from("servidores")
          .select("id, nome")
          .ilike("nome", `%${query}%`)
          .limit(8),
      ]);

    return {
      profs: profs ?? [],
      escolas: escolas ?? [],
      servidores: servidores ?? [],
    };
  } catch (err) {
    // opcional: console.error(err);
    return { profs: [], escolas: [], servidores: [] };
  }
}
