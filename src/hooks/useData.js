import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SERVIDORES_SELECT = `
  id, nome, nome_norm, status, funcao, tipo_vinculo, cpf,
  matricula, email, telefone, data_nascimento,
  endereco, formacao, formacao_original, funcao_original, dados_fonte, regencia_h, htp_h, hti_h, observacoes,
  lotacoes ( id, escola_id, principal, data_inicio, data_fim, motivo_saida, funcao_original, funcao_categoria, turno_original, area_concurso_original, area_atuacao_categoria, turma_atuacao, vinculo_original, matricula_original, escola:escolas(id, name, tipo) )
`;

const SERVIDORES_SELECT_COMPATIVEL = `
  id, nome, nome_norm, status, funcao, tipo_vinculo,
  matricula, email, telefone, data_nascimento,
  endereco, formacao, regencia_h, htp_h, hti_h, observacoes,
  lotacoes ( escola_id, principal, escola:escolas(id, name, tipo) )
`;

const SERVIDORES_POR_ESCOLA_SELECT = `
  escola_id, principal,
  servidor:servidores (
    id, nome, status, funcao, formacao, formacao_original, funcao_original, tipo_vinculo, cpf, matricula,
    lotacoes ( id, escola_id, principal, data_inicio, data_fim, motivo_saida, funcao_original, funcao_categoria, turno_original, area_concurso_original, area_atuacao_categoria, turma_atuacao, vinculo_original, matricula_original, escola:escolas(id, name, tipo) )
  )
`;

const SERVIDORES_POR_ESCOLA_SELECT_COMPATIVEL = `
  escola_id, principal,
  servidor:servidores (
    id, nome, status, funcao, tipo_vinculo, matricula,
    lotacoes ( escola_id, principal, escola:escolas(id, name, tipo) )
  )
`;

// ─── UTILS ───────────────────────────────────────────────────────────────────

