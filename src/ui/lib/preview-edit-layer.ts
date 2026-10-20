import { EDIT_ATTRIBUTE, sendToEditor } from "./site-preview";

const SELECTED_ATTRIBUTE = "data-edit-selected";
const STYLE_ID = "jota-edit-layer";

/** Contorno de "dá para editar" ao passar o mouse e de "editando agora" no elemento escolhido. */
const EDIT_LAYER_CSS = `
[${EDIT_ATTRIBUTE}] { cursor: pointer; outline: 2px dashed transparent; outline-offset: 4px; border-radius: 6px; transition: outline-color .15s, background-color .15s; }
[${EDIT_ATTRIBUTE}]:hover { outline-color: rgb(39 153 255 / .9); background-color: rgb(39 153 255 / .08); }
[${EDIT_ATTRIBUTE}][${SELECTED_ATTRIBUTE}] { outline: 2px solid rgb(255 102 196); background-color: rgb(255 102 196 / .08); }
@media (prefers-reduced-motion: reduce) { [${EDIT_ATTRIBUTE}] { transition: none; } }
`;

const selector = (path: string) => `[${EDIT_ATTRIBUTE}="${CSS.escape(path)}"]`;

/** Espaço do cabeçalho fixo do site ao rolar até o começo de uma seção. */
const HEADER_OFFSET_PX = 80;

/**
 * Rola só a janela do site. `scrollIntoView` dentro do iframe também rolaria as caixas do painel em volta,
 * deslocando a prévia.
 */
export function scrollWithinPage(element: Element, block: "start" | "center") {
  const rect = element.getBoundingClientRect();
  const offset = block === "center" ? Math.max((window.innerHeight - rect.height) / 2, 0) : HEADER_OFFSET_PX;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: reduceMotion ? "auto" : "smooth" });
}

function isOutOfView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom < 0 || rect.top > window.innerHeight;
}

const REVEAL_DELAY_MS = 350;

/** Resposta de pergunta fica dentro do acordeão fechado: abre a pergunta. Diz se abriu. */
function revealCollapsed(path: string): boolean {
  if (!path.endsWith(".answer")) return false;
  const question = document.querySelector(selector(path.replace(/answer$/, "question")));
  const toggle = question?.closest("button");
  if (!toggle || toggle.getAttribute("aria-expanded") === "true") return false;
  toggle.click();
  return true;
}

/** Marca o elemento do campo focado no editor e traz para a tela se estiver fora dela. */
export function highlightEditable(path: string | null) {
  document.querySelectorAll(`[${SELECTED_ATTRIBUTE}]`).forEach((element) => element.removeAttribute(SELECTED_ATTRIBUTE));
  if (!path) return;
  const element = document.querySelector(selector(path));
  if (!element) {
    // A resposta aparece depois que o acordeão termina de abrir.
    if (revealCollapsed(path)) window.setTimeout(() => highlightEditable(path), REVEAL_DELAY_MS);
    return;
  }
  element.setAttribute(SELECTED_ATTRIBUTE, "");
  if (isOutOfView(element)) scrollWithinPage(element, "center");
}

/**
 * Liga a prévia ao editor: clique num elemento marcado abre o campo dele no painel.
 * Links não navegam (a prévia fica na página que está sendo editada); botões sem marcação, como abrir uma pergunta, continuam funcionando.
 */
export function installEditLayer(): () => void {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = EDIT_LAYER_CSS;
    document.head.append(style);
  }

  const onClick = (event: MouseEvent) => {
    // Cliques feitos pelo próprio código (abrir uma pergunta) passam direto.
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target.closest(`[${EDIT_ATTRIBUTE}]`);
    const path = target?.getAttribute(EDIT_ATTRIBUTE);
    if (path) {
      event.preventDefault();
      event.stopPropagation();
      highlightEditable(path);
      sendToEditor({ type: "edit", path });
      return;
    }
    if (event.target.closest("a[href]")) event.preventDefault();
  };

  document.addEventListener("click", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.getElementById(STYLE_ID)?.remove();
  };
}
