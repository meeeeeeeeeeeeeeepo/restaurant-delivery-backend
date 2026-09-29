import { createSchema } from 'graphql-yoga';
import { typeDefs } from '@meeeeeeeeeeeeeeepo/restaurant-schema';
import { resolvers } from './resolvers.js';

export const schema = createSchema({ typeDefs, resolvers });
