import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { GripVertical, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-lg text-mist transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30";

let keySequence = 0;
const newKey = () => `sortable-${(keySequence += 1)}`;

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Chave estável de cada item: o arraste precisa saber quem é quem enquanto a ordem muda.
 * Se a lista mudar de tamanho por fora (ex.: descartar o rascunho), as chaves recomeçam.
 */
function useItemKeys(count: number) {
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length: count }, newKey));
  const current = keys.length === count ? keys : Array.from({ length: count }, newKey);
  if (current !== keys) setKeys(current);
  return [current, setKeys] as const;
}

interface ItemSlots {
  /** Alça para arrastar (e mover pelo teclado). */
  handle: ReactNode;
  remove: ReactNode;
}

interface SortableListProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  min: number;
  /** "item 3", "pergunta 2": usado nos rótulos para leitor de tela. */
  itemLabel: (index: number) => string;
  className?: string;
  itemClassName?: string;
  renderItem: (item: T, index: number, slots: ItemSlots) => ReactNode;
}

/** Lista que se reordena segurando a alça e arrastando (mouse ou dedo), ou com as setas do teclado na alça. */
export function SortableList<T>({ items, onChange, min, itemLabel, className, itemClassName, renderItem }: SortableListProps<T>) {
  const [keys, setKeys] = useItemKeys(items.length);

  const reorder = (nextKeys: string[]) => {
    setKeys(nextKeys);
    onChange(nextKeys.map((key) => items[keys.indexOf(key)] as T));
  };

  const moveBy = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= items.length) return;
    setKeys(move(keys, index, target));
    onChange(move(items, index, target));
  };

  const remove = (index: number) => {
    setKeys(keys.filter((_, position) => position !== index));
    onChange(items.filter((_, position) => position !== index));
  };

  return (
    <Reorder.Group as="ol" axis="y" values={keys} onReorder={reorder} className={className}>
      {items.map((item, index) => (
        <SortableItem
          key={keys[index]}
          value={keys[index] ?? ""}
          label={itemLabel(index)}
          position={index + 1}
          total={items.length}
          canRemove={items.length > min}
          className={itemClassName}
          onKeyboardMove={(step) => moveBy(index, step)}
          onRemove={() => remove(index)}
        >
          {(slots) => renderItem(item, index, slots)}
        </SortableItem>
      ))}
    </Reorder.Group>
  );
}

interface SortableItemProps {
  value: string;
  label: string;
  position: number;
  total: number;
  canRemove: boolean;
  className?: string;
  onKeyboardMove: (step: -1 | 1) => void;
  onRemove: () => void;
  children: (slots: ItemSlots) => ReactNode;
}

function SortableItem({ value, label, position, total, canRemove, className, onKeyboardMove, onRemove, children }: SortableItemProps) {
  const controls = useDragControls();
  const reduceMotion = useReducedMotion();

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") onKeyboardMove(-1);
    else if (event.key === "ArrowDown") onKeyboardMove(1);
    else return;
    event.preventDefault();
  };

  const handle = (
    <button
      type="button"
      aria-label={`Mudar ${label} de lugar, hoje ${position} de ${total}. Arraste ou use as setas para cima e para baixo.`}
      title="Segure e arraste para mudar de lugar"
      onPointerDown={(event) => {
        event.preventDefault();
        controls.start(event);
      }}
      onKeyDown={onHandleKeyDown}
      // touch-none: no celular o dedo na alça arrasta o item em vez de rolar a página.
      className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );

  const remove = (
    <button type="button" className={cn(iconButton, "hover:text-[#ff9a9a]")} aria-label={`Remover ${label}`} disabled={!canRemove} onClick={onRemove}>
      <Trash2 aria-hidden className="size-4" />
    </button>
  );

  return (
    <Reorder.Item
      as="li"
      value={value}
      dragListener={false}
      dragControls={controls}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
      whileDrag={{ scale: 1.02, zIndex: 40, boxShadow: "0 24px 60px -20px rgb(0 0 0 / 0.9)" }}
      className={cn("relative", className)}
    >
      {children({ handle, remove })}
    </Reorder.Item>
  );
}
