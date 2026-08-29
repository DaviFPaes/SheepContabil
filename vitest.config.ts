import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Os testes de integracao (execucao/processar/consultas) compartilham um
    // unico Postgres local. Rodar os ARQUIVOS de teste em serie evita a corrida
    // entre workers paralelos que violava a foreign key de AvisoCertificado.
    // Os testes dentro de cada arquivo continuam rapidos.
    fileParallelism: false,
    // So os testes do codigo-fonte. Sem isso, uma copia do repo dentro de
    // .claude/worktrees/ faz o vitest achar cada arquivo de teste duas vezes —
    // e os que falam com o banco passam a falhar de forma intermitente por
    // corrida entre as duas execucoes na mesma base.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
