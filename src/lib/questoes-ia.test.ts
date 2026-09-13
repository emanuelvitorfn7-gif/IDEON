import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entradaGeracaoQuestoesSchema,
  validarQuestoesGeradas,
  QuantidadeQuestoesIncorretaError,
} from "./questoes-ia";

const materialId = "00000000-0000-4000-8000-000000000001";
function resposta(quantidade: number) {
  return JSON.stringify({
    questoes: Array.from({ length: quantidade }, (_, indice) => ({
      enunciado: `Qual é o conceito abordado no exemplo ${indice + 1}?`,
      alternativas: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      correta: 0,
      explicacao: "Explicação com base no material fornecido.",
      assunto: "Revisão",
      dificuldade: "Fácil",
    })),
  });
}

describe("quantidade de questões geradas", () => {
  it("aceita a quantidade escolhida, incluindo valores maiores que seis", () => {
    for (const quantidade of [1, 6, 10, 20, 30]) {
      assert.equal(
        entradaGeracaoQuestoesSchema.parse({ materialId, quantidade }).quantidade,
        quantidade,
      );
      assert.equal(validarQuestoesGeradas(resposta(quantidade), quantidade).length, quantidade);
    }
  });

  it("mantém seis como padrão para chamadas sem quantidade", () => {
    assert.equal(entradaGeracaoQuestoesSchema.parse({ materialId }).quantidade, 6);
  });

  it("rejeita quantidades fora do intervalo, fracionárias e de tipo inválido", () => {
    for (const quantidade of [0, -1, 31, 2.5, NaN, Infinity, "10", null]) {
      assert.equal(
        entradaGeracaoQuestoesSchema.safeParse({ materialId, quantidade }).success,
        false,
      );
    }
  });

  it("não aceita uma geração parcial ou maior que a solicitada", () => {
    for (const recebida of [0, 6, 29, 31]) {
      assert.throws(
        () => validarQuestoesGeradas(resposta(recebida), 30),
        QuantidadeQuestoesIncorretaError,
      );
    }
  });

  it("continua rejeitando questões inválidas mesmo com a quantidade correta", () => {
    const invalida = JSON.parse(resposta(1));
    invalida.questoes[0].alternativas = ["Repetida", "Repetida", "Outra", "Última"];
    assert.throws(() => validarQuestoesGeradas(JSON.stringify(invalida), 1));
    assert.throws(() => validarQuestoesGeradas('{"questoes": [', 20));
  });
});
