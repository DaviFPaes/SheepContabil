const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function calcularDigito(numeros: number[], pesos: number[]): number {
  const soma = numeros.reduce(
    (total, numero, indice) => total + numero * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function apenasNumeros(valor: string): string {
  return valor.replace(/\D/g, "");
}

function formatarCnpj(numero: string): string {
  return `${numero.slice(0, 2)}.${numero.slice(2, 5)}.${numero.slice(5, 8)}/${numero.slice(8, 12)}-${numero.slice(12, 14)}`;
}

export function gerarCnpjValido(baseNumerica: string): string {
  const raiz = apenasNumeros(baseNumerica).padStart(8, "0").slice(0, 8);
  const base12 = `${raiz}0001`;
  const digitos = base12.split("").map(Number);

  const primeiroDigito = calcularDigito(digitos, PESOS_PRIMEIRO_DIGITO);
  const segundoDigito = calcularDigito(
    [...digitos, primeiroDigito],
    PESOS_SEGUNDO_DIGITO,
  );

  return formatarCnpj(`${base12}${primeiroDigito}${segundoDigito}`);
}

export function cnpjValido(cnpjFormatado: string): boolean {
  const numero = apenasNumeros(cnpjFormatado);
  if (numero.length !== 14) return false;

  const base12 = numero.slice(0, 12);
  const digitosInformados = numero.slice(12, 14);
  const digitos = base12.split("").map(Number);

  const primeiroDigito = calcularDigito(digitos, PESOS_PRIMEIRO_DIGITO);
  const segundoDigito = calcularDigito(
    [...digitos, primeiroDigito],
    PESOS_SEGUNDO_DIGITO,
  );

  return digitosInformados === `${primeiroDigito}${segundoDigito}`;
}
