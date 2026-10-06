import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit2,
  Eye,
  Filter,
  Info,
  RefreshCw,
  Search,
  School,
  Users,
  X,
  Archive,
  GitBranch,
  Clock3,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";
import { classificarFuncao, normalizar } from "../lib/semantic";

const TURMA_RE =
  /(^|\s)(?:pre|bercario|maternal)\s*[a-z0-9]|\b[1-9](?:º|o|°)?\s*ano\b|\bturma\b|\bmultisseriada\b|\b(?:b1|b2|b3|bia|bib|biia|biib|biiia|biiib|biiic)\b/i;
const HORARIO_RE =
  /\b\d{1,2}(?::\d{2})?\s*(?:h|hs)?\s*(?:às|a)\s*\d{1,2}(?::\d{2})?/i;
const ATELIE_RE =
  /\bateli[êe]\b|\batelie\b|\bcomponentes curriculares integrados\b/i;
const AREA_RE = /\b(?:área|area)\s*(?:i|ii|1|2)\b/i;
const DISCIPLINA_RE =
  /\b(?:matemática|matematica|língua portuguesa|lingua portuguesa|língua inglesa|lingua inglesa|história|historia|geografia|ciências|ciencias|educação física|educacao fisica|artes?|ensino religioso)\b/i;
const LONG_NON_FUNCTION_RE =
  /@|\b(?:rua|bairro|cpf|telefone|gmail|contrato início|contratoinicio)\b/i;

function normalizado(value = "") {
  return normalizar(value);
}

function escolaNomes(servidor) {
  const nomes = (servidor?.lotacoes ?? [])
    .filter((l) => !l?.data_fim)
    .map((l) => l?.escola?.name)
    .filter(Boolean);
  return [...new Set(nomes)];
}

// Matrículas podem aparecer sozinhas ou várias dentro do mesmo campo importado.
// Ex.: "00499684/1 (2015) e 04964306/1 (2024)" deve resultar em 2 matrículas.
const MATRICULA_TOKEN_RE = /(?<!\d)(\d{4,8}(?:[-.]\d{1,2})?\/\d{1,2})(?!\d)/g;

function extrairMatriculas(texto = "") {
  const valor = String(texto ?? "").trim();
  if (!valor) return [];

  const encontradas = [];
  const visto = new Set();
  let match;
  while ((match = MATRICULA_TOKEN_RE.exec(valor)) !== null) {
    const token = match[1].trim();
    const chave = matriculaChave(token);
    if (!chave || visto.has(chave)) continue;
    visto.add(chave);
    encontradas.push({ chave, texto: token });
  }
  MATRICULA_TOKEN_RE.lastIndex = 0;
  return encontradas;
}

function tokenizarFonteDeMatriculas(valor = "") {
  const texto = String(valor ?? "").trim();
  if (!texto) return [];

  const tokens = extrairMatriculas(texto);
  if (tokens.length > 0) return tokens;

  // Fallback conservador: só trata o valor inteiro como matrícula quando ele
  // tem formato compatível e não parece ser data, horário ou texto livre.
  const limpo = texto.replace(/\s+/g, " ");
  const chave = matriculaChave(limpo);
  if (!chave) return [];
  if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(limpo)) return [];
  if (/^\d{1,2}:\d{2}/.test(limpo)) return [];
  if (/^\d{4}$/.test(limpo)) return [];
  return [{ chave, texto: limpo }];
}

function matriculaChave(value = "") {
  const texto = String(value ?? "").trim();
  if (!texto) return "";

  // Normaliza formatos equivalentes de uma mesma matrícula.
  // Ex.: 00499684/1 e 49968-4/1 -> 499684/1.
  const match = texto.match(/^(.*?)(?:\/)(\d{1,2})$/);
  if (match) {
    const corpo = match[1].replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const sufixo = match[2];
    if (corpo) return `${corpo}/${sufixo}`;
  }

  const numeros = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return numeros || normalizado(texto).replace(/[^a-z0-9]/gi, "");
}

