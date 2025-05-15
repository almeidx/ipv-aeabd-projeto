import crypto from "node:crypto";
import { apiKeysCollection } from "../lib/mongo.ts";
import type { ApiKey } from "../types.ts";
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const createApiKeySchema = z.object({
	purpose: z.enum(["Marketing", "Audit", "System"]),
	description: z.string().optional(),
	allowed_ips: z.array(z.string().ip()).optional(),
	data_classification: z.array(z.enum(["Public", "Internal", "Confidential", "Restricted"])),
});

export const createApiKeyHandler: FastifyPluginAsyncZod = async (app) => {
	app.post("/admin/api-keys", { schema: { body: createApiKeySchema } }, async (request, reply) => {
		const { purpose, allowed_ips, data_classification, description } = request.body;

		const newApiKey = crypto.randomBytes(32).toString("hex");
		const apiKeyDocument: Omit<ApiKey, "_id"> = {
			api_key: newApiKey,
			description: description || `${purpose} key`,
			purpose,
			created_at: new Date(),
			usages: 0,
			allowed_ips: allowed_ips ?? [],
			rate_limit: 0,
			created_by: request.ip,
			data_classification,
			updated_at: new Date(),
			expiration_date: null,
			last_used: null,
		};

		await apiKeysCollection.insertOne(apiKeyDocument);

		return reply.status(201).send({
			apiKey: newApiKey,
			message: "API Key created successfully. Store it securely, it will not be shown again.",
		});
	});
};
