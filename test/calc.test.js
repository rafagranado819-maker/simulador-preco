import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lucro,
  equilibrio,
  minimo,
  custoMaximo,
  margem,
  triagem,
} from '../js/lib/calc.js';

// Arredonda para 2 casas para comparar com os valores em reais do prompt.
const r2 = (n) => Math.round(n * 100) / 100;

test('Simulador — cenário padrão (custo 23,79)', () => {
  const p = { custo: 23.79, comissao: 0.14, tarifaFixa: 6.75, entrega: 0, folga: 0.2 };
  assert.equal(r2(equilibrio(p)), 35.51);
  assert.equal(r2(minimo(p)), 41.04);
  assert.equal(r2(lucro(24.99, p)), -9.05);
});

test('Simulador — mesmo cenário com custo 20,00', () => {
  const p = { custo: 20.0, comissao: 0.14, tarifaFixa: 6.75, entrega: 0, folga: 0.2 };
  assert.equal(r2(equilibrio(p)), 31.10);
  assert.equal(r2(minimo(p)), 35.76);
});

test('Simulador — Máscara (custo 22,40)', () => {
  const p = { custo: 22.4, comissao: 0.13, tarifaFixa: 7.35, entrega: 0, folga: 0.2 };
  assert.equal(r2(equilibrio(p)), 34.20);
  assert.equal(r2(minimo(p)), 39.34);
  assert.equal(r2(lucro(24.5, p)), -8.43);
});

test('Simulador — modo inverso (Buy Box 24,99)', () => {
  const custoMax = custoMaximo(24.99, {
    comissao: 0.14,
    tarifaFixa: 6.75,
    entrega: 0,
    folga: 0.2,
  });
  assert.equal(r2(custoMax), 12.28);
});

test('Proteção — comissão >= 100% lança erro', () => {
  assert.throws(() => equilibrio({ custo: 10, comissao: 1.0 }), RangeError);
  assert.throws(() => lucro(30, { custo: 10, comissao: 1.2 }), RangeError);
});

test('Proteção — margem com custo 0 lança erro', () => {
  assert.throws(() => margem(30, { custo: 0, comissao: 0.14 }), RangeError);
});

// --- Triagem -------------------------------------------------------------

const taxasML = { comissao: 0.14, tarifaFixa: 6.75, entrega: 0 };

test('Triagem — não é catálogo => reprovado', () => {
  const r = triagem({ catalogo: false, vendas: 20000, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'reprovado');
  assert.equal(r.motivo, 'nao_catalogo');
});

test('Triagem — sem nº de vendas => falta dado', () => {
  const r = triagem({ catalogo: true, vendas: null, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'falta_dado');
});

test('Triagem — abaixo de 500 vendas => reprovado (baixa demanda)', () => {
  const r = triagem({ catalogo: true, vendas: 300, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'reprovado');
  assert.equal(r.motivo, 'baixa_demanda');
});

test('Triagem — margem abaixo do mínimo => reprovado (mesmo com muitas vendas)', () => {
  // Buy Box 24,99, custo 23,79: margem negativa, bem abaixo de 20%.
  const r = triagem({ catalogo: true, vendas: 20000, precoBuyBox: 24.99, custo: 23.79, ...taxasML });
  assert.equal(r.codigo, 'reprovado');
  assert.equal(r.motivo, 'margem');
});

test('Triagem — 10.000+ com boa margem => alta vazão', () => {
  const r = triagem({ catalogo: true, vendas: 12000, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'alta_vazao');
  assert.ok(r.margem >= r.margemMin);
});

test('Triagem — 5.000+ => até 5 unidades', () => {
  const r = triagem({ catalogo: true, vendas: 6000, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'ate_5');
});

test('Triagem — 1.000+ => comprar 1 a 2', () => {
  const r = triagem({ catalogo: true, vendas: 1500, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'ok_1_2');
});

test('Triagem — faixa 500–999 => 1 unidade de teste', () => {
  const r = triagem({ catalogo: true, vendas: 700, precoBuyBox: 60, custo: 20, ...taxasML });
  assert.equal(r.codigo, 'teste_1');
});
