"use client";

// Campo de partículas WebGL para o fundo do login — cores da marca SheepContabil
// sobre o VeuAtmosferico. Adaptado do componente `Particles` (ogl).
//
// O DarkVeil, primeiro fundo WebGL do portal, derrubava a página quando o shader
// falhava no `linkProgram` em alguma GPU; por isso aqui tudo que pode falhar
// (contexto WebGL, compile/link de shader, loop de render) está sob guarda:
//   - sem WebGL  -> não monta nada, o VeuAtmosferico atrás cobre o fundo;
//   - erro no setup ou no frame -> desiste em silêncio, sem derrubar a página;
//   - ErrorBoundary co-locada -> o export default nunca propaga erro de render.
// `prefers-reduced-motion` renderiza um único quadro estático, sem loop.

import { Component, useEffect, useRef, type ReactNode } from "react";
import { Camera, Geometry, Mesh, Program, Renderer } from "ogl";

const CORES_PADRAO = ["#1FA69A", "#10505F", "#EEF3F4"]; // turquesa, petróleo, névoa

function hexParaRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(h.slice(0, 6), 16);
  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  ];
}

function suportaWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;

    vec3 pos = position * uSpread;
    pos.z *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));

    if(uAlphaParticles < 0.5) {
      if(d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`;

type FundoParticulasProps = {
  contagemParticulas?: number;
  dispersao?: number;
  velocidade?: number;
  /** Precisa ser uma referência estável (constante de módulo), não um literal inline. */
  cores?: string[];
  seguirMouse?: boolean;
  fatorMouse?: number;
  particulasAlpha?: boolean;
  tamanhoBase?: number;
  aleatoriedadeTamanho?: number;
  distanciaCamera?: number;
  semRotacao?: boolean;
  pixelRatio?: number;
  className?: string;
};

function FundoParticulas({
  contagemParticulas = 200,
  dispersao = 10,
  velocidade = 0.1,
  cores = CORES_PADRAO,
  seguirMouse = false,
  fatorMouse = 1,
  particulasAlpha = false,
  tamanhoBase = 100,
  aleatoriedadeTamanho = 1,
  distanciaCamera = 20,
  semRotacao = false,
  pixelRatio = 1,
  className,
}: FundoParticulasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !suportaWebGL()) return;

    let renderer: Renderer | undefined;
    let animationFrameId = 0;
    let resize: (() => void) | undefined;
    let handleMouseMove: ((e: MouseEvent) => void) | undefined;

    const removerCanvas = () => {
      const canvas = renderer?.gl.canvas;
      if (canvas && canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };

    try {
      renderer = new Renderer({ dpr: pixelRatio, depth: false, alpha: true });
      const gl = renderer.gl;
      container.appendChild(gl.canvas);
      gl.clearColor(0, 0, 0, 0);

      const camera = new Camera(gl, { fov: 15 });
      camera.position.set(0, 0, distanciaCamera);

      resize = () => {
        if (!renderer) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
      };
      window.addEventListener("resize", resize, false);
      resize();

      if (seguirMouse) {
        handleMouseMove = (e) => {
          const rect = container.getBoundingClientRect();
          mouseRef.current = {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
          };
        };
        container.addEventListener("mousemove", handleMouseMove);
      }

      const count = contagemParticulas;
      const positions = new Float32Array(count * 3);
      const randoms = new Float32Array(count * 4);
      const colors = new Float32Array(count * 3);
      const palette = cores.length > 0 ? cores : CORES_PADRAO;

      for (let i = 0; i < count; i++) {
        let x: number, y: number, z: number, len: number;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          z = Math.random() * 2 - 1;
          len = x * x + y * y + z * z;
        } while (len > 1 || len === 0);
        const r = Math.cbrt(Math.random());
        positions.set([x * r, y * r, z * r], i * 3);
        randoms.set(
          [Math.random(), Math.random(), Math.random(), Math.random()],
          i * 4,
        );
        colors.set(
          hexParaRgb(palette[Math.floor(Math.random() * palette.length)]),
          i * 3,
        );
      }

      const geometry = new Geometry(gl, {
        position: { size: 3, data: positions },
        random: { size: 4, data: randoms },
        color: { size: 3, data: colors },
      });

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
          uSpread: { value: dispersao },
          uBaseSize: { value: tamanhoBase * pixelRatio },
          uSizeRandomness: { value: aleatoriedadeTamanho },
          uAlphaParticles: { value: particulasAlpha ? 1 : 0 },
        },
        transparent: true,
        depthTest: false,
      });

      const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program });

      const menosMovimento =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (menosMovimento) {
        // Um instante fixo só para espalhar as partículas; sem loop.
        program.uniforms.uTime.value = 1.2;
        renderer.render({ scene: particles, camera });
        return () => {
          if (resize) window.removeEventListener("resize", resize);
          if (handleMouseMove) {
            container.removeEventListener("mousemove", handleMouseMove);
          }
          removerCanvas();
        };
      }

      let lastTime = performance.now();
      let elapsed = 0;

      const update = (t: number) => {
        animationFrameId = requestAnimationFrame(update);
        try {
          const delta = t - lastTime;
          lastTime = t;
          elapsed += delta * velocidade;

          program.uniforms.uTime.value = elapsed * 0.001;

          if (seguirMouse) {
            particles.position.x = -mouseRef.current.x * fatorMouse;
            particles.position.y = -mouseRef.current.y * fatorMouse;
          }

          if (!semRotacao) {
            particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
            particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
            particles.rotation.z += 0.01 * velocidade;
          }

          renderer?.render({ scene: particles, camera });
        } catch {
          // Falha no meio do render (contexto perdido, driver): para o loop.
          cancelAnimationFrame(animationFrameId);
        }
      };
      animationFrameId = requestAnimationFrame(update);
    } catch {
      // Falha de WebGL/shader (ex.: linkProgram). Desiste sem derrubar a página.
      cancelAnimationFrame(animationFrameId);
      if (resize) window.removeEventListener("resize", resize);
      if (handleMouseMove) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
      removerCanvas();
      return;
    }

    return () => {
      if (resize) window.removeEventListener("resize", resize);
      if (handleMouseMove) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
      removerCanvas();
      renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    contagemParticulas,
    dispersao,
    velocidade,
    cores,
    seguirMouse,
    fatorMouse,
    particulasAlpha,
    tamanhoBase,
    aleatoriedadeTamanho,
    distanciaCamera,
    semRotacao,
    pixelRatio,
  ]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 opacity-70${
        className ? ` ${className}` : ""
      }`}
    />
  );
}

class LimiteErroSilencioso extends Component<
  { children: ReactNode },
  { falhou: boolean }
> {
  state: { falhou: boolean } = { falhou: false };

  static getDerivedStateFromError(): { falhou: boolean } {
    return { falhou: true };
  }

  render(): ReactNode {
    return this.state.falhou ? null : this.props.children;
  }
}

export default function FundoParticulasSeguro(props: FundoParticulasProps) {
  return (
    <LimiteErroSilencioso>
      <FundoParticulas {...props} />
    </LimiteErroSilencioso>
  );
}
