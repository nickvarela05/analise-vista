const ALLOWED_ORIGIN_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
];
const ALLOWED_ORIGIN_EXACT = new Set<string>([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
]);

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const ok =
    ALLOWED_ORIGIN_EXACT.has(origin) ||
    ALLOWED_ORIGIN_SUFFIXES.some((s) => origin.endsWith(s));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
