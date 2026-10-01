# restaurant-delivery-backend

GraphQL API for the restaurant delivery platform, built with **graphql-yoga**.
It *implements* the contract published by
[`restaurant-graphql-schema`](https://github.com/meeeeeeeeeeeeeeepo/restaurant-graphql-schema)
— the SDL is consumed from the GitHub Packages artifact `@meeeeeeeeeeeeeeepo/restaurant-schema`.

## Run locally

```bash
export NODE_AUTH_TOKEN=<a GitHub token with packages:read>   # to install the schema pkg
npm ci
npm start           # http://localhost:4000/graphql  (GraphiQL enabled)
npm test
```

## Example query

```graphql
{ menu(category: PIZZA) { items { name price } } }
```

## Deploy (Render)

`render.yaml` defines **production** (`main`) and **staging** (`develop`) web services.
Set `NODE_AUTH_TOKEN` (GitHub Packages read token) in each service's environment.

## Release notes

- v1.1.0: GraphQL delivery API — menu, filtering, orders. Promoted from staging via the Slack ChatOps button.
