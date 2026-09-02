"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import "./SpecularButton.css";

type Variante = "primario" | "secundario" | "fantasma";
type Tom = "claro" | "escuro";
type Tamanho = "sm" | "md" | "lg";

const PROXIMIDADE = 260;
const BLEED = 14;

// Um único rastreador de ponteiro para TODOS os SpecularButton da página:
// um listener de pointermove, rects em cache (revalidados no scroll/resize)
// e o trabalho espremido num requestAnimationFrame. Cada botão se registra
// no mount e sai no unmount.
const alvos = new Set<HTMLElement>();
let raf = 0;
const ptr = { x: -1e5, y: -1e5 };

function passo() {
  raf = 0;
  for (const el of alvos) {
    const cache = el as HTMLElement & { __sbRect?: DOMRect | null; __sbOn?: boolean };
    let r = cache.__sbRect;
    if (!r) {
      r = el.getBoundingClientRect();
      cache.__sbRect = r;
    }
    const dx = Math.max(r.left - ptr.x, 0, ptr.x - r.right);
    const dy = Math.max(r.top - ptr.y, 0, ptr.y - r.bottom);
    const t = Math.max(0, 1 - Math.hypot(dx, dy) / PROXIMIDADE);
    if (t <= 0) {
      // Botão longe do cursor: zera uma vez e não toca mais nele.
      if (cache.__sbOn) {
        el.style.setProperty("--sb-glow", "0");
        cache.__sbOn = false;
      }
      continue;
    }
    cache.__sbOn = true;
    el.style.setProperty("--sb-glow", (t * t * (3 - 2 * t)).toFixed(3));
    el.style.setProperty("--sb-mx", `${ptr.x - r.left + BLEED}px`);
    el.style.setProperty("--sb-my", `${ptr.y - r.top + BLEED}px`);
  }
}

function agenda() {
  if (!raf) raf = requestAnimationFrame(passo);
}

function aoMover(e: PointerEvent) {
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  agenda();
}

function invalida() {
  for (const el of alvos) {
    (el as HTMLElement & { __sbRect?: DOMRect | null }).__sbRect = null;
  }
  agenda();
}

function registrar(el: HTMLElement) {
  if (alvos.size === 0) {
    window.addEventListener("pointermove", aoMover, { passive: true });
    window.addEventListener("scroll", invalida, { passive: true, capture: true });
    window.addEventListener("resize", invalida, { passive: true });
  }
  alvos.add(el);
}

function desregistrar(el: HTMLElement) {
  alvos.delete(el);
  el.style.removeProperty("--sb-glow");
  if (alvos.size === 0) {
    window.removeEventListener("pointermove", aoMover);
    window.removeEventListener("scroll", invalida, { capture: true });
    window.removeEventListener("resize", invalida);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
}

export type SpecularButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tom?: Tom;
  tamanho?: Tamanho;
  children: ReactNode;
};

export const SpecularButton = forwardRef<HTMLButtonElement, SpecularButtonProps>(
  function SpecularButton(
    {
      variante = "primario",
      tom = "claro",
      tamanho = "md",
      type = "button",
      className,
      children,
      ...rest
    },
    refExterna,
  ) {
    const interna = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      const el = interna.current;
      if (!el) return;
      const semMovimento =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (semMovimento) return;
      registrar(el);
      return () => desregistrar(el);
    }, []);

    return (
      <button
        ref={(node) => {
          interna.current = node;
          if (typeof refExterna === "function") refExterna(node);
          else if (refExterna) refExterna.current = node;
        }}
        type={type}
        className={`sb sb--${variante} sb--${tom} sb--${tamanho}${className ? ` ${className}` : ""}`}
        {...rest}
      >
        <span className="sb__fx" aria-hidden="true" />
        <span className="sb__label">{children}</span>
      </button>
    );
  },
);
