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

export function useServidorDetalhes(servidorId) {
  const [servidor, setServidor] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tryFetchVinculos = async (id) => {
    // possíveis nomes de coluna usados em bancos diferentes
    const candidatoCols = [
      "servidor_id",
      "servidorid",
      "servidores_id",
      "servidor",
      "servidorId",
    ];
    for (const col of candidatoCols) {
      try {
        // selecionamos tudo para evitar 400 por coluna inexistente
        const { data, error } = await supabase
          .from("servidor_vinculos")
          .select("*")
          .eq(col, id)
          .order("id", { ascending: true })
          .limit(1000);

        if (error) {
          const msg = (error?.message || "").toLowerCase();
          // erro de coluna/relação -> tentar próximo candidato
          if (msg.includes("column") || msg.includes("relation")) {
            continue;
          }
          // outro erro -> propagar
          throw error;
        }

        // sucesso (mesmo que data seja [])
        return { data: data ?? [], usedColumn: col };
      } catch (err) {
        const msg = (err?.message || "").toLowerCase();
        if (msg.includes("column") || msg.includes("relation")) {
          continue;
        }
        throw err;
      }
    }

    // nenhum candidato funcionou
    throw new Error(
      "Nenhuma coluna candidata funcionou para filtrar servidor_vinculos",
    );
  };

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
      // 1) buscar a linha do servidor
      const { data: sData, error: sError } = await supabase
        .from("servidores")
        .select("*")
        .eq("id", servidorId)
        .single();

      if (sError) throw sError;

      // 2) tentar buscar vínculos (com fallback de colunas)
      let vData = [];
      try {
        const res = await tryFetchVinculos(servidorId);
        vData = res.data;
      } catch (vErr) {
        // não quebrar a página — registra e segue com vinculos vazios
        console.warn("Não foi possível buscar servidor_vinculos:", vErr);
      }

      // 3) buscar matriculas (usando select * para evitar erro de coluna inexistente)
      let mData = [];
      try {
        const { data: md, error: mErr } = await supabase
          .from("servidor_matriculas")
          .select("*")
          .eq("servidor_id", servidorId)
          .order("data_inicio", { ascending: true })
          .limit(1000);

        if (mErr) throw mErr;
        mData = md ?? [];
      } catch (mErr) {
        console.warn("Erro ao buscar servidor_matriculas:", mErr);
      }

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