function matriculasDoServidor(servidor) {
  const fontes = [
    servidor?.matricula,
    ...(servidor?.lotacoes ?? []).map((l) => l?.matricula_original),
  ];
  const mapa = new Map();
  fontes.forEach((valor) => {
    tokenizarFonteDeMatriculas(valor).forEach(({ chave, texto }) => {
      if (!mapa.has(chave)) mapa.set(chave, texto);
    });
  });
  return [...mapa.entries()].map(([chave, texto]) => ({ chave, texto }));
}

function registrosPorMatricula(servidor) {
  const mapa = new Map();
  (servidor?.lotacoes ?? []).forEach((l) => {
    tokenizarFonteDeMatriculas(l?.matricula_original).forEach(({ chave }) => {
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(l);
    });
  });
  return mapa;
}

function escolasPorMatricula(servidor) {
  const mapa = new Map();
  (servidor?.lotacoes ?? []).forEach((l) => {
    const escola = l?.escola?.name;
    if (!escola) return;
    tokenizarFonteDeMatriculas(l?.matricula_original).forEach(({ chave }) => {
      if (!mapa.has(chave)) mapa.set(chave, new Set());
      mapa.get(chave).add(escola);
    });
  });
  return mapa;
}

function motivosFuncao(funcao) {
  const norm = normalizado(funcao);
  const motivos = [];
  if (TURMA_RE.test(norm)) motivos.push("turma");
  if (HORARIO_RE.test(norm)) motivos.push("horário");
  if (ATELIE_RE.test(norm)) motivos.push("atividade/ateliê");
  if (AREA_RE.test(norm)) motivos.push("Área I/II");
  if (DISCIPLINA_RE.test(norm)) motivos.push("disciplina/área");
  if (LONG_NON_FUNCTION_RE.test(norm)) motivos.push("dados de outro campo");
  return motivos;
}

