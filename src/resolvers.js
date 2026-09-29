import { menu, findItem } from './data/menu.js';

const orders = new Map(); // demo in-memory store

export const resolvers = {
  Query: {
    health: () => ({ status: 'ok', service: 'restaurant-delivery-backend', time: new Date().toISOString() }),
    menu: (_p, { category }) => {
      const items = category ? menu.filter((m) => m.category === category) : menu;
      return { count: items.length, items };
    },
    menuItem: (_p, { id }) => findItem(id) ?? null,
    order: (_p, { id }) => orders.get(id) ?? null
  },
  Mutation: {
    placeOrder: (_p, { input }) => {
      const { items, customer } = input;
      if (!items?.length) throw new Error('order must contain at least one item');
      if (!customer?.name || !customer?.address || !customer?.phone) {
        throw new Error('customer name, address and phone are required for delivery');
      }
      let subtotal = 0;
      const lineItems = items.map((line) => {
        const item = findItem(line.id);
        if (!item) throw new Error(`unknown menu item: ${line.id}`);
        const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 1;
        subtotal += item.price * qty;
        return { id: item.id, name: item.name, qty, price: item.price };
      });
      const deliveryFee = subtotal >= 25 ? 0 : 2.99;
      const order = {
        id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        status: 'CONFIRMED',
        customer,
        items: lineItems,
        subtotal: Number(subtotal.toFixed(2)),
        deliveryFee,
        total: Number((subtotal + deliveryFee).toFixed(2)),
        etaMinutes: 35
      };
      orders.set(order.id, order);
      return order;
    }
  }
};
