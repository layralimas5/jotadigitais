import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Modo foco: telas de trabalho largas (o quadro de fluxos) pedem a largura toda. O menu lateral encolhe enquanto
 * a tela estiver aberta, sem mudar a preferência guardada, e volta como estava ao sair.
 */
const FocusLayoutContext = createContext<(active: boolean) => void>(() => undefined);

export function FocusLayoutProvider({ onChange, children }: { onChange: (active: boolean) => void; children: ReactNode }) {
  return <FocusLayoutContext.Provider value={onChange}>{children}</FocusLayoutContext.Provider>;
}

export function useFocusLayout(active: boolean) {
  const setFocus = useContext(FocusLayoutContext);
  useEffect(() => {
    setFocus(active);
    return () => setFocus(false);
  }, [active, setFocus]);
}
