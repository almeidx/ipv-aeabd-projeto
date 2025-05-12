import { MongoClient } from "mongodb";
import { Client as PostgresClient } from "pg";
import { fakerPT_PT as faker } from "@faker-js/faker";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const SCALE = 1;

const NUM_CUSTOMERS = 1_000 * SCALE;
const NUM_TRANSACTIONS = 5_000 * SCALE;
const NUM_API_KEYS = 50 * SCALE;
const NUM_ACCESS_LOGS = 10_000 * SCALE;
const NUM_CUSTOMER_PREFS = 500 * SCALE;

await Promise.all([generatePostgresData(), generateMongoData(), generateDynamoDBData()]);

async function generatePostgresData() {
	const client = new PostgresClient(process.env.POSTGRES_URI!);
	await client.connect();

	try {
		console.log(`[PostgreSQL] Generating ${NUM_CUSTOMERS} customers...`);

		const usedEmails = new Set<string>();

		for (let i = 0; i < NUM_CUSTOMERS; i++) {
			const consentMarketing = faker.datatype.boolean({ probability: 0.6 });

			let email: string;
			do {
				email = faker.internet.email();
			} while (usedEmails.has(email));

			usedEmails.add(email);

			const customer = {
				customer_id: i + 1,
				first_name: faker.person.firstName(),
				last_name: faker.person.lastName(),
				email,
				phone: faker.phone.number({ style: "international" }),
				address_line1: faker.location.streetAddress(),
				address_line2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.3 }),
				city: faker.location.city(),
				postal_code: faker.location.zipCode(),
				country: faker.location.country(),
				data_classification: faker.helpers.arrayElement(["Public", "Internal", "Confidential", "Restricted"]),
				consent_marketing: consentMarketing,
				consent_date: consentMarketing ? faker.date.past() : null,
			};

			await client.query(
				`
        INSERT INTO customers (
          customer_id, first_name, last_name, email, phone,
          address_line1, address_line2, city, postal_code, country,
          data_classification, consent_marketing, consent_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
				[
					customer.customer_id,
					customer.first_name,
					customer.last_name,
					customer.email,
					customer.phone,
					customer.address_line1,
					customer.address_line2,
					customer.city,
					customer.postal_code,
					customer.country,
					customer.data_classification,
					customer.consent_marketing,
					customer.consent_date,
				],
			);

			if ((i + 1) % 100 === 0) {
				console.log(`[PostgreSQL] Generated ${i + 1} customers`);
			}
		}

		console.log(`[PostgreSQL] Generating ${NUM_TRANSACTIONS} transactions...`);

		for (let i = 0; i < NUM_TRANSACTIONS; i++) {
			const transaction = {
				transaction_id: i + 1,
				customer_id: faker.number.int({ min: 1, max: NUM_CUSTOMERS }),
				transaction_date: faker.date.past(),
				amount: Number.parseFloat(faker.finance.amount({ min: 10, max: 5000 })),
				currency: faker.finance.currencyCode(),
				status: faker.helpers.arrayElement(["Pending", "Completed", "Failed", "Refunded"]),
				data_classification: faker.helpers.arrayElement(["Public", "Internal", "Confidential", "Restricted"]),
			};

			await client.query(
				`
        INSERT INTO transactions (
          transaction_id, customer_id, transaction_date, amount,
          currency, status, data_classification
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
				[
					transaction.transaction_id,
					transaction.customer_id,
					transaction.transaction_date,
					transaction.amount,
					transaction.currency,
					transaction.status,
					transaction.data_classification,
				],
			);

			if ((i + 1) % 500 === 0) {
				console.log(`[PostgreSQL] Generated ${i + 1} transactions`);
			}
		}

		console.log("[PostgreSQL] Data generation completed");
	} catch (err) {
		console.error("[PostgreSQL] Error generating data:", err);
	} finally {
		await client.end();
	}
}