function analisarServidor(servidor) {
  const funcao = String(servidor?.funcao ?? "").trim();
  const funcaoOriginal = String(servidor?.funcao_original ?? "").trim();
  const formacao = String(servidor?.formacao ?? "").trim();
  const fontes = [funcao, funcaoOriginal].filter(Boolean).join(" | ");
  const motivos = motivosFuncao(fontes);
  const classificacao = classificarFuncao(servidor);
  const problemas = [];
  const informativos = [];
  const matriculas = matriculasDoServidor(servidor);
  const escolasMatricula = escolasPorMatricula(servidor);
  const lotacoesAtivas = (servidor?.lotacoes ?? []).filter((l) => !l?.data_fim);

  if (!funcao && !funcaoOriginal) {
    problemas.push({
      tipo: "Sem função",
      severidade: "alta",
      detalhe:
        "A função não foi informada. Esta é uma correção prioritária porque impede uma classificação administrativa confiável.",
    });
  }

  if (fontes && motivos.length > 0) {
    problemas.push({
      tipo: "Função possivelmente preenchida em campo incorreto",
      severidade: "alta",
      detalhe: `O valor informado parece conter ${motivos.join(", ")} em vez de apenas uma função.`,
      evidencia: fontes,
    });
  }

  if (!formacao) {
    informativos.push({
      tipo: "Formação profissional não informada",
      severidade: "informativa",
      detalhe:
        "Isto não é considerado erro por si só. Muitos cargos podem não exigir uma formação profissional específica. O cadastro pode ser completado posteriormente.",
    });
  }

  if (matriculas.length >= 2) {
    problemas.push({
      tipo: "Mais de uma matrícula encontrada",
      severidade: "alta",
      detalhe: `Foram encontradas ${matriculas.length} matrículas distintas nas fontes importadas. Isso pode representar vínculos independentes, composição de carga, convocação ou registro desatualizado; é necessária validação humana.`,
      evidencia: matriculas.map((m) => m.texto).join(" | "),
    });
  }

  const matriculasEmMultiplasEscolas = [...escolasMatricula.entries()].filter(
    ([, escolas]) => escolas.size >= 2,
  );
  if (matriculasEmMultiplasEscolas.length > 0) {
    informativos.push({
      tipo: "Mesma matrícula encontrada em mais de uma escola",
      severidade: "informativa",
      detalhe:
        "A mesma matrícula aparece associada a mais de uma escola nos dados importados. Isso não é necessariamente erro, mas merece conferência quando houver dúvida sobre a lotação vigente.",
      evidencia: matriculasEmMultiplasEscolas
        .map(([chave, escolas]) => {
          const rotulo =
            matriculas.find((m) => m.chave === chave)?.texto || chave;
          return `${rotulo}: ${[...escolas].join(" · ")}`;
        })
        .join(" | "),
    });
  }

  if (
    matriculas.length === 1 &&
    lotacoesAtivas.length >= 2 &&
    new Set(lotacoesAtivas.map((l) => l?.escola_id).filter(Boolean)).size >= 2
  ) {
    informativos.push({
      tipo: "Uma matrícula em múltiplas escolas",
      severidade: "informativa",
      detalhe:
        "Há uma única matrícula identificada, mas ela aparece em mais de uma escola nas lotações ativas. Pode ser legítimo; confirme a situação funcional e a lotação vigente.",
      evidencia: lotacoesAtivas
        .map((l) => l?.escola?.name)
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (
    classificacao === "Professor" &&
    (!normalizado(fontes) ||
      !/professor|professora|docent/i.test(normalizado(fontes)))
  ) {
    informativos.push({
      tipo: "Classificação sugerida: Professor",
      severidade: "informativa",
      detalhe:
        "O sistema encontrou indícios de docência em turma, área ou formação. Confirme antes de transformar a sugestão em dado oficial.",
    });
  }

  if (
    classificacao === "Atendente de Creche" &&
    !/atendente|cuidador|auxiliar de desenvolvimento infantil|auxiliar maternal/i.test(
      normalizado(fontes),
    )
  ) {
    informativos.push({
      tipo: "Classificação sugerida: Atendente de Creche",
      severidade: "informativa",
      detalhe:
        "O sistema encontrou indícios de atuação como atendente/apoio infantil. Confirme antes de transformar a sugestão em dado oficial.",
    });
  }

  return {
    servidor,
    classificacao,
    escolas: escolaNomes(servidor),
    matriculas,
    registrosPorMatricula: registrosPorMatricula(servidor),
    problemas,
    informativos,
    prioridade: problemas.some((p) => p.severidade === "alta") ? "alta" : "ok",
  };
}

function prioridadeLabel(prioridade) {
  if (prioridade === "alta")
    return {
      label: "Corrigir / revisar",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  return {
    label: "Sem correção apontada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function formatarLote(lotacao) {
  const partes = [
    lotacao?.escola?.name,
    lotacao?.funcao_original,
    lotacao?.turno_original,
    lotacao?.vinculo_original,
  ].filter(Boolean);
  return partes.join(" · ");
}

function decisaoConfig(decisao) {
  const configs = {
    vinculo: {
      label: "Confirmar como vínculo",
      descricao:
        "A matrícula selecionada corresponde a um vínculo funcional a validar posteriormente.",
      icon: UserCheck,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    convocacao: {
      label: "Vínculo + convocação/composição",
      descricao:
        "A situação parece combinar vínculo funcional com convocação ou composição de carga.",
      icon: GitBranch,
      className: "border-violet-200 bg-violet-50 text-violet-800",
    },
    desatualizada: {
      label: "Marcar ocorrência desatualizada",
      descricao:
        "A ocorrência selecionada parece pertencer a um quadro antigo ou não refletir a situação atual.",
      icon: Archive,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    pendente: {
      label: "Manter para análise",
      descricao:
        "Ainda não há informação suficiente para decidir. O caso continua pendente.",
      icon: Clock3,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    },
  };
  return configs[decisao];
}

function RevisarVinculosModal({ item, onClose, onRegistrar }) {
  const [selecionadas, setSelecionadas] = useState(() =>
    item.matriculas.map((m) => m.chave),
  );
  const [decisao, setDecisao] = useState("pendente");
  const [observacao, setObservacao] = useState("");

  const toggleMatricula = (chave) => {
    setSelecionadas((prev) =>
      prev.includes(chave)
        ? prev.filter((itemChave) => itemChave !== chave)
        : [...prev, chave],
    );
  };

  const config = decisaoConfig(decisao);
  const ConfigIcon = config.icon;

  function registrar() {
    onRegistrar({
      servidorId: item.servidor.id,
      decisao,
      matriculas: selecionadas,
      observacao: observacao.trim(),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center border w-9 h-9 rounded-xl bg-amber-50 border-amber-100">
                <ClipboardCheck size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Revisar vínculos
                </h2>
                <p className="text-xs text-slate-400">
                  Validação preliminar de {item.servidor.nome}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-145px)] px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="p-4 border lg:col-span-2 bg-slate-50 rounded-2xl border-slate-200">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white border rounded-xl border-slate-200 shrink-0">
                  <Users size={17} className="text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {item.servidor.nome}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.servidor.status || "Sem status"} ·{" "}
                    {item.classificacao || "Sem classificação"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.escolas.join(" · ") || "Sem escola informada"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border bg-amber-50 rounded-2xl border-amber-200">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">
                Achado principal
              </div>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                {item.matriculas.length} matrículas distintas
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Formatações equivalentes da mesma matrícula são agrupadas. A
                decisão permanece humana.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  Matrículas encontradas
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  As matrículas são agrupadas por uma chave normalizada;
                  registros de escolas diferentes permanecem como evidências da
                  mesma matrícula.
                </p>
              </div>
              <button
                onClick={() =>
                  setSelecionadas(item.matriculas.map((m) => m.chave))
                }
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Selecionar todas
              </button>
            </div>

            <div className="space-y-2">
              {item.matriculas.map((matricula) => {
                const checked = selecionadas.includes(matricula.chave);
                const registros =
                  item.registrosPorMatricula.get(matricula.chave) || [];
                return (
                  <label
                    key={matricula.chave}
                    className={`block rounded-2xl border p-3 cursor-pointer transition-colors ${checked ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMatricula(matricula.chave)}
                        className="w-4 h-4 mt-1 accent-slate-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {matricula.texto}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                            chave {matricula.chave}
                          </span>
                        </div>
                        {registros.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {registros.length > 1 && (
                              <div className="text-[11px] font-medium text-amber-800">
                                {registros.length} ocorrências encontradas nas
                                fontes
                              </div>
                            )}
                            {registros.map((registro, index) => (
                              <div
                                key={`${matricula.chave}-${registro.id ?? index}`}
                                className="px-3 py-2 text-xs border rounded-xl bg-white/80 border-slate-100 text-slate-600"
                              >
                                {formatarLote(registro) ||
                                  "Registro de lotação sem detalhes adicionais"}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            Matrícula encontrada no cadastro principal, sem
                            lotação detalhada associada.
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Resultado preliminar da revisão
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Esta etapa não grava vínculos no banco. Ela apenas registra a
              decisão localmente nesta sessão.
            </p>
            <div className="grid grid-cols-1 gap-2 mt-3 md:grid-cols-2">
              {Object.entries({
                vinculo: "Confirmar como vínculo",
                convocacao: "Vínculo + convocação/composição",
                desatualizada: "Marcar ocorrência desatualizada",
                pendente: "Manter para análise",
              }).map(([valor, label]) => {
                const c = decisaoConfig(valor);
                const Icon = c.icon;
                const ativo = decisao === valor;
                return (
                  <button
                    key={valor}
                    onClick={() => setDecisao(valor)}
                    className={`text-left rounded-2xl border p-3 transition-all ${ativo ? `${c.className} ring-2 ring-offset-1 ring-slate-200` : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-[11px] opacity-80 mt-1">
                          {c.descricao}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Observação da revisão
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Ex.: quadro antigo da escola anterior; atualmente possui dois vínculos em exercício..."
              className="w-full px-3 py-3 mt-2 text-sm border outline-none resize-none rounded-2xl border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex items-start gap-2 p-3 text-xs border rounded-2xl border-sky-100 bg-sky-50 text-sky-900">
            <Info size={15} className="mt-0.5 shrink-0 text-sky-600" />
            <span>
              A decisão ficará apenas nesta sessão de validação. Nenhum registro
              de <strong>vinculos_funcionais</strong>,{" "}
              <strong>convocacoes</strong> ou{" "}
              <strong>composicoes_funcionais</strong> será criado ou alterado
              nesta etapa.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-500">
            {selecionadas.length} matrícula(s) selecionada(s) · {config.label}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={registrar}
              disabled={!selecionadas.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={15} /> Registrar decisão local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RevisaoCadastros({
  servidores = [],
  escolas = [],
  onEditServidor,
  canEdit = false,
  refreshToken = 0,
}) {
  const [busca, setBusca] = useState("");
  const [escolaFiltro, setEscolaFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [escopoFiltro, setEscopoFiltro] = useState("correcoes");
  const [itemEmRevisao, setItemEmRevisao] = useState(null);
  const [decisoesSessao, setDecisoesSessao] = useState({});

  const analisados = useMemo(
    () => servidores.map(analisarServidor),
    [servidores, refreshToken],
  );

  const correcoes = useMemo(
    () => analisados.filter((item) => item.problemas.length > 0),
    [analisados],
  );
  const altas = useMemo(
    () => correcoes.filter((item) => item.prioridade === "alta"),
    [correcoes],
  );
  const semFuncao = useMemo(
    () =>
      correcoes.filter((item) =>
        item.problemas.some((p) => p.tipo === "Sem função"),
      ).length,
    [correcoes],
  );
  const funcaoDeslocada = useMemo(
    () =>
      correcoes.filter((item) =>
        item.problemas.some(
          (p) =>
            p.tipo === "Função possivelmente preenchida em campo incorreto",
        ),
      ).length,
    [correcoes],
  );
  const multiplasMatriculas = useMemo(
    () =>
      correcoes.filter((item) =>
        item.problemas.some(
          (p) => p.tipo === "Mais de uma matrícula encontrada",
        ),
      ).length,
    [correcoes],
  );
  const formacaoNaoInformada = useMemo(
    () =>
      analisados.filter((item) =>
        item.informativos.some(
          (p) => p.tipo === "Formação profissional não informada",
        ),
      ).length,
    [analisados],
  );
  const classificacoesSugeridas = useMemo(
    () =>
      analisados.filter((item) =>
        item.informativos.some((p) =>
          p.tipo.startsWith("Classificação sugerida"),
        ),
      ).length,
    [analisados],
  );

  const filtrados = useMemo(() => {
    const termo = normalizado(busca);
    let base = analisados;
    if (escopoFiltro === "correcoes") base = correcoes;
    if (escopoFiltro === "informativos")
      base = analisados.filter((item) => item.informativos.length > 0);

    return base.filter((item) => {
      if (statusFiltro && String(item.servidor?.status ?? "") !== statusFiltro)
        return false;
      if (
        escolaFiltro &&
        !item.servidor?.lotacoes?.some(
          (l) => !l?.data_fim && String(l?.escola_id) === String(escolaFiltro),
        )
      )
        return false;
      if (
        tipoFiltro &&
        !item.problemas.some((p) => p.tipo === tipoFiltro) &&
        !item.informativos.some((p) => p.tipo === tipoFiltro)
      )
        return false;
      if (!termo) return true;
      const haystack = normalizado(
        [
          item.servidor?.nome,
          item.servidor?.funcao,
          item.servidor?.funcao_original,
          item.servidor?.formacao,
          item.classificacao,
          ...item.escolas,
          ...item.matriculas.map((m) => m.texto),
        ]
          .filter(Boolean)
          .join(" | "),
      );
      return haystack.includes(termo);
    });
  }, [
    analisados,
    correcoes,
    escopoFiltro,
    busca,
    escolaFiltro,
    tipoFiltro,
    statusFiltro,
  ]);

  const tipoOpcoes = useMemo(() => {
    const set = new Set();
    analisados.forEach((item) => {
      item.problemas.forEach((p) => set.add(p.tipo));
      item.informativos.forEach((p) => set.add(p.tipo));
    });
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [analisados]);

  function limpar() {
    setBusca("");
    setEscolaFiltro("");
    setTipoFiltro("");
    setStatusFiltro("");
  }

  function registrarDecisao(decisao) {
    setDecisoesSessao((prev) => ({ ...prev, [decisao.servidorId]: decisao }));
  }

  return (
    <div className="space-y-5" key={refreshToken}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center border w-9 h-9 rounded-xl bg-amber-50 border-amber-100">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Revisão de cadastros
              </h1>
              <p className="text-sm text-slate-400">
                O sistema aponta evidências para revisão; ele não declara que um
                cadastro está errado automaticamente.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Atualizar dados
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="p-4 bg-white border border-slate-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Para corrigir / revisar
            </span>
            <AlertTriangle size={17} className="text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {altas.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Somente problemas acionáveis
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Sem função
            </span>
            <AlertCircle size={17} className="text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {semFuncao}
          </p>
          <p className="mt-1 text-xs text-slate-400">Correção prioritária</p>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Revisar função
            </span>
            <Eye size={17} className="text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {funcaoDeslocada}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Suspeita baseada no conteúdo do campo
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Múltiplas matrículas
            </span>
            <Users size={17} className="text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {multiplasMatriculas}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Validação funcional necessária
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Informação faltante
            </span>
            <Info size={17} className="text-sky-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {formacaoNaoInformada}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Formação profissional não informada — não é erro automático
          </p>
        </div>
      </div>

      {Object.keys(decisoesSessao).length > 0 && (
        <div className="flex items-start gap-2 p-3 text-sm border bg-emerald-50 border-emerald-100 rounded-2xl text-emerald-900">
          <CheckCircle2
            size={16}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
          <div>
            <strong>{Object.keys(decisoesSessao).length}</strong> revisão(ões)
            classificadas nesta sessão.{" "}
            <span className="text-emerald-800">
              Essas marcações ainda não foram gravadas no banco.
            </span>
          </div>
        </div>
      )}

      <div className="p-4 text-sm border bg-sky-50 border-sky-100 rounded-2xl text-sky-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Como interpretar esta tela</p>
            <p className="mt-1 text-xs text-sky-800">
              “Sem função” é uma correção objetiva. “Revisar função” é uma
              suspeita baseada no conteúdo do campo. Já a ausência de formação
              profissional é apenas informativa: ela não significa que o
              servidor esteja irregular. Matrículas com formatos equivalentes
              são agrupadas antes da análise. O sistema também pode sugerir uma
              função, mas a decisão final continua sendo humana.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border border-slate-100 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter size={15} /> Filtros de revisão
          </div>
          <span className="ml-auto text-xs text-slate-400">
            {classificacoesSugeridas} classificação(ões) automática(s)
            sugerida(s)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex items-center gap-2 px-3 py-3 border md:col-span-2 bg-slate-50 border-slate-200 rounded-xl">
            <Search size={15} className="text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, função, formação, matrícula ou escola..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-700"
            />
            {busca && (
              <button onClick={() => setBusca("")}>
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <select
            value={escopoFiltro}
            onChange={(e) => setEscopoFiltro(e.target.value)}
            className="px-3 py-3 text-sm border outline-none bg-slate-50 border-slate-200 rounded-xl text-slate-600"
          >
            <option value="correcoes">Somente correções / suspeitas</option>
            <option value="informativos">
              Informações faltantes / sugestões
            </option>
            <option value="todos">Todos os cadastros</option>
          </select>
          <select
            value={escolaFiltro}
            onChange={(e) => setEscolaFiltro(e.target.value)}
            className="px-3 py-3 text-sm border outline-none bg-slate-50 border-slate-200 rounded-xl text-slate-600"
          >
            <option value="">Todas as escolas</option>
            {escolas
              .filter((e) => e.tipo !== "SMED")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 outline-none"
          >
            <option value="">Todos os tipos</option>
            {tipoOpcoes.map((tipo) => (
              <option key={tipo}>{tipo}</option>
            ))}
          </select>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 outline-none"
          >
            <option value="">Todos os status</option>
            <option>Ativo</option>
            <option>Afastado</option>
            <option>Inativo</option>
          </select>
          {(busca ||
            escolaFiltro ||
            tipoFiltro ||
            statusFiltro ||
            escopoFiltro !== "correcoes") && (
            <button
              onClick={() => {
                limpar();
                setEscopoFiltro("correcoes");
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          <strong className="text-slate-800">{filtrados.length}</strong>{" "}
          cadastro(s) no recorte
        </p>
        <p className="text-xs text-slate-400">
          As sugestões não sobrescrevem os dados originais.
        </p>
      </div>

      {filtrados.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-100 rounded-2xl text-slate-400">
          <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-medium text-slate-600">
            Nenhuma revisão encontrada neste recorte.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((item) => {
            const prioridade = prioridadeLabel(item.prioridade);
            const problemasVisiveis = item.problemas.slice(0, 3);
            const informativosVisiveis = item.informativos.slice(0, 2);
            const temMultiplasMatriculas = item.matriculas.length >= 2;
            const decisao = decisoesSessao[item.servidor.id];
            return (
              <div
                key={item.servidor.id}
                className="p-4 transition-colors bg-white border border-slate-100 rounded-2xl hover:border-slate-200"
              >
                {decisao && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-800">
                    <CheckCircle2 size={13} /> Decisão nesta sessão:{" "}
                    {decisaoConfig(decisao.decisao).label}
                  </div>
                )}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-start flex-1 min-w-0 gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 shrink-0">
                      <Users size={17} className="text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {item.servidor.nome}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${prioridade.className}`}
                        >
                          {prioridade.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <School size={12} />{" "}
                          {item.escolas.join(" · ") || "Sem escola"}
                        </span>
                        <span>• {item.servidor.status || "Sem status"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-[28%] text-sm">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                      Valor informado
                    </div>
                    <div className="mt-1 break-words text-slate-700">
                      {item.servidor.funcao ||
                        item.servidor.funcao_original || (
                          <span className="text-red-500">Não informada</span>
                        )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Classificação sugerida:{" "}
                      <strong className="text-slate-600">
                        {item.classificacao || "Não classificado"}
                      </strong>
                    </div>
                    {item.matriculas?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                          Matrícula(s) encontrada(s)
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.matriculas.map((m) => (
                            <span
                              key={m.chave}
                              className={`inline-flex items-center px-2 py-1 rounded-lg border text-[11px] font-medium ${item.matriculas.length >= 2 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                            >
                              {m.texto}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:w-[34%]">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                      Por que o sistema chamou atenção
                    </div>
                    <div className="mt-1 space-y-2">
                      {problemasVisiveis.map((p) => (
                        <div key={p.tipo} className="text-xs text-slate-600">
                          <div>
                            <span className="font-semibold text-red-700">
                              {p.tipo}:
                            </span>{" "}
                            {p.detalhe}
                          </div>
                          {p.evidencia && (
                            <div className="mt-1 rounded-lg bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-500">
                              Evidência:{" "}
                              <span className="font-medium text-slate-600">
                                {p.evidencia}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {problemasVisiveis.length === 0 &&
                        informativosVisiveis.map((p) => (
                          <div key={p.tipo} className="text-xs text-slate-600">
                            <span className="font-semibold text-sky-700">
                              {p.tipo}:
                            </span>{" "}
                            {p.detalhe}
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 shrink-0">
                    {temMultiplasMatriculas && (
                      <button
                        onClick={() => setItemEmRevisao(item)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                      >
                        <ClipboardCheck size={13} /> Revisar vínculos
                      </button>
                    )}
                    {canEdit && onEditServidor && (
                      <button
                        onClick={() => onEditServidor(item.servidor)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50"
                      >
                        <Edit2 size={13} /> Abrir cadastro
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {itemEmRevisao && (
        <RevisarVinculosModal
          item={itemEmRevisao}
          onClose={() => setItemEmRevisao(null)}
          onRegistrar={registrarDecisao}
        />
      )}
    </div>
  );
}
