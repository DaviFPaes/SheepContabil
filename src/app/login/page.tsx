import { LogoSheep } from "@/components/LogoSheep";
import { FormularioLogin } from "./FormularioLogin";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tinta px-4">
      <div className="w-full max-w-sm rounded-lg bg-nevoa p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <LogoSheep className="h-10 w-10 text-petroleo" />
          <span className="font-titulo text-xl font-bold text-petroleo">
            Sheep<span className="text-turquesa">Contabil</span>
          </span>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}
