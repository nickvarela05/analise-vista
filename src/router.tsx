import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { ErrorFallback } from "./components/ErrorFallback";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache padrão: dados frescos por 1 min, coletados após 5 min.
        // Refetch periódico foi removido do default para reduzir carga no
        // Supabase e evitar re-renders no meio de formulários. Ative
        // `refetchInterval` explicitamente apenas nas queries que precisam
        // (ex.: notificações, jobs em background do dashboard).
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: ({ error, reset }) => (
      <ErrorFallback error={error} reset={reset} />
    ),
  });

  return router;
};
