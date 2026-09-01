"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import type { ModuloCatalogo, NaturezaModulo } from "@/lib/modulos-catalogo";
import { NOMES_NATUREZA } from "@/lib/modulos-catalogo";
import type { KpiModulo, TomKpi } from "@/lib/home/kpis-modulos";
import "./cartao-modulo.css";

const GLOW = "31 166 154"; // turquesa, sem wrapper

const SELO_NATUREZA: Record<NaturezaModulo, string> = {
  AGENTE_IA: "bg-turquesa/12 text-turquesa",
  CONTROLE: "bg-petroleo/10 text-petroleo",
  RPA: "bg-grafite/15 text-grafite",
};

const COR_KPI: Record<TomKpi, string> = {
  atencao: "text-ambar",
  ok: "text-turquesa",
  erro: "text-carmim",
};

function useMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (aoMudar) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const m = window.matchMedia(consulta);
      m.addEventListener("change", aoMudar);
      return () => m.removeEventListener("change", aoMudar);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(consulta).matches
        : false,
    () => false,
  );
}

export function CartaoModulo({
  modulo,
  kpi,
  indice = 0,
}: {
  modulo: ModuloCatalogo;
  kpi: KpiModulo | null;
  indice?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduzirMovimento = useMedia("(prefers-reduced-motion: reduce)");
  const ehMobile = useMedia("(max-width: 767px)");
  const efeitosOff = reduzirMovimento || ehMobile;

  useEffect(() => {
    const el = ref.current;
    const clip = el?.querySelector<HTMLElement>(".cartao-modulo__clip");
    if (!el || !clip || efeitosOff) return;

    const particulas: HTMLElement[] = [];
    let magTween: gsap.core.Tween | null = null;

    const aoEntrar = () => {
      for (let i = 0; i < 8; i++) {
        const p = document.createElement("span");
        p.className = "cartao-modulo__particula";
        const r = el.getBoundingClientRect();
        p.style.left = `${Math.random() * r.width}px`;
        p.style.top = `${Math.random() * r.height}px`;
        clip.appendChild(p);
        particulas.push(p);
        const atraso = i * 0.06;
        gsap.fromTo(
          p,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)", delay: atraso },
        );
        gsap.to(p, {
          x: (Math.random() - 0.5) * 70,
          y: (Math.random() - 0.5) * 70,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: atraso,
        });
        gsap.to(p, {
          opacity: 0.35,
          duration: 1.4,
          ease: "power2.inOut",
          repeat: -1,
          yoyo: true,
          delay: atraso,
        });
      }
    };

    const aoSair = () => {
      particulas.forEach((p) =>
        gsap.to(p, {
          scale: 0,
          opacity: 0,
          duration: 0.3,
          ease: "back.in(1.7)",
          onComplete: () => p.remove(),
        }),
      );
      particulas.length = 0;
      magTween?.kill();
      gsap.to(el, { x: 0, y: 0, duration: 0.4, ease: "power2.out" });
    };

    const aoMover = (evento: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = evento.clientX - r.left;
      const y = evento.clientY - r.top;
      const cx = r.width / 2;
      const cy = r.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
      const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
      const prox = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (ang < 0) ang += 360;

      el.style.setProperty("--prox", prox.toFixed(3));
      el.style.setProperty("--ang", `${ang.toFixed(1)}deg`);

      magTween = gsap.to(el, {
        x: dx * 0.025,
        y: dy * 0.025,
        duration: 0.4,
        ease: "power2.out",
      });
    };

    const aoClicar = (evento: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = evento.clientX - r.left;
      const y = evento.clientY - r.top;
      const raio = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - r.width, y),
        Math.hypot(x, y - r.height),
        Math.hypot(x - r.width, y - r.height),
      );
      const rip = document.createElement("span");
      rip.style.cssText = `position:absolute;width:${raio * 2}px;height:${raio * 2}px;left:${x - raio}px;top:${y - raio}px;border-radius:50%;pointer-events:none;background:radial-gradient(circle, rgb(${GLOW} / 0.26) 0%, rgb(${GLOW} / 0.1) 35%, transparent 70%);`;
      clip.appendChild(rip);
      gsap.fromTo(
        rip,
        { scale: 0, opacity: 1 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          onComplete: () => rip.remove(),
        },
      );
    };

    el.addEventListener("pointerenter", aoEntrar);
    el.addEventListener("pointerleave", aoSair);
    el.addEventListener("pointermove", aoMover);
    el.addEventListener("click", aoClicar);

    return () => {
      el.removeEventListener("pointerenter", aoEntrar);
      el.removeEventListener("pointerleave", aoSair);
      el.removeEventListener("pointermove", aoMover);
      el.removeEventListener("click", aoClicar);
      aoSair();
      gsap.killTweensOf(el);
      el.style.removeProperty("--prox");
      el.style.removeProperty("--ang");
      el.style.removeProperty("--spot");
    };
  }, [efeitosOff]);

  return (
    <Link
      ref={ref}
      href={`/modulos/${modulo.codigo.toLowerCase()}`}
      style={{ animationDelay: `${indice * 80}ms` }}
      className="cartao-modulo group animate-entrada relative flex h-full flex-col rounded-2xl border border-white/12 bg-nevoa/92 p-6 shadow-[0_22px_60px_-28px_rgba(11,26,32,0.75)] backdrop-blur-xl transition-transform duration-300 ease-out hover:-translate-y-1"
    >
      <span className="cartao-modulo__halo" aria-hidden />
      <span className="cartao-modulo__borda" aria-hidden />
      <span className="cartao-modulo__clip" aria-hidden />

      <div className="relative z-[3] flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-codigo text-[13px] font-medium tracking-[0.08em] text-petroleo">
            {modulo.codigo}
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-codigo text-[10px] font-medium uppercase tracking-[0.14em] ${SELO_NATUREZA[modulo.natureza]}`}
          >
            {NOMES_NATUREZA[modulo.natureza]}
          </span>
        </div>

        <h3 className="font-titulo text-[17px] font-bold leading-snug text-tinta">
          {modulo.nome}
        </h3>
        <p className="line-clamp-2 font-texto text-[13px] leading-relaxed text-grafite">
          {modulo.descricao}
        </p>

        {kpi ? (
          <div className="mt-1 flex flex-col gap-1 border-t border-grafite/15 pt-4">
            <span className="flex items-baseline gap-2">
              <span
                className={`font-titulo text-[34px] font-extrabold leading-none tracking-tight tabular-nums ${COR_KPI[kpi.tom]}`}
              >
                {kpi.valor}
              </span>
              <span className="font-texto text-[13px] leading-tight text-grafite">
                {kpi.rotulo}
              </span>
            </span>
            {kpi.detalhe ? (
              <span className="font-codigo text-[11px] tracking-tight text-grafite/75">
                {kpi.detalhe}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-codigo text-[10px] uppercase tracking-[0.16em] text-grafite/70">
            {modulo.setorDono}
          </span>
          <span
            aria-hidden
            className="font-titulo text-lg text-turquesa transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
