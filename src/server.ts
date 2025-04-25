import fastify from "fastify";

const app = fastify();

app.get("/", () => "Hello World");

await app.listen({ port: 3000 });

console.log("Server is running on port 3000");
