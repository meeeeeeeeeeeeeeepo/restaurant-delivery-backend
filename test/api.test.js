import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import { schema } from '../src/schema.js';

const run = (source, variableValues) => graphql({ schema, source, variableValues });

test('health query', async () => {
  const { data, errors } = await run('{ health { status service } }');
  assert.ifError(errors);
  assert.equal(data.health.status, 'ok');
  assert.equal(data.health.service, 'restaurant-delivery-backend');
});

test('menu returns items', async () => {
  const { data } = await run('{ menu { count items { id name price category } } }');
  assert.ok(data.menu.count > 0);
  assert.ok(data.menu.items.every((i) => i.name && typeof i.price === 'number'));
});

test('menu filters by category enum', async () => {
  const { data } = await run('{ menu(category: PIZZA) { items { category } } }');
  assert.ok(data.menu.items.length > 0);
  assert.ok(data.menu.items.every((i) => i.category === 'PIZZA'));
});

test('placeOrder computes totals and free delivery over threshold', async () => {
  const mutation = `mutation($input: PlaceOrderInput!) {
    placeOrder(input: $input) { status subtotal deliveryFee total items { name qty } }
  }`;
  const { data, errors } = await run(mutation, {
    input: {
      items: [{ id: 'm3', qty: 2 }, { id: 'm6', qty: 1 }],
      customer: { name: 'Ada', address: '1 Infinite Loop', phone: '555-0100' }
    }
  });
  assert.ifError(errors);
  assert.equal(data.placeOrder.subtotal, 37.5);
  assert.equal(data.placeOrder.deliveryFee, 0);
  assert.equal(data.placeOrder.total, 37.5);
  assert.equal(data.placeOrder.status, 'CONFIRMED');
});

test('placeOrder rejects empty order', async () => {
  const mutation = `mutation($input: PlaceOrderInput!) { placeOrder(input: $input) { id } }`;
  const { errors } = await run(mutation, {
    input: { items: [], customer: { name: 'A', address: 'B', phone: 'C' } }
  });
  assert.ok(errors && errors.length > 0);
});
