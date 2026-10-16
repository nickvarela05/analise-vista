import { createFileRoute } from "@tanstack/react-router";
import { NexusMark } from "@/components/NexusMark";

/**
 * Política de privacidade pública (sem login). Exigida pelo Google para publicar o app
 * OAuth que conecta a agenda da equipe (16/10/2026).
 */
export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade · Nexus" }] }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed">
        <header className="flex items-center gap-3">
          <NexusMark className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">Política de privacidade</h1>
        </header>

        <p>
          O Nexus é um sistema interno de acompanhamento de trabalho da equipe, de uso restrito a
          quem tem conta criada por um gestor. Esta página descreve o uso de dados do Google pela
          integração com o Google Agenda.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">O que é acessado</h2>
          <p>
            Quando um gestor conecta a conta Google da equipe, o Nexus recebe permissão para ler e
            gerenciar eventos de agenda dessa conta. O uso se limita a criar, atualizar e remover,
            no calendário escolhido nas configurações, eventos que representam reuniões, tarefas,
            demandas e chamados cadastrados no próprio Nexus.
          </p>
          <p>
            O Nexus não lê e-mails, contatos nem arquivos, e não altera eventos que ele mesmo não
            criou.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Como os dados são guardados</h2>
          <p>
            A autorização do Google (token de acesso) fica no banco de dados do Nexus, em uma tabela
            que só o servidor consegue ler. Os dados não são vendidos, compartilhados com terceiros
            nem usados para publicidade.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Como revogar</h2>
          <p>
            A conexão pode ser desfeita a qualquer momento em{" "}
            <a
              className="underline"
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
            >
              myaccount.google.com/permissions
            </a>
            . Depois disso, o Nexus para de sincronizar até que a conta seja conectada de novo.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">Atualizada em 16/10/2026.</p>
      </article>
    </div>
  );
}
