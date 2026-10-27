import * as React from "react";

// "vidro" (26/10/2026): tema claro de placas de vidro sobre fundo quente, inspirado no
// "Glassy Dashboard" que o Nickolas mandou. Desde 27/10/2026 é o padrão (pedido do Nickolas),
// inclusive no login; quem escolheu outro tema mantém a escolha.
export type Theme = "light" | "dark" | "vidro";

export const TEMA_PADRAO: Theme = "vidro";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "sisteplan-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(TEMA_PADRAO);

  React.useEffect(() => {
    const stored =
      typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "vidro" ? stored : TEMA_PADRAO;
    applyTheme(initial);
    setThemeState(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("vidro", t === "vidro");
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Roda no <head>, antes da primeira pintura: aplica o tema salvo (ou o padrão) já no HTML, para o
 * login e as telas não piscarem no tema claro enquanto o React carrega.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t!=="light"&&t!=="dark"&&t!=="vidro")t=${JSON.stringify(TEMA_PADRAO)};var c=document.documentElement.classList;c.toggle("dark",t==="dark");c.toggle("vidro",t==="vidro")}catch(e){document.documentElement.classList.add(${JSON.stringify(TEMA_PADRAO)})}})()`;
