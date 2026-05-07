import { useRouter } from "@tanstack/react-router";
import { ErrorFallback } from "@/components/ErrorFallback";

/**
 * Boundary padrão de rota: re-executa o loader via router.invalidate()
 * antes de chamar o reset() do TanStack Router.
 */
export function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const handleReset = () => {
    router.invalidate();
    reset();
  };
  return <ErrorFallback error={error} reset={handleReset} />;
}
