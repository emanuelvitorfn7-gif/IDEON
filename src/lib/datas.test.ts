import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatarPrazo } from "./datas";

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
});
