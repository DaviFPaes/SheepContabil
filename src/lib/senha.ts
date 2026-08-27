import bcrypt from "bcryptjs";

const CUSTO_HASH = 10;

export async function hashSenha(senhaPura: string): Promise<string> {
  return bcrypt.hash(senhaPura, CUSTO_HASH);
}

export async function senhaConfere(
  senhaPura: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(senhaPura, hash);
}
