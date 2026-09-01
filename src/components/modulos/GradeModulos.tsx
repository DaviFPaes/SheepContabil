"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CartaoModulo } from "./CartaoModulo";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import type { KpiModulo } from "@/lib/home/kpis-modulos";

const RAIO = 260;

type Cartao = { modulo: ModuloCatalogo; kpi: KpiModulo | null };

export function GradeModulos({ cartoes }: { cartoes: Cartao[] }) {
  const gradeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grade = gradeRef.current;
    if (!grade || !window.matchMedia) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    const blob = document.createElement("div");
    blob.className = "grade-modulos__spot";
    document.body.appendChild(blob);

    const cards = () =>
      grade.querySelectorAll<HTMLElement>(".cartao-modulo");

    const aoMover = (evento: PointerEvent) => {
      const sec = grade.getBoundingClientRect();
      const dentro =
        evento.clientX >= sec.left &&
        evento.clientX <= sec.right &&
        evento.clientY >= sec.top &&
        evento.clientY <= sec.bottom;

      if (!dentro) {
        gsap.to(blob, { opacity: 0, duration: 0.3, ease: "power2.out" });
        cards().forEach((c) => c.style.setProperty("--spot", "0"));
        return;
      }

      const perto = RAIO * 0.5;
      const longe = RAIO * 0.75;
      let minDist = Infinity;

      cards().forEach((c) => {
        const r = c.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.max(
          0,
          Math.hypot(evento.clientX - cx, evento.clientY - cy) -
            Math.max(r.width, r.height) / 2,
        );
        minDist = Math.min(minDist, dist);
        let g = 0;
        if (dist <= perto) g = 1;
        else if (dist <= longe) g = (longe - dist) / (longe - perto);
        c.style.setProperty("--spot", g.toFixed(3));
      });

      gsap.to(blob, {
        left: evento.clientX,
        top: evento.clientY,
        duration: 0.12,
        ease: "power2.out",
      });
      const alvo =
        minDist <= perto
          ? 0.4
          : minDist <= longe
            ? ((longe - minDist) / (longe - perto)) * 0.4
            : 0;
      gsap.to(blob, {
        opacity: alvo,
        duration: alvo > 0 ? 0.2 : 0.4,
        ease: "power2.out",
      });
    };

    const aoSairDoc = () => {
      cards().forEach((c) => c.style.setProperty("--spot", "0"));
      gsap.to(blob, { opacity: 0, duration: 0.3, ease: "power2.out" });
    };

    document.addEventListener("pointermove", aoMover);
    document.addEventListener("pointerleave", aoSairDoc);

    return () => {
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerleave", aoSairDoc);
      gsap.killTweensOf(blob);
      blob.remove();
    };
  }, []);

  return (
    <div
      ref={gradeRef}
      className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cartoes.map(({ modulo, kpi }, i) => (
        <CartaoModulo
          key={modulo.codigo}
          modulo={modulo}
          kpi={kpi}
          indice={i}
        />
      ))}
    </div>
  );
}
