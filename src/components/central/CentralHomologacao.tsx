import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  KanbanSquare,
  Rocket,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { AvisosBanner } from "@/components/dashboard/AvisosBanner";
import { PreviewDialog, type PreviewItem } from "@/components/PreviewDialog";
import { ReceberPacoteDialog } from "@/components/tarefas/ReceberPacoteDialog";
import { FecharRodadaDialog } from "@/components/tarefas/FecharRodadaDialog";
import { TarefaDrawer } from "@/components/tarefas/TarefaDrawer";
import { useTarefasData } from "@/components/tarefas/useTarefasData";
import { normalizeStatus } from "@/components/tarefas/lib/workflow";
import { isRelatorioPendente } from "@/lib/domain/relatorios";
import { useAuth } from "@/lib/auth-context";
import { isAtribuidoA } from "@/lib/domain/atividades";
import {
  avisosAtivosQuery,
  meuProfileQuery,
  relatoriosInativosQuery,
  reunioesQuery,
  solicitacoesRelatoriosQuery,
} from "@/lib/queries/compartilhadas";
import type { TarefaRow } from "@/lib/db-types";
import {
  aguardandoProducao,
  filaPorPessoa,
  mesmoNome,
  naRodada,
  resumirRodada,
  reuniaoDeHoje,
} from "./lib/central";
import { useEntradasPreBuild } from "./useEntradasPreBuild";
import { RodadaPanel } from "./RodadaPanel";
import { DistribuirTestesDialog } from "./DistribuirTestesDialog";
import { DesdeUltimaVisitaPanel } from "./DesdeUltimaVisitaPanel";
import { useMudancas } from "./useMudancas";
import { FilaPorPessoaPanel } from "./FilaPorPessoaPanel";
import { AguardandoProducaoPanel } from "./AguardandoProducaoPanel";
import { MeuDiaPanel } from "./MeuDiaPanel";

/**
 * Central de Homologação: tela inicial do Nexus desde 08/10/2026 (modelo A da análise de uso,
 * com o "Meu dia" do modelo B). Responde a três perguntas: como está a rodada, quem ainda tem
 * teste, e o que espera produção.
 *
 * @param tv Modo TV: só leitura, letras maiores, sem o bloco pessoal.
 */
