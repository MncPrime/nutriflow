import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppShoppingSummary, buildWhatsAppUrl } from './whatsapp.js';

test('builds readable WhatsApp summary with official markdown markers', () => {
  const text = buildWhatsAppShoppingSummary({
    sections: [{ title: 'Hortifrúti', items: [{ name: 'Banana', quantity: '1 kg', cost: 8 }], subtotal: 8 }],
    subtotal: 8,
    preparationFee: 12
  });
  assert.match(text, /\*NutriFlow/);
  assert.match(text, /_Subtotal_/);
  assert.match(text, /`1 kg`/);
  assert.match(text, /Taxa de confecção/);
  assert.match(text, /Entrega: A combinar com o produtor/);
  assert.match(text, /\n/);
});

test('encodes line breaks and special characters in wa.me URL', () => {
  const url = buildWhatsAppUrl('Linha 1\nLinha 2');
  assert.match(url, /^https:\/\/wa\.me\/\?text=/);
  assert.match(url, /%0A/);
});
