import { describe, it } from "vitest";

// Este arquivo e reescrito pela Task 5 do plano de implementacao (ver
// docs/superpowers/plans/2026-09-01-sc-20-vencimento-certificado-etapa-1.md)
// com os testes de integracao de recalcularBucketsCertificados: transicao
// grava bucket + auditoria, idempotencia no mesmo dia, notificacao por
// usuario elegivel, granular/PARCIAL e certificado inativo ignorado. Os
// testes antigos assumiam que AvisoCertificado registrava "faixa mudou" —
// a migracao sc20_kanban_avisos mudou esse model para "marco de e-mail" e
// invalidou o cenario.
describe("recalcularBucketsCertificados", () => {
  it.todo("Task 5: primeiro calculo gera bucket, auditoria e notificacao");
  it.todo("Task 5: segunda execucao no mesmo dia e idempotente");
  it.todo("Task 5: ir para VENCIDO nao gera notificacao");
  it.todo("Task 5: certificado inativo nao e reavaliado");
  it.todo("Task 5: grava um RegistroAuditoria ATUALIZAR_EXECUTADO por execucao");
});