export function CentralHomologacao({ tv = false }: { tv?: boolean }) {
  const { user } = useAuth();
  const { tarefas, colabs, lotes, isLoading } = useTarefasData();
  const { data: perfil } = useQuery(meuProfileQuery(user?.id));
  const { data: avisos = [] } = useQuery(avisosAtivosQuery());
  const { data: reunioes = [] } = useQuery({ ...reunioesQuery(), enabled: !tv });
  const { data: solicitacoes = [] } = useQuery({ ...solicitacoesRelatoriosQuery(), enabled: !tv });
  const { data: inativos = [] } = useQuery({ ...relatoriosInativosQuery(), enabled: !tv });

  const [drawer, setDrawer] = React.useState<TarefaRow | null>(null);
  const [preview, setPreview] = React.useState<PreviewItem | null>(null);
  const abrir = React.useCallback((t: TarefaRow) => setDrawer(t), []);

  // Mantém a tarefa aberta atualizada quando o realtime traz mudança.
  React.useEffect(() => {
    if (drawer) setDrawer((d) => (d ? (tarefas.find((t) => t.id === d.id) ?? d) : d));
  }, [tarefas]); // eslint-disable-line react-hooks/exhaustive-deps

  const meuColabId = perfil?.colaborador_id ?? null;
  // No Modo TV não há "você": não registra visita nem mostra o que mudou.
  const mudancas = useMudancas(tv ? undefined : user?.id, meuColabId);
  const meuNome = React.useMemo(
    () => colabs.find((c) => c.id === meuColabId)?.nome ?? null,
    [colabs, meuColabId],
  );
  const nomeColab = React.useMemo(
    () => new Map(colabs.map((c) => [c.id, c.nome.split(" ")[0]])),
    [colabs],
  );
  const nomeDe = React.useCallback(
    (t: TarefaRow) => {
      if (t.equipe_toda) return "Equipe toda";
      const ids = (t.responsaveis_ids ?? []).length
        ? (t.responsaveis_ids as string[])
        : t.responsavel_id
          ? [t.responsavel_id]
          : [];
      return ids.map((id) => nomeColab.get(id) ?? "?").join(", ") || "Sem responsável";
    },
    [nomeColab],
  );

  const rodada = React.useMemo(() => naRodada(tarefas), [tarefas]);
  const resumo = React.useMemo(() => resumirRodada(rodada, lotes), [rodada, lotes]);
  const fila = React.useMemo(() => filaPorPessoa(rodada, colabs), [rodada, colabs]);
  const reprovadas = React.useMemo(
    () => rodada.filter((t) => normalizeStatus(t.status) === "reprovado"),
    [rodada],
  );

  const preBuild = React.useMemo(
    () => tarefas.filter((t) => normalizeStatus(t.status) === "pre_build"),
    [tarefas],
  );
  const { data: entradas = {} } = useEntradasPreBuild(preBuild.map((t) => t.id));
  const aguardando = React.useMemo(
    () => aguardandoProducao(preBuild, entradas),
    [preBuild, entradas],
  );

  const meusTestes = React.useMemo(
    () =>
      meuColabId
        ? rodada.filter(
            (t) => normalizeStatus(t.status) === "homologacao" && isAtribuidoA(t, meuColabId),
          )
        : [],
    [rodada, meuColabId],
  );
  const meusRelatorios = React.useMemo(() => {
    const inat = new Set(inativos);
    return solicitacoes.filter(
      (r) => isRelatorioPendente(r, inat) && mesmoNome(r.responsavel, meuNome),
    );
  }, [solicitacoes, inativos, meuNome]);
  const minhasReunioes = React.useMemo(
    () => reunioes.filter((r) => reuniaoDeHoje(r) && isAtribuidoA(r, meuColabId)),
    [reunioes, meuColabId],
  );

  const avisosVigentes = React.useMemo(
    () => avisos.filter((a) => !a.expira_em || new Date(a.expira_em).getTime() > Date.now()),
    [avisos],
  );

  const acoes = tv ? undefined : (
    <div className="flex flex-wrap items-center gap-2">
      <ReceberPacoteDialog />
      <FecharRodadaDialog tarefas={tarefas} colabs={colabs} lotes={lotes} />
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link to="/tarefas">
          <KanbanSquare className="h-4 w-4" />
          Abrir Kanban
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHero
        loading={isLoading}
        eyebrow="Rodada atual"
        title="Central de Homologação"
        description="Receber o pacote, testar e enviar: o andamento da rodada e o que espera produção."
        icon={ClipboardCheck}
        tone="emerald"
        actions={acoes}
        statsGridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        stats={[
          {
            icon: FlaskConical,
            label: "A testar",
            value: resumo.aTestar,
            tone: "sky",
            hint: "Em Homologação",
          },
          {
            icon: CheckCircle2,
            label: "Aprovadas",
            value: resumo.aprovadas,
            tone: "emerald",
            hint: "Prontas para enviar",
          },
          {
            icon: ShieldAlert,
            label: "Com ressalvas",
            value: resumo.ressalvas,
            tone: "amber",
            hint: "Sobem com observação",
          },
          {
            icon: XCircle,
            label: "Reprovadas",
            value: resumo.reprovadas,
            tone: "rose",
            hint: "Aguardam correção",
          },
          {
            icon: Rocket,
            label: "Aguardando produção",
            value: aguardando.length,
            tone: "violet",
            hint: "Em Pré-build",
          },
        ]}
      />

      <AvisosBanner avisos={avisosVigentes} onPreview={setPreview} />

      {mudancas.dados && (
        <DesdeUltimaVisitaPanel
          dados={mudancas.dados}
          onAbrir={(id) => {
            const t = tarefas.find((x) => x.id === id);
            if (t) setDrawer(t);
          }}
          onMarcarVisto={mudancas.marcarVisto}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RodadaPanel
            resumo={resumo}
            reprovadas={reprovadas}
            nomeDe={nomeDe}
            onOpen={abrir}
            tv={tv}
            actions={
              tv ? undefined : (
                <DistribuirTestesDialog
                  aTestar={rodada.filter((t) => normalizeStatus(t.status) === "homologacao")}
                  colabs={colabs}
                />
              )
            }
          />
        </div>
        {tv ? (
          <FilaPorPessoaPanel fila={fila} tv />
        ) : (
          <MeuDiaPanel
            vinculado={!!meuColabId}
            meusTestes={meusTestes}
            meusRelatorios={meusRelatorios}
            minhasReunioes={minhasReunioes}
            onOpen={abrir}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {!tv && <FilaPorPessoaPanel fila={fila} minhaChave={meuColabId} />}
        <div className={tv ? "lg:col-span-2" : undefined}>
          <AguardandoProducaoPanel itens={aguardando} onOpen={abrir} tv={tv} />
        </div>
      </div>

      {!tv && (
        <>
          <TarefaDrawer
            tarefa={drawer}
            open={!!drawer}
            onOpenChange={(v) => !v && setDrawer(null)}
            colabs={colabs}
          />
          <PreviewDialog
            item={preview}
            open={!!preview}
            onOpenChange={(v) => !v && setPreview(null)}
          />
        </>
      )}
    </div>
  );
}
