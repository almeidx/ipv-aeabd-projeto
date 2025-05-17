import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditorPool, dataStewardPool, marketingPool } from "../lib/postgres.ts";
import { assertApiKeyPurpose } from "../utils/assert-api-key-purpose.ts";
import { sql } from "../utils/sql.ts";
import { z } from "zod";
import { dataClassificationSchema } from "../schemas.ts";
import { convertDataClassificationToPgArray } from "../utils/convert-data-classification-to-pg-array.ts";

// Marketing-specific endpoints
export async function getMostExpensiveTransactions(app: FastifyInstance) {
	const mostExpensiveSchema = z.object({
		transaction_id: z.number().int(),
		customer_id: z.number().int(),
		name: z.string(),
		amount: z.number().min(0),
		currency: z.string(),
		transaction_date: z.date(),
	});

	app.get(
		"/transactions/most-expensive",
		{
			schema: {
				response: {
					200: z.array(mostExpensiveSchema),
				},
			},
		},
		async (request: FastifyRequest, _reply: FastifyReply) => {
			assertApiKeyPurpose(app, request, "Marketing");

			const query = sql`
				SELECT t.transaction_id, t.customer_id, c.name, t.amount, t.currency, t.transaction_date
				FROM transactions t
				INNER JOIN customers c ON t.customer_id = c.customer_id
				WHERE
					c.consent_marketing = TRUE
					AND t.data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
					AND c.data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
				ORDER BY t.amount DESC
				LIMIT 100;
			`;

			const startTime = performance.now();
			const { rows } = await marketingPool.query<z.output<typeof mostExpensiveSchema>>(query);

			request.requestContext.set("queryTime", performance.now() - startTime);
			request.requestContext.set(
				"accessedResources",
				rows.map((row) => `customers:${row.customer_id}`),
			);

			return rows;
		},
	);
}

// Auditor-specific endpoints
export async function getTransactionTimeline(app: FastifyInstance) {
	const transactionTimelineSchema = z.object({
		date: z.date(),
		transaction_count: z.number().int(),
	});

	app.get("/transactions/timeline", async (request, _reply) => {
		assertApiKeyPurpose(app, request, "Audit");

		const query = sql`
			SELECT DATE_TRUNC('day', transaction_date) as date, COUNT(*) as transaction_count
			FROM transactions
			WHERE data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
			GROUP BY DATE_TRUNC('day', transaction_date)
			ORDER BY date DESC
			LIMIT 100;
		`;

		const startTime = performance.now();
		const { rows } = await auditorPool.query<z.output<typeof transactionTimelineSchema>>(query);

		request.requestContext.set("queryTime", performance.now() - startTime);
		request.requestContext.set("accessedResources", ["transactions:<count>"]);

		return rows;
	});
}

export async function getStatusDistribution(app: FastifyInstance) {
	const statusDistributionSchema = z.object({
		status: z.string(),
		count: z.number().int(),
	});

	app.get("/transactions/status-distribution", async (request, _reply) => {
		assertApiKeyPurpose(app, request, "Audit");

		const query = sql`
			SELECT status, COUNT(transaction_id) as count
			FROM transactions
			WHERE data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
			GROUP BY status;
		`;

		const startTime = performance.now();
		const { rows } = await auditorPool.query<z.output<typeof statusDistributionSchema>>(query);

		request.requestContext.set("queryTime", performance.now() - startTime);
		request.requestContext.set("accessedResources", ["transactions:<count>"]);

		return rows;
	});
}

// Data Steward specific endpoints
export async function getDataClassificationCounts(app: FastifyInstance) {
	const dataClassificationCountsSchema = z.object({
		data_classification: dataClassificationSchema,
		count: z.number().int(),
	});

	app.get("/transactions/classification-counts", async (request, _reply) => {
		assertApiKeyPurpose(app, request, "System");

		const query = sql`
			SELECT data_classification, COUNT(*) as count
			FROM transactions
			GROUP BY data_classification
			ORDER BY count DESC;
		`;

		const startTime = performance.now();
		const { rows } = await dataStewardPool.query<z.output<typeof dataClassificationCountsSchema>>(query);

		request.requestContext.set("queryTime", performance.now() - startTime);
		request.requestContext.set("accessedResources", ["transactions:<count>"]);

		return rows;
	});
}

export async function getRecentTransactions(app: FastifyInstance) {
	const recentTransactionsSchema = z.object({
		transaction_id: z.number().int(),
		customer_id: z.number().int(),
		transaction_date: z.date(),
		amount: z.number().min(0),
		currency: z.string(),
		status: z.string(),
		data_classification: dataClassificationSchema,
	});

	app.get("/transactions/recent", async (request, _reply) => {
		assertApiKeyPurpose(app, request, "System");

		const query = sql`
			SELECT transaction_id, customer_id, transaction_date, amount, currency, status, data_classification
			FROM transactions
			WHERE data_classification IN (${convertDataClassificationToPgArray(request.apiKeyData.data_classification)})
			ORDER BY transaction_date DESC
			LIMIT 10;
		`;

		const startTime = performance.now();
		const { rows } = await dataStewardPool.query<z.output<typeof recentTransactionsSchema>>(query);

		request.requestContext.set("queryTime", performance.now() - startTime);
		request.requestContext.set(
			"accessedResources",
			rows.map((row) => `transactions:${row.transaction_id}`),
		);

		return rows;
	});
}

export async function transactionsRoutes(app: FastifyInstance) {
	// Marketing-specific endpoints
	getMostExpensiveTransactions(app);

	// Auditor-specific endpoints
	getTransactionTimeline(app);
	getStatusDistribution(app);

	// Data Steward specific endpoints
	getDataClassificationCounts(app);
	getRecentTransactions(app);
}
