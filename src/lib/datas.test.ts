import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatarPrazo, prazoParaISO, prazoParaFormulario } from "./datas";

describe("formatarPrazo", () => {
  it("formata o prazo do banco sem deslocar o dia pelo fuso horário", () => {
    assert.equal(formatarPrazo("2026-09-11T00:00:00+00:00"), "11/09/2026");
    assert.equal(formatarPrazo("2026-09-11T00:00:00Z"), "11/09/2026");
    assert.equal(formatarPrazo("2026-09-11"), "11/09/2026");
  });

  it("trata prazos ausentes e datas inválidas", () => {
    assert.equal(formatarPrazo(null), "Sem prazo");
    assert.equal(formatarPrazo(undefined), "Sem prazo");
    assert.equal(formatarPrazo("inválido"), "Prazo inválido");
    assert.equal(formatarPrazo("2026-02-30"), "Prazo inválido");
    assert.equal(formatarPrazo("2026-13-11"), "Prazo inválido");
  });

  it("salva e exibe data e hora de Brasília sem depender do fuso do computador", () => {
    const iso = prazoParaISO("2026-02-14T23:59");
    assert.equal(iso, "2026-02-15T02:59:00.000Z");
    assert.equal(formatarPrazo(iso, true), "14/02/2026 23:59h");
    assert.equal(prazoParaFormulario(iso, true), "2026-02-14T23:59");
    assert.equal(formatarPrazo(prazoParaISO("2026-02-14T00:00"), true), "14/02/2026 00:00h");
  });

  it("preserva prazos antigos e rejeita datas e horas inexistentes", () => {
    assert.equal(prazoParaFormulario("2026-09-11T00:00:00Z", false), "2026-09-11T23:59");
    assert.equal(prazoParaISO(""), null);
    assert.throws(() => prazoParaISO("2026-02-30T10:00"), /válidas/);
    assert.throws(() => prazoParaISO("2026-02-14T24:00"), /válidas/);
    assert.throws(() => prazoParaISO("2026-02-14"), /válidas/);
  });
});
