import crypto from "node:crypto";
import { apiKeysCollection } from "../lib/mongo.ts";
import { apiKeyPurposeSchema, dataClassificationSchema, type ApiKey } from "../schemas.ts";
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyInstance } from "fastify";

const createApiKeySchema = z.object({
	purpose: apiKeyPurposeSchema,
	description: z.string().optional(),
	allowed_ips: z.array(z.string().ip()).optional(),
	data_classification: z.array(dataClassificationSchema),
});

export const createApiKeyHandler: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/admin/api-keys",
		{
			schema: {
				body: createApiKeySchema,
			},
		},
		async (request, reply) => {
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
		},
	);
};

export async function adminRoutes(app: FastifyInstance) {
	await app.register(createApiKeyHandler);
}
