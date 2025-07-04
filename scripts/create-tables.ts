import { DynamoDBClient, type CreateTableCommandInput, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";
import { Client as PostgresClient } from "pg";
import type { WritableDeep } from "type-fest";

await Promise.all([createPostgresTables(), createMongoCollections(), createDynamoDBTables()]);

async function createPostgresTables() {
	const client = new PostgresClient(process.env.POSTGRES_URI!);

	await client.connect();

	const pgSql = await readFile(new URL("pg.sql", import.meta.url), "utf-8");

	await client.query(pgSql);
	await client.end();

	console.log("[PostgreSQL] Tables created successfully");
}

async function createMongoCollections() {
	const client = new MongoClient(process.env.MONGO_URI!);

	await client.connect();

	const db = client.db("aeabd");

	await db.createCollection("api_keys", {
		validator: {
			$jsonSchema: {
				bsonType: "object",
				required: ["api_key", "purpose", "created_at"],
				properties: {
					api_key: { bsonType: "string" },
					description: { bsonType: "string" },
					purpose: { bsonType: "string", enum: ["Audit", "Marketing", "System"] },
					data_classification: {
						bsonType: "array",
						items: {
							bsonType: "string",
							enum: ["Public", "Internal", "Confidential", "Restricted"],
						},
						minItems: 1,
					},
					created_by: { bsonType: "string" },
					created_at: { bsonType: "date" },
					updated_at: { bsonType: "date" },
					expiration_date: { bsonType: ["date", "null"] },
					last_used: { bsonType: ["date", "null"] },
					usages: { bsonType: "int" },
					allowed_ips: { bsonType: "array", items: { bsonType: "string" } },
					rate_limit: { bsonType: "int" },
				},
			},
		},
	});

	await db.createCollection("access_logs", {
		validator: {
			$jsonSchema: {
				bsonType: "object",
				required: ["timestamp", "api_key", "endpoint"],
				properties: {
					timestamp: { bsonType: "date" },
					api_key: { bsonType: "string" },
					endpoint: { bsonType: "string" },
					method: { bsonType: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
					status_code: { bsonType: "int" },
					query_time_ms: { bsonType: ["double", "int"] },
					validation_time_ms: { bsonType: ["double", "int"] },
					elapsed_time_ms: { bsonType: ["double", "int"] },
					ip_address: { bsonType: "string" },
					user_agent: { bsonType: "string" },
					accessed_resources: { bsonType: "array", items: { bsonType: "string" } },
				},
			},
		},
	});

	await db.createCollection("customer_history", {
		validator: {
			$jsonSchema: {
				bsonType: "object",
				required: ["customer_nif", "timestamp", "update_kind", "object"],
				properties: {
					customer_nif: { bsonType: "int" },
					timestamp: { bsonType: "date" },
					update_kind: { bsonType: "string", enum: ["duplicate", "update"] },
					customer: {
						bsonType: "object",
						required: [
							"customer_id",
							"first_name",
							"last_name",
							"email",
							"phone",
							"address_line1",
							"address_line2",
							"city",
							"postal_code",
							"country",
							"nif",
							"data_classification",
						],
						properties: {
							first_name: { bsonType: "string" },
							last_name: { bsonType: "string" },
							email: { bsonType: "string" },
							phone: { bsonType: ["string", "null"] },
							address_line1: { bsonType: "string" },
							address_line2: { bsonType: ["string", "null"] },
							city: { bsonType: "string" },
							postal_code: { bsonType: "string" },
							country: { bsonType: "string" },
							nif: { bsonType: "int" },
							data_classification: {
								bsonType: "string",
								enum: ["Public", "Internal", "Confidential", "Restricted"],
							},
							consent_marketing: { bsonType: ["bool", "null"] },
							consent_date: { bsonType: ["date", "null"] },
						},
					},
				},
			},
		},
	});

	const apiKeysCol = db.collection("api_keys");

	await apiKeysCol.createIndex({ api_key: 1 }, { unique: true });
	await apiKeysCol.createIndex({ expiration_date: 1 });
	await apiKeysCol.createIndex({ created_by: 1 });

	const accessLogsCol = db.collection("access_logs");

	await accessLogsCol.createIndex({ api_key: 1 });
	await accessLogsCol.createIndex({ endpoint: 1 });
	await accessLogsCol.createIndex({ status_code: 1 });

	const customerHistoryCol = db.collection("customer_history");

	await customerHistoryCol.createIndex({ customer_id: 1 });

	await client.close();

	console.log("[MongoDB] Collections created successfully");
}

async function createDynamoDBTables() {
	const client = new DynamoDBClient({
		region: process.env.DYNAMODB_REGION!,
		endpoint: process.env.DYNAMODB_ENDPOINT!,
		credentials: {
			accessKeyId: process.env.DYNAMODB_ACCESS_KEY!,
			secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY!,
		},
	});

	const tables = [
		{
			TableName: "customer_preferences",
			KeySchema: [{ AttributeName: "customer_id", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "customer_id", AttributeType: "N" }],
			ProvisionedThroughput: {
				ReadCapacityUnits: 5,
				WriteCapacityUnits: 5,
			},
		},
	] as const satisfies CreateTableCommandInput[];

	// const MaxAccountThroughput = 80_000;
	const MaxAccountThroughput = 40_000;
	const MaxTableThroughput = Math.trunc(MaxAccountThroughput / tables.length);

	for (const table of tables) {
		const { AttributeDefinitions, KeySchema, TableName } = table as WritableDeep<typeof table>;

		await client.send(
			new CreateTableCommand({
				AttributeDefinitions,
				KeySchema,
				TableName,
				BillingMode: "PAY_PER_REQUEST",
				OnDemandThroughput: {
					MaxReadRequestUnits: MaxTableThroughput,
					MaxWriteRequestUnits: MaxTableThroughput,
				},
			}),
		);
	}

	client.destroy();

	console.log("[DynamoDB] Tables created successfully");
}
