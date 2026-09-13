import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validarConteudoMaterial, MAX_CARACTERES_MATERIAL } from "./conteudo-material";

describe("conteúdo enviado à IA", () => {
  it("preserva o material completo, inclusive o conteúdo após 12 mil caracteres", () => {
    const conteudo = "Conteúdo da aula. ".repeat(1000) + "Conclusão da última página.";
    assert.equal(validarConteudoMaterial(conteudo), conteudo);
  });

  it("rejeita conteúdo insuficiente ou excessivo sem truncar silenciosamente", () => {
    assert.throws(() => validarConteudoMaterial(" "), /50 caracteres/);
    assert.equal(validarConteudoMaterial("a".repeat(MAX_CARACTERES_MATERIAL)).length, 100_000);
    assert.throws(
      () => validarConteudoMaterial("a".repeat(MAX_CARACTERES_MATERIAL + 1)),
      /100 mil/,
    );
  });
});