export function normStr(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function hojeISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function mensagemErro(
  error,
  fallback = "Não foi possível concluir a operação.",
) {
  return error?.message || fallback;
}

function comoErro(error, fallback) {
  return error instanceof Error
    ? error
    : new Error(mensagemErro(error, fallback));
}

function textoOpcional(valor) {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

function erroDeSchema(error) {
  const texto = mensagemErro(error).toLowerCase();
  return /column|schema cache|relationship|does not exist|could not find|relação|relacionamento/.test(
    texto,
  );
}

// ─── ESCOLAS ─────────────────────────────────────────────────────────────────

export function useEscolas() {
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: requestError } = await supabase
        .from("escolas")
        .select("*")
        .order("name");
      setEscolas(data ?? []);
      setError(requestError ? mensagemErro(requestError) : "");
    } catch (requestError) {
      setEscolas([]);
      setError(
        mensagemErro(requestError, "Não foi possível carregar as escolas."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { escolas, loading, error, reload: load };
}

// ─── SERVIDORES (lista completa com lotações) ─────────────────────────────────

export function useServidores() {
  const [servidores, setServidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationWarning, setMigrationWarning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMigrationWarning(false);
    try {
      const pageSize = 1000;
      const carregarPaginas = async (selectString) => {
        const acumulado = [];
        let offset = 0;

        while (true) {
          const result = await supabase
            .from("servidores")
            .select(selectString)
            .order("nome")
            .range(offset, offset + pageSize - 1);

          if (result.error) return result;
          acumulado.push(...(result.data ?? []));
          if ((result.data ?? []).length < pageSize) {
            return { data: acumulado, error: null };
          }
          offset += pageSize;
        }
      };

      let result = await carregarPaginas(SERVIDORES_SELECT);

      if (result.error && erroDeSchema(result.error)) {
        result = await carregarPaginas(SERVIDORES_SELECT_COMPATIVEL);
        setMigrationWarning(!result.error);
      }

      if (result.error) console.error("useServidores:", result.error);
      const lista = result.data ?? [];
      setServidores(lista);
      setError(result.error ? mensagemErro(result.error) : "");
      return lista;
    } catch (requestError) {
      setServidores([]);
      setError(
        mensagemErro(requestError, "Não foi possível carregar os servidores."),
      );
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { servidores, loading, error, migrationWarning, reload: load };
}

// ─── SERVIDOR ÚNICO ───────────────────────────────────────────────────────────

export function useServidor(id) {
  const [servidor, setServidor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [migrationWarning, setMigrationWarning] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setServidor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setMigrationWarning(false);
    try {
      let avisoMigracao = false;
      let result = await supabase
        .from("servidores")
        .select(SERVIDORES_SELECT)
        .eq("id", id)
        .single();

      if (result.error && erroDeSchema(result.error)) {
        result = await supabase
          .from("servidores")
          .select(SERVIDORES_SELECT_COMPATIVEL)
          .eq("id", id)
          .single();
        setMigrationWarning(!result.error);
      }

      setServidor(result.data ?? null);
      setError(result.error ? mensagemErro(result.error) : "");
    } catch (requestError) {
      setServidor(null);
      setError(
        mensagemErro(requestError, "Não foi possível carregar o servidor."),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  return { servidor, loading, error, migrationWarning, reload: load };
}

// ─── SERVIDORES POR ESCOLA ────────────────────────────────────────────────────

export function useServidoresByEscola(escolaId, mesAno = null) {
  const [servidores, setServidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationWarning, setMigrationWarning] = useState(false);

  const load = useCallback(async () => {
    if (!escolaId) {
      setServidores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setMigrationWarning(false);

    try {
      let avisoMigracao = false;
      let result = await supabase
        .from("lotacoes")
        .select(SERVIDORES_POR_ESCOLA_SELECT)
        .eq("escola_id", escolaId)
        .is("data_fim", null);

      if (result.error && erroDeSchema(result.error)) {
        result = await supabase
          .from("lotacoes")
          .select(SERVIDORES_POR_ESCOLA_SELECT_COMPATIVEL)
          .eq("escola_id", escolaId)
          .is("data_fim", null);

        avisoMigracao = !result.error;
      }

      const listaAtuais = (result.data ?? [])
        .map((lotacao) => {
          const servidor = Array.isArray(lotacao.servidor)
            ? lotacao.servidor[0]
            : lotacao.servidor;
          return servidor ? { ...servidor, lotacaoAtual: lotacao } : null;
        })
        .filter((servidor) => servidor && servidor.status !== "Inativo");

      let lista = listaAtuais;
      let erroFinal = result.error ? mensagemErro(result.error) : "";

      // Quando uma competência é informada, a lista histórica também inclui
      // servidores que possuem efetividade registrada naquela escola/mês,
      // mesmo que hoje estejam lotados em outra unidade.
      //
      // Sem mesAno, o comportamento permanece exatamente o anterior,
      // preservando o quadro atual para as demais telas.
      if (mesAno && !result.error) {
        const efetividadeResult = await supabase
          .from("efetividade")
          .select("servidor_id")
          .eq("escola_id", escolaId)
          .eq("mes_ano", mesAno);

        if (efetividadeResult.error) {
          erroFinal = [erroFinal, mensagemErro(efetividadeResult.error)]
            .filter(Boolean)
            .join(" ");
        } else {
          const idsAtuais = new Set(listaAtuais.map((servidor) => servidor.id));
          const idsHistoricos = [
            ...new Set(
              (efetividadeResult.data ?? [])
                .map((item) => item.servidor_id)
                .filter(Boolean),
            ),
          ].filter((id) => !idsAtuais.has(id));

          if (idsHistoricos.length) {
            let historicosResult = await supabase
              .from("servidores")
              .select(SERVIDORES_SELECT)
              .in("id", idsHistoricos);

            if (
              historicosResult.error &&
              erroDeSchema(historicosResult.error)
            ) {
              historicosResult = await supabase
                .from("servidores")
                .select(SERVIDORES_SELECT_COMPATIVEL)
                .in("id", idsHistoricos);

              avisoMigracao = avisoMigracao || !historicosResult.error;
            }

            if (historicosResult.error) {
              erroFinal = [erroFinal, mensagemErro(historicosResult.error)]
                .filter(Boolean)
                .join(" ");
            } else {
              const servidoresHistoricos = (historicosResult.data ?? [])
                .filter((servidor) => servidor && servidor.status !== "Inativo")
                .map((servidor) => ({
                  ...servidor,
                  lotacaoAtual: null,
                  lotacaoHistoricaEscolaId: escolaId,
                  lotacaoHistoricaMesAno: mesAno,
                }));

              lista = [...listaAtuais, ...servidoresHistoricos];
            }
          }
        }
      }

      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      setServidores(lista);
      setMigrationWarning(avisoMigracao);
      setError(erroFinal);
    } catch (requestError) {
      setServidores([]);
      setError(
        mensagemErro(
          requestError,
          "Não foi possível carregar o quadro da escola.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [escolaId, mesAno]);

  useEffect(() => {
    load();
  }, [load]);
  return { servidores, loading, error, migrationWarning, reload: load };
}

// ─── EFETIVIDADE ─────────────────────────────────────────────────────────────

export function useEfetividade(escolaId, mesAno) {
  const [efe, setEfe] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ativa = true;
    if (!escolaId || !mesAno) {
      setEfe({});
      setError("");
      return () => {
        ativa = false;
      };
    }

    setEfe({});
    setError("");
    supabase
      .from("efetividade")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("mes_ano", mesAno)
      .then(({ data, error: requestError }) => {
        if (!ativa) return;
        const map = {};
        (data ?? []).forEach((item) => {
          map[item.servidor_id] = item;
        });
        setEfe(map);
        setError(requestError ? mensagemErro(requestError) : "");
      })
      .catch((requestError) => {
        if (!ativa) return;
        setEfe({});
        setError(
          mensagemErro(
            requestError,
            "Não foi possível carregar a efetividade.",
          ),
        );
      });

    return () => {
      ativa = false;
    };
  }, [escolaId, mesAno]);

  async function salvarEfe(
    servidorId,
    status,
    ocorrencia = null,
    observacoes = "",
    diasAusencia = null,
    detalhesOcorrencia = "",
  ) {
    if (!escolaId || !mesAno || !servidorId)
      return { error: new Error("Escola, mês e servidor são obrigatórios.") };
    setSaving(true);
    setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error: requestError } = await supabase
        .from("efetividade")
        .upsert(
          {
            servidor_id: servidorId,
            escola_id: escolaId,
            mes_ano: mesAno,
            status,
            ocorrencia,
            observacoes: String(observacoes ?? "").trim() || null,
            dias_ausencia:
              diasAusencia == null || diasAusencia === ""
                ? null
                : Number(diasAusencia),
            detalhes_ocorrencia:
              String(detalhesOcorrencia ?? "").trim() || null,
            registrado_por: authData?.user?.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "servidor_id,escola_id,mes_ano" },
        )
        .select()
        .single();

      if (requestError) {
        setError(mensagemErro(requestError));
        return { error: requestError };
      }

      setEfe((prev) => ({
        ...prev,
        [servidorId]: data ?? {
          servidor_id: servidorId,
          status,
          ocorrencia,
          observacoes,
          dias_ausencia: diasAusencia,
          detalhes_ocorrencia: detalhesOcorrencia,
        },
      }));
      return { data, error: null };
    } catch (requestError) {
      const normalizedError = comoErro(
        requestError,
        "Não foi possível salvar a efetividade.",
      );
      setError(normalizedError.message);
      return { error: normalizedError };
    } finally {
      setSaving(false);
    }
  }

  return { efe, salvarEfe, saving, error };
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationWarning, setMigrationWarning] = useState(false);

  useEffect(() => {
    let ativa = true;
    async function load() {
      try {
        const [servidoresResult, escolasResult] = await Promise.all([
          supabase
            .from("servidores")
            .select("id, status", { count: "exact" })
            .neq("status", "Inativo"),
          supabase
            .from("escolas")
            .select("*", { count: "exact", head: true })
            .neq("tipo", "SMED"),
        ]);
        let lotacoesResult = await supabase
          .from("lotacoes")
          .select("servidor_id, escola_id")
          .is("data_fim", null);
        let compatibilidade = false;

        if (lotacoesResult.error && erroDeSchema(lotacoesResult.error)) {
          lotacoesResult = await supabase
            .from("lotacoes")
            .select("servidor_id, escola_id");
          compatibilidade = !lotacoesResult.error;
        }
        if (!ativa) return;

        const requestErrors = [
          servidoresResult.error,
          escolasResult.error,
          lotacoesResult.error,
        ].filter(Boolean);
        const servidoresConsiderados = new Set(
          (servidoresResult.data ?? []).map((servidor) => servidor.id),
        );
        const byServ = {};
        (lotacoesResult.data ?? []).forEach((lotacao) => {
          if (!servidoresConsiderados.has(lotacao.servidor_id)) return;
          if (!byServ[lotacao.servidor_id])
            byServ[lotacao.servidor_id] = new Set();
          byServ[lotacao.servidor_id].add(lotacao.escola_id);
        });
        setStats({
          totalServidores: servidoresResult.count ?? 0,
          totalEscolas: escolasResult.count ?? 0,
          duplos: Object.values(byServ).filter((escolas) => escolas.size > 1)
            .length,
        });
        setMigrationWarning(compatibilidade);
        setError(
          requestErrors.length
            ? requestErrors.map((item) => mensagemErro(item)).join(" ")
            : "",
        );
      } catch (requestError) {
        if (!ativa) return;
        setStats(null);
        setError(
          mensagemErro(requestError, "Não foi possível carregar o painel."),
        );
      } finally {
        if (ativa) setLoading(false);
      }
    }
    load();
    return () => {
      ativa = false;
    };
  }, []);

  return { stats, loading, error, migrationWarning };
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────

export async function buscarGlobal(query) {
  if (!query || query.length < 2) return { servidores: [], escolas: [] };
  const palavras = normStr(query)
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 2);
  if (!palavras.length) return { servidores: [], escolas: [] };

  function matchAll(nome) {
    const nomeNormalizado = normStr(nome);
    return palavras.every((palavra) => nomeNormalizado.includes(palavra));
  }

  let servidoresResult = await supabase
    .from("servidores")
    .select(
      `
      id, nome, status, funcao, tipo_vinculo, cpf, matricula,
      email, telefone, data_nascimento, endereco,
      lotacoes ( id, escola_id, principal, data_inicio, data_fim, motivo_saida, escola:escolas(id, name, tipo) )
    `,
    )
    .ilike("nome_norm", `%${palavras[0]}%`)
    .limit(60);

  if (servidoresResult.error && erroDeSchema(servidoresResult.error)) {
    servidoresResult = await supabase
      .from("servidores")
      .select(SERVIDORES_SELECT_COMPATIVEL)
      .ilike("nome", `%${query.trim()}%`)
      .limit(60);
  }

  const escolasResult = await supabase
    .from("escolas")
    .select("*")
    .ilike("name", `%${query.trim()}%`)
    .limit(5);
  const requestErrors = [servidoresResult.error, escolasResult.error].filter(
    Boolean,
  );

  return {
    servidores: (servidoresResult.data ?? [])
      .filter((servidor) => matchAll(servidor.nome))
      .slice(0, 12),
    escolas: escolasResult.data ?? [],
    ...(requestErrors.length
      ? { error: requestErrors.map((item) => mensagemErro(item)).join(" ") }
      : {}),
  };
}

// ─── HISTÓRICO E TRANSFERÊNCIAS ───────────────────────────────────────────────

export async function sincronizarLotacoes(
  servidorId,
  escolaIds = [],
  dataReferencia = hojeISO(),
) {
  try {
    const { data, error } = await supabase.rpc("sincronizar_lotacoes", {
      p_servidor_id: servidorId,
      p_escola_ids: escolaIds.map((id) => Number(id)),
      p_data_referencia: dataReferencia,
    });
    return { data, error };
  } catch (error) {
    return {
      error: comoErro(error, "Não foi possível sincronizar as lotações."),
    };
  }
}

export async function transferirServidorEscola({
  servidorId,
  escolaOrigemId,
  escolaDestinoId,
  dataTransferencia = hojeISO(),
  motivo = null,
}) {
  try {
    const { data, error } = await supabase.rpc("transferir_servidor_escola", {
      p_servidor_id: servidorId,
      p_escola_origem_id: Number(escolaOrigemId),
      p_escola_destino_id: Number(escolaDestinoId),
      p_data_transferencia: dataTransferencia,
      p_motivo: textoOpcional(motivo),
    });
    return { data, error };
  } catch (error) {
    return {
      error: comoErro(error, "Não foi possível realizar a transferência."),
    };
  }
}

export async function adicionarHistoricoLotacao({
  servidorId,
  escolaId,
  dataInicio,
  dataFim,
  motivo = null,
}) {
  try {
    const { data, error } = await supabase.rpc("adicionar_historico_lotacao", {
      p_servidor_id: servidorId,
      p_escola_id: Number(escolaId),
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_motivo: textoOpcional(motivo),
    });
    return { data, error };
  } catch (error) {
    return {
      error: comoErro(error, "Não foi possível adicionar o histórico."),
    };
  }
}

export async function editarHistoricoLotacao({
  lotacaoId,
  dataInicio,
  dataFim,
  motivo = null,
}) {
  try {
    const { data, error } = await supabase.rpc("editar_historico_lotacao", {
      p_lotacao_id: Number(lotacaoId),
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_motivo: textoOpcional(motivo),
    });
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível editar o histórico.") };
  }
}

export async function salvarSolicitacaoTransferencia({
  id,
  servidorId,
  escolaOrigemId,
  escolaDestinoId,
  dataPedido,
  status,
  dataAtendimento = null,
  observacoes = "",
}) {
  const valores = {
    servidor_id: servidorId,
    escola_origem_id: escolaOrigemId ? Number(escolaOrigemId) : null,
    escola_destino_id: Number(escolaDestinoId),
    data_pedido: dataPedido,
    status,
    data_atendimento: dataAtendimento || null,
    observacoes: textoOpcional(observacoes),
  };

  try {
    const consulta = id
      ? supabase
          .from("solicitacoes_transferencia")
          .update(valores)
          .eq("id", id)
          .select()
          .single()
      : supabase
          .from("solicitacoes_transferencia")
          .insert(valores)
          .select()
          .single();
    const { data, error } = await consulta;
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível salvar a solicitação.") };
  }
}

// ─── CATÁLOGOS PARA RELATÓRIOS ────────────────────────────────────────────────

export function useCatalogosRelatorio() {
  const [funcoes, setFuncoes] = useState([]);
  const [formacoes, setFormacoes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [funcoesResult, formacoesResult, areasResult] = await Promise.all([
        supabase
          .from("funcoes_catalogo")
          .select("nome")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("formacoes_catalogo")
          .select("nome")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("areas_atuacao_catalogo")
          .select("nome")
          .eq("ativo", true)
          .order("nome"),
      ]);
      const errors = [
        funcoesResult.error,
        formacoesResult.error,
        areasResult.error,
      ].filter(Boolean);
      setFuncoes(
        (funcoesResult.data ?? []).map((item) => item.nome).filter(Boolean),
      );
      setFormacoes(
        (formacoesResult.data ?? []).map((item) => item.nome).filter(Boolean),
      );
      setAreas(
        (areasResult.data ?? []).map((item) => item.nome).filter(Boolean),
      );
      setError(
        errors.length ? errors.map((item) => mensagemErro(item)).join(" ") : "",
      );
    } catch (requestError) {
      setError(
        mensagemErro(requestError, "Não foi possível carregar os catálogos."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { funcoes, formacoes, areas, loading, error, reload: load };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function criarServidor(
  dados,
  escolaIds = [],
  escolaRestritaId = null,
) {
  try {
    if (escolaRestritaId) {
      const { data, error } = await supabase.rpc("criar_servidor_na_escola", {
        p_escola_id: Number(escolaRestritaId),
        p_dados: {
          nome: dados.nome,
          status: dados.status,
          funcao: dados.funcao,
          tipo_vinculo: dados.tipo_vinculo,
          matricula: dados.matricula,
          email: dados.email,
          telefone: dados.telefone,
          data_nascimento: dados.data_nascimento,
          endereco: dados.endereco,
          formacao: dados.formacao,
          cpf: dados.cpf,
          observacoes: dados.observacoes,
        },
      });
      return { data, error };
    }

    const { data: servidor, error } = await supabase
      .from("servidores")
      .insert({
        nome: dados.nome?.trim(),
        status: dados.status || "Ativo",
        funcao: dados.funcao || null,
        tipo_vinculo: dados.tipo_vinculo || null,
        matricula: dados.matricula?.trim() || null,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        data_nascimento: dados.data_nascimento || null,
        endereco: dados.endereco?.trim() || null,
        formacao: dados.formacao?.trim() || null,
        cpf: dados.cpf?.trim() || null,
        observacoes: dados.observacoes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) return { error };

    if (escolaIds.length) {
      const { error: lotacoesError } = await supabase.from("lotacoes").insert(
        escolaIds.map((escolaId, index) => ({
          servidor_id: servidor.id,
          escola_id: Number(escolaId),
          principal: index === 0,
        })),
      );
      if (lotacoesError) {
        await supabase.from("servidores").delete().eq("id", servidor.id);
        return { error: lotacoesError };
      }
    }

    return { data: servidor, error: null };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível criar o servidor.") };
  }
}

export async function atualizarServidor(id, dados) {
  try {
    const { data, error } = await supabase
      .from("servidores")
      .update({
        nome: dados.nome?.trim(),
        status: dados.status,
        funcao: dados.funcao || null,
        tipo_vinculo: dados.tipo_vinculo || null,
        matricula: dados.matricula?.trim() || null,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        data_nascimento: dados.data_nascimento || null,
        endereco: dados.endereco?.trim() || null,
        formacao: dados.formacao?.trim() || null,
        cpf: dados.cpf?.trim() || null,
        observacoes: dados.observacoes?.trim() || null,
      })
      .eq("id", id)
      .select("id")
      .single();
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível atualizar o servidor.") };
  }
}

export async function atualizarLotacoes(servidorId, escolaIds = []) {
  return sincronizarLotacoes(servidorId, escolaIds);
}

export async function inativarServidor(id) {
  try {
    const { data, error } = await supabase
      .from("servidores")
      .update({ status: "Inativo" })
      .eq("id", id)
      .select("id")
      .single();
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível inativar o servidor.") };
  }
}

export async function reativarServidor(id) {
  try {
    const { data, error } = await supabase
      .from("servidores")
      .update({ status: "Ativo" })
      .eq("id", id)
      .select("id")
      .single();
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível reativar o servidor.") };
  }
}

export async function excluirServidorDefinitivo(id, senha) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.email) {
      return {
        error: new Error("Não foi possível confirmar o usuário atual."),
      };
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: senha,
    });
    if (authError) {
      return {
        error: new Error("Senha inválida. A exclusão não foi realizada."),
      };
    }

    const { data, error } = await supabase.rpc("excluir_servidor_definitivo", {
      p_servidor_id: id,
    });
    return { data, error };
  } catch (error) {
    return { error: comoErro(error, "Não foi possível excluir o servidor.") };
  }
}

// Compatibilidade com telas antigas: a exclusão exige senha e aprovação no banco.
export async function excluirServidor(id, senha) {
  return excluirServidorDefinitivo(id, senha);
}

// ─── SOLICITAÇÕES DE TRANSFERÊNCIA ────────────────────────────────────────────

export function useSolicitacoesTransferencia() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: requestError } = await supabase
        .from("solicitacoes_transferencia")
        .select(
          `
          id, servidor_id, escola_origem_id, escola_destino_id,
          data_pedido, status, data_atendimento, observacoes,
          created_at, updated_at,
          servidor:servidores(id, nome),
          escola_origem:escolas!solicitacoes_transferencia_escola_origem_id_fkey(id, name, tipo),
          escola_destino:escolas!solicitacoes_transferencia_escola_destino_id_fkey(id, name, tipo)
        `,
        )
        .order("data_pedido", { ascending: false });

      if (requestError)
        console.error("useSolicitacoesTransferencia:", requestError);
      setSolicitacoes(data ?? []);
      setError(requestError ? mensagemErro(requestError) : "");
    } catch (requestError) {
      setSolicitacoes([]);
      setError(
        mensagemErro(
          requestError,
          "Não foi possível carregar as solicitações.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { solicitacoes, loading, error, reload: load };
}
