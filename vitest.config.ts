import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
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
