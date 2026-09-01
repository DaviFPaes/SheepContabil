// Fundo atmosférico da identidade SheepContabil, 100% CSS + SVG — substitui o
// antigo DarkVeil (WebGL/ogl), que derrubava a página quando o shader falhava
// no `linkProgram` em alguma GPU. Mesmo clima: base tinta, brilho petróleo →
// turquesa que "respira", grão sutil e vinheta leve. Sem canvas, sem
// dependência, não quebra. Usado na home e no login.

// Grão em SVG tileável (120px), embutido como data-URI — sem asset externo,
// sem filtro WebGL.
const GRAO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function VeuAtmosferico() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-tinta"
    >
      {/* Campos de cor que ADICIONAM luz sobre o tinta (screen): aurora
          petróleo no topo, foco turquesa num canto, petróleo voltando embaixo. */}
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -20%, rgba(16,80,95,0.85), transparent 60%)," +
            "radial-gradient(80% 70% at 88% 2%, rgba(31,166,154,0.42), transparent 55%)," +
            "radial-gradient(90% 90% at 4% 108%, rgba(16,80,95,0.6), transparent 62%)",
        }}
      />

      {/* Duas manchas que derivam devagar — o "respiro" que o DarkVeil dava. */}
      <div
        className="animate-deriva-veu absolute inset-[-30%] opacity-90 mix-blend-screen"
        style={{
          background:
            "radial-gradient(35% 45% at 28% 24%, rgba(31,166,154,0.33), transparent 70%)," +
            "radial-gradient(40% 50% at 78% 64%, rgba(16,80,95,0.4), transparent 72%)",
        }}
      />

      {/* Feixe diagonal sutil. */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background:
            "linear-gradient(115deg, transparent 32%, rgba(31,166,154,0.14) 49%, transparent 63%)",
        }}
      />

      {/* Grão. */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
        style={{ backgroundImage: GRAO, backgroundRepeat: "repeat" }}
      />

      {/* Vinheta leve — fecha só as bordas extremas, sem matar o brilho. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 28%, transparent 55%, rgba(11,26,32,0.55) 88%, rgba(11,26,32,0.82) 100%)",
        }}
      />
    </div>
  );
}
