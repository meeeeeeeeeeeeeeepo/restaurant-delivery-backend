import * as store from "./db.js";

export const resolvers = {
  Query: {
    health: () => ({ status: "ok", service: "restaurant-delivery-backend", time: new Date().toISOString() }),
    menu: (_p, { category }) => {
      const items = store.listMenu(category);
      return { count: items.length, items };
    },
    menuItem: (_p, { id }) => store.getItem(id) ?? null,
    order: (_p, { id }) => store.getOrder(id) ?? null,
  },
  Mutation: {
    placeOrder: (_p, { input }) => store.createOrder(input),
  },
};