async function generateMongoData() {
	const client = new MongoClient(process.env.MONGO_URI!);

	try {
		await client.connect();
		const db = client.db("aeabd");
		const apiKeysCollection = db.collection("api_keys");
		const accessLogsCollection = db.collection("access_logs");

		console.log(`[MongoDB] Generating ${NUM_API_KEYS} API keys...`);

		const apiKeys: any[] = [];

		for (let i = 0; i < NUM_API_KEYS; i++) {
			const apiKey = {
				api_key: faker.string.uuid(),
				description: faker.lorem.sentence(),
				type: faker.helpers.arrayElement(["read", "write", "admin"]),
				data_classification: faker.helpers.arrayElement(["Public", "Internal", "Confidential", "Restricted"]),
				created_by: faker.internet.username(),
				created_at: faker.date.past(),
				updated_at: faker.date.recent(),
				expiration_date: faker.date.future(),
				last_used: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.8 }) ?? null,
				usages: faker.number.int({ min: 0, max: 10000 }),
				allowed_ips: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => faker.internet.ipv4()),
				rate_limit: faker.number.int({ min: 10, max: 1000 }),
			};

			apiKeys.push(apiKey);
		}

		if (apiKeys.length > 0) {
			await apiKeysCollection.insertMany(apiKeys);
		}

		console.log(`[MongoDB] Generating ${NUM_ACCESS_LOGS} access logs...`);

		const BATCH_SIZE = 1000;
		const apiKeyValues = apiKeys.map((k) => k.api_key);

		for (let batch = 0; batch < NUM_ACCESS_LOGS / BATCH_SIZE; batch++) {
			const accessLogs: any[] = [];

			for (let i = 0; i < BATCH_SIZE; i++) {
				const accessLog = {
					timestamp: faker.date.recent(),
					api_key: faker.helpers.arrayElement(apiKeyValues),
					endpoint: `/api/${faker.helpers.arrayElement(["customers", "transactions", "products", "orders"])}`,
					method: faker.helpers.arrayElement(["GET", "POST", "PUT", "DELETE", "PATCH"]),
					status_code: faker.helpers.arrayElement([200, 201, 204, 400, 401, 403, 404, 500]),
					response_time_ms: faker.number.int({ min: 1, max: 1000 }),
					ip_address: faker.internet.ipv4(),
					user_agent: faker.internet.userAgent(),
					request_body: faker.helpers.maybe(() => ({ data: faker.lorem.sentence() }), { probability: 0.4 }) ?? null,
					query_params:
						faker.helpers.maybe(
							() => ({
								limit: faker.number.int({ min: 10, max: 100 }),
								offset: faker.number.int({ min: 0, max: 1000 }),
							}),
							{ probability: 0.6 },
						) ?? null,
					accessed_resources: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
						faker.helpers.arrayElement(["customers", "transactions", "products", "orders"]),
					),
				};

				accessLogs.push(accessLog);
			}

			if (accessLogs.length > 0) {
				await accessLogsCollection.insertMany(accessLogs);
			}

			console.log(`[MongoDB] Generated ${(batch + 1) * BATCH_SIZE} access logs`);
		}

		console.log("[MongoDB] Data generation completed");
	} catch (err) {
		console.error("[MongoDB] Error generating data:", err);
		console.dir(err, { depth: Number.POSITIVE_INFINITY, maxArrayLength: null });
	} finally {
		await client.close();
	}
}

async function generateDynamoDBData() {
	const client = new DynamoDBClient({
		region: process.env.DYNAMODB_REGION!,
		endpoint: process.env.DYNAMODB_ENDPOINT!,
		credentials: {
			accessKeyId: process.env.DYNAMODB_ACCESS_KEY!,
			secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY!,
		},
	});

	try {
		console.log(`[DynamoDB] Generating ${NUM_CUSTOMER_PREFS} customer preferences...`);

		for (let i = 0; i < NUM_CUSTOMER_PREFS; i++) {
			const customerId = i + 1;

			const preference = {
				customer_id: customerId,
				theme: faker.helpers.arrayElement(["light", "dark", "auto"]),
				notifications_enabled: faker.datatype.boolean(),
				email_frequency: faker.helpers.arrayElement(["daily", "weekly", "monthly", "never"]),
				language: faker.helpers.arrayElement(["en", "es", "fr", "de", "pt"]),
				currency: faker.finance.currencyCode(),
				favorite_categories: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
					faker.helpers.arrayElement(["electronics", "clothing", "books", "food", "sports", "beauty", "home"]),
				),
				last_updated: faker.date.recent().toISOString(),
			};

			await client.send(
				new PutItemCommand({
					TableName: "customer_preferences",
					Item: marshall(preference),
				}),
			);

			if ((i + 1) % 50 === 0) {
				console.log(`[DynamoDB] Generated ${i + 1} customer preferences`);
			}
		}

		console.log("[DynamoDB] Data generation completed");
	} catch (err) {
		console.error("[DynamoDB] Error generating data:", err);
	} finally {
		client.destroy();
	}
}
