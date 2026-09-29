// Menu for Bella Forchetta. `category` values match the GraphQL Category enum.
export const menu = [
  { id: 'm1', category: 'STARTERS', name: 'Bruschetta al Pomodoro', description: 'Grilled sourdough, vine tomatoes, basil, garlic, olive oil.', price: 7.5, veg: true },
  { id: 'm2', category: 'STARTERS', name: 'Arancini', description: 'Crispy saffron rice balls, mozzarella, pomodoro dip.', price: 8.0, veg: true },
  { id: 'm3', category: 'PIZZA', name: 'Margherita', description: 'San Marzano tomato, fior di latte, basil.', price: 12.0, veg: true },
  { id: 'm4', category: 'PIZZA', name: 'Diavola', description: 'Spicy salami, tomato, mozzarella, chilli honey.', price: 14.5, veg: false },
  { id: 'm5', category: 'PIZZA', name: 'Quattro Formaggi', description: 'Mozzarella, gorgonzola, fontina, parmigiano.', price: 15.0, veg: true },
  { id: 'm6', category: 'PASTA', name: 'Spaghetti Carbonara', description: 'Guanciale, egg yolk, pecorino, black pepper.', price: 13.5, veg: false },
  { id: 'm7', category: 'PASTA', name: 'Penne Arrabbiata', description: 'Garlic, chilli, tomato, parsley.', price: 11.5, veg: true },
  { id: 'm8', category: 'DESSERTS', name: 'Tiramisu', description: 'Mascarpone, espresso-soaked savoiardi, cocoa.', price: 6.5, veg: true },
  { id: 'm9', category: 'DESSERTS', name: 'Panna Cotta', description: 'Vanilla cream, mixed-berry coulis.', price: 6.0, veg: true },
  { id: 'm10', category: 'DRINKS', name: 'San Pellegrino', description: 'Sparkling mineral water, 500ml.', price: 3.0, veg: true },
  { id: 'm11', category: 'DRINKS', name: 'Chianti (glass)', description: 'Tuscan red, 175ml.', price: 7.0, veg: true }
];
export const findItem = (id) => menu.find((m) => m.id === id);
