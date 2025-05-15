import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {  } from "../lib/postgres.ts";

export async function getCustomers(request: FastifyRequest, reply: FastifyReply) {
	if (!request.apiKeyData) {
		return reply.status(401).send({ error: "Authentication required." });
	}

	let query = "";

	try {
		switch (role.toLowerCase()) {
			case "data_steward":
				query =
					"SELECT customer_id, first_name, last_name, email, phone, address_line1, address_line2, city, postal_code, country, data_classification, consent_marketing, consent_date, created_at, updated_at FROM customers;";
				break;
			case "auditor":
				query =
					"SELECT customer_id, first_name, last_name, city, country, data_classification, consent_marketing, consent_date, created_at, updated_at FROM customers WHERE data_classification IN ('Public', 'Internal');";
				break;
			case "marketing":
				query =
					"SELECT customer_id, first_name, last_name, email, country, consent_marketing, consent_date FROM customers WHERE consent_marketing = TRUE;";
				break;
			default:
				return reply.status(403).send({ error: "Invalid or unsupported role associated with API Key" });
		}

		const { rows } = await pgClient.query(query);
		return rows;
	} catch (err) {
		request.log.error(err);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function customersRoutes(app: FastifyInstance) {
	app.get("/customers", getCustomers);
}
