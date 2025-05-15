import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditorPool, dataStewardPool, marketingPool } from "../lib/postgres.ts";
import { assertApiKeyPurpose } from "../utils/assert-api-key-purpose.ts";
import { sql } from "../utils/sql.ts";

// Marketing-specific endpoints
export async function getTopSpendingCustomers(this: FastifyInstance, request: FastifyRequest, _reply: FastifyReply) {
	assertApiKeyPurpose(this, request, "Marketing");

	const query = sql`
		SELECT t.customer_id, c.name, SUM(t.amount) as total_spent
		FROM transactions t
		INNER JOIN customers c ON t.customer_id = c.customer_id
		WHERE
			c.consent_marketing = TRUE
			AND t.data_classification IN (${request.apiKeyData.data_classification.join(", ")})
			AND c.data_classification IN (${request.apiKeyData.data_classification.join(", ")})
		GROUP BY t.customer_id, c.name
		ORDER BY total_spent DESC
		LIMIT 100;
	`;

	const { rows } = await marketingPool.query<{
		customer_id: number;
		name: string;
		total_spent: number;
	}>(query);
	return rows;
}

export async function getMostExpensiveTransactions(
	this: FastifyInstance,
	request: FastifyRequest,
	_reply: FastifyReply,
) {
	assertApiKeyPurpose(this, request, "Marketing");

	const query = sql`
		SELECT t.transaction_id, t.customer_id, c.name, t.amount, t.currency, t.transaction_date
		FROM transactions t
		INNER JOIN customers c ON t.customer_id = c.customer_id
		WHERE
			c.consent_marketing = TRUE
			AND t.data_classification IN (${request.apiKeyData.data_classification.join(", ")})
			AND c.data_classification IN (${request.apiKeyData.data_classification.join(", ")})
		ORDER BY t.amount DESC
		LIMIT 100;
	`;

	const { rows } = await marketingPool.query<{
		transaction_id: number;
		customer_id: number;
		name: string;
		amount: number;
		currency: string;
		transaction_date: Date;
	}>(query);

	return rows;
}

// Auditor-specific endpoints
export async function getTransactionTimeline(this: FastifyInstance, request: FastifyRequest, _reply: FastifyReply) {
	assertApiKeyPurpose(this, request, "Audit");

	const query = sql`
		SELECT DATE_TRUNC('day', transaction_date) as date, COUNT(*) as transaction_count
		FROM transactions
		WHERE data_classification IN (${request.apiKeyData.data_classification.join(", ")})
		GROUP BY DATE_TRUNC('day', transaction_date)
		ORDER BY date DESC
		LIMIT 100;
	`;

	const { rows } = await auditorPool.query<{
		date: Date;
		transaction_count: number;
	}>(query);
	return rows;
}

export async function getStatusDistribution(this: FastifyInstance, request: FastifyRequest, _reply: FastifyReply) {
	assertApiKeyPurpose(this, request, "Audit");

	const query = sql`
		SELECT status, COUNT(*) as count
		FROM transactions
		WHERE data_classification IN (${request.apiKeyData.data_classification.join(", ")})
		GROUP BY status;
	`;

	const { rows } = await auditorPool.query<{
		status: string;
		count: number;
	}>(query);
	return rows;
}

// Data Steward specific endpoints
export async function getDataClassificationCounts(
	this: FastifyInstance,
	request: FastifyRequest,
	_reply: FastifyReply,
) {
	assertApiKeyPurpose(this, request, "System");

	const query = sql`
		SELECT data_classification, COUNT(*) as count
		FROM transactions
		GROUP BY data_classification
		ORDER BY count DESC;
	`;

	const { rows } = await dataStewardPool.query(query);
	return rows;
}

export async function getRecentTransactions(this: FastifyInstance, request: FastifyRequest, _reply: FastifyReply) {
	assertApiKeyPurpose(this, request, "System");

	const query = sql`
		SELECT transaction_id, customer_id, transaction_date, amount, currency, status, data_classification
		FROM transactions
		WHERE data_classification IN (${request.apiKeyData.data_classification.join(", ")})
		ORDER BY transaction_date DESC
		LIMIT 100;
	`;

	const { rows } = await dataStewardPool.query(query);
	return rows;
}

export async function transactionsRoutes(app: FastifyInstance) {
	// Marketing-specific endpoints
	app.get("/customers/top-spending", getTopSpendingCustomers.bind(app));
	app.get("/transactions/most-expensive", getMostExpensiveTransactions.bind(app));

	// Auditor-specific endpoints
	app.get("/transactions/timeline", getTransactionTimeline.bind(app));
	app.get("/transactions/status-distribution", getStatusDistribution.bind(app));

	// Data Steward specific endpoints
	app.get("/transactions/classification-counts", getDataClassificationCounts.bind(app));
	app.get("/transactions/recent", getRecentTransactions.bind(app));
}
