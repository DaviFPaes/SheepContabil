import { NATUREZAS } from "@/lib/certificados/historico";

const CAMPO =
  "rounded border border-grafite/40 bg-white px-2.5 py-1.5 font-texto text-sm text-tinta outline-none focus:border-turquesa";
const ROTULO = "flex flex-col gap-1 font-texto text-xs font-medium text-grafite";

export function FiltrosHistorico({
  clientes,
  valores,
}: {
  clientes: { id: string; razaoSocial: string }[];
  valores: { cliente?: string; evento?: string; de?: string; ate?: string };
}) {
  const params = new URLSearchParams();
  params.set("aba", "historico");
  if (valores.cliente) params.set("cliente", valores.cliente);
  if (valores.evento) params.set("evento", valores.evento);
  if (valores.de) params.set("de", valores.de);
  if (valores.ate) params.set("ate", valores.ate);

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-grafite/20 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="aba" value="historico" />

      <label className={ROTULO}>
        Cliente
        <select name="cliente" defaultValue={valores.cliente ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razaoSocial}
            </option>
          ))}
        </select>
      </label>

      <label className={ROTULO}>
        Evento
        <select name="evento" defaultValue={valores.evento ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          {NATUREZAS.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className={ROTULO}>
        De
        <input type="date" name="de" defaultValue={valores.de ?? ""} className={CAMPO} />
      </label>

      <label className={ROTULO}>
        Até
        <input type="date" name="ate" defaultValue={valores.ate ?? ""} className={CAMPO} />
      </label>

      <button
        type="submit"
        className="rounded bg-petroleo px-3 py-1.5 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa motion-reduce:transition-none"
      >
        Filtrar
      </button>
      <a
        href="/modulos/sc-20?aba=historico"
        className="font-texto text-sm text-grafite underline underline-offset-2 hover:text-tinta"
      >
        Limpar
      </a>
      <a
        href={`/modulos/sc-20/historico/relatorio?${params.toString()}`}
        className="ml-auto inline-flex items-center gap-1.5 font-texto text-sm font-medium text-turquesa underline-offset-2 hover:underline"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
        Baixar CSV
      </a>
    </form>
  );
}
