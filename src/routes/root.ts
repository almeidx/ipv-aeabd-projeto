import type { FastifyInstance } from "fastify";

export default async function rootRoute(app: FastifyInstance) {
	app.get("/", () => "OK");
}
