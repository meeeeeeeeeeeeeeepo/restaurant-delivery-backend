import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema.js';

const port = process.env.PORT || 4000;
const yoga = createYoga({ schema, graphqlEndpoint: '/graphql', landingPage: true, cors: true });
const server = createServer(yoga);

server.listen(port, () => {
  console.log(`restaurant-delivery-backend (GraphQL) ready at :${port}/graphql`);
});
