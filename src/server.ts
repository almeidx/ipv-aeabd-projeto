import "./lib/connect-databases.ts";

import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify from "fastify";
import {
	hasZodFastifySchemaValidationErrors,
	isResponseSerializationError,
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { onRequestAuth } from "./hooks/onRequestAuth.ts";
import { createApiKeyHandler } from "./routes/admin.ts";
import { customersRoutes } from "./routes/customers.ts";
import rootRoutes from "./routes/root.ts";
import { transactionsRoutes } from "./routes/transactions.ts";
import { gracefulShutdown } from "./utils/graceful-shutdown.ts";

export const app = fastify({ logger: true });

await app.register(fastifySensible);

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifyCors, {
	origin: ["https://aeabd.pt"], // This is [not] a real site
	allowedHeaders: ["Content-Type", "X-API-Key"],
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

await app.register(fastifyHelmet);

app.setErrorHandler((error, request, reply) => {
	if (hasZodFastifySchemaValidationErrors(error)) {
		reply.code(400).send({
			error: "Response Validation Error",
			message: "Request doesn't match the schema",
			statusCode: 400,
			details: {
				issues: error.validation,
				method: request.method,
				url: request.url,
			},
		});
		return;
	}

	if (isResponseSerializationError(error)) {
		reply.code(500).send({
			error: "Internal Server Error",
			message: "Response doesn't match the schema",
			statusCode: 500,
			details: {
				issues: error.cause.issues,
				method: error.method,
				url: error.url,
			},
		});
		return;
	}

	app.log.error(error);

	reply.status(500).send({
		statusCode: 500,
		error: "Internal Server Error",
		message: "An unexpected error occurred.",
	});
});

app.addHook("onRequest", onRequestAuth);

await app.register(rootRoutes);

await app.register(createApiKeyHandler);

await app.register(customersRoutes);
await app.register(transactionsRoutes);

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

await app.listen({ port: 3333 });
