import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLevelFromXP, tituloPorNivel } from "./gamificacao";

describe("getLevelFromXP", () => {
  it("centraliza os limites e o progresso", () => {
    assert.deepEqual(
      { ...getLevelFromXP(-10), titulo: undefined, xpNecessario: undefined },
      { nivel: 1, xpAtual: 0, progresso: 0, titulo: undefined, xpNecessario: undefined },
    );
    assert.equal(getLevelFromXP(499).nivel, 1);
    assert.equal(getLevelFromXP(499).xpAtual, 499);
    assert.equal(getLevelFromXP(500).nivel, 2);
  });

  it("aplica os títulos definidos para o MVP", () => {
    assert.equal(tituloPorNivel(1), "Iniciante");
    assert.equal(tituloPorNivel(5), "Aprendiz");
    assert.equal(tituloPorNivel(10), "Explorador");
    assert.equal(tituloPorNivel(20), "Especialista");
    assert.equal(tituloPorNivel(30), "Mestre");
  });
});
