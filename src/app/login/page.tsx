import { LogoSheep } from "@/components/LogoSheep";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import FundoParticulas from "@/components/FundoParticulas";
import { FormularioLogin } from "./FormularioLogin";

// Referência estável — passar um literal inline remontaria o WebGL a cada render.
const CORES_PARTICULAS = ["#1FA69A", "#10505F", "#EEF3F4"]; // turquesa, petróleo, névoa

export default function PaginaLogin() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <VeuAtmosferico />
      <FundoParticulas
        cores={CORES_PARTICULAS}
        contagemParticulas={160}
        velocidade={0.08}
        tamanhoBase={90}
        seguirMouse
        fatorMouse={0.6}
      />

      <section className="animate-entrada relative z-10 w-full max-w-sm">
        <div className="rounded-2xl border border-white/25 bg-nevoa/80 p-8 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl">
          <div className="mb-7 flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2.5">
              <LogoSheep className="h-11 w-11 text-petroleo" />
              <span className="font-titulo text-2xl font-extrabold tracking-tight text-petroleo">
                Sheep<span className="text-turquesa">Contabil</span>
              </span>
            </div>
            <p className="font-texto text-sm text-grafite">
              Portal de automações contábeis
            </p>
          </div>
          <FormularioLogin />
        </div>
        <p className="mt-5 text-center font-texto text-xs text-nevoa/45">
          Acesso restrito · SheepContabil
        </p>
      </section>
    </main>
  );
}
