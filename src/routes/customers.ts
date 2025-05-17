import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { marketingPool } from "../lib/postgres.ts";
import { assertApiKeyPurpose } from "../utils/assert-api-key-purpose.ts";
import { sql } from "../utils/sql.ts";
import { z } from "zod";
import { convertDataClassificationToPgArray } from "../utils/convert-data-classification-to-pg-array.ts";
import { dynamoClient } from "../lib/dynamo.ts";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

// Marketing-specific endpoints
export async function getTopSpendingCustomers(app: FastifyInstance) {
	const topSpendingSchema = z.object({
		customer_id: z.number().int(),
		// name: z.string(),
		total_spent: z.number().min(0),
	});

	app.get(
		"/customers/top-spending",
		{
			schema: {
				response: {
					200: z.array(topSpendingSchema),
				},
			},
		},
		async (request: FastifyRequest, _reply: FastifyReply) => {
			assertApiKeyPurpose(app, request, "Marketing");

			const query = sql`
				SELECT
					t.customer_id,
					SUM(t.amount)::float as total_spent
				FROM transactions t
				INNER JOIN customers c ON t.customer_id = c.customer_id
				WHERE
					c.consent_marketing = true
					AND t.data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
					AND c.data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
				GROUP BY t.customer_id
				ORDER BY total_spent DESC
				LIMIT 100;
			`;

			const startTime = performance.now();
			const { rows } = await marketingPool.query<z.output<typeof topSpendingSchema>>(query);

			request.requestContext.set("queryTime", performance.now() - startTime);
			request.requestContext.set(
				"accessedResources",
				rows.map((row) => `customers:${row.customer_id}`),
			);

			return rows;
		},
	);
}

const getCustomerPreferences: FastifyPluginAsyncZod = async (app) => {
	app.get("/customers/preferences", async (request, _reply) => {
		assertApiKeyPurpose(app, request, "Audit");

		const startTime = performance.now();

		const command = new ScanCommand({
			TableName: "customer_preferences",
			Limit: 100,
		});

		const response = await dynamoClient.send(command);

		request.requestContext.set("queryTime", performance.now() - startTime);
		request.requestContext.set(
			"accessedResources",
			response.Items?.map((item) => `customers:${item.customer_id}`) ?? [],
		);

		return response.Items;
	});
};

export async function customersRoutes(app: FastifyInstance) {
	// Marketing-specific endpoints
	await app.register(getTopSpendingCustomers);

	// Auditor-specific endpoints
	await app.register(getCustomerPreferences);
}
