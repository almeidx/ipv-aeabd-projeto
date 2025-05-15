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
					response_time_ms: { bsonType: "int" },
					ip_address: { bsonType: "string" },
					user_agent: { bsonType: "string" },
					request_body: { bsonType: ["object", "null"] },
					query_params: { bsonType: ["object", "null"] },
					accessed_resources: { bsonType: "array", items: { bsonType: "string" } },
				},
			},
		},
	});

	const apiKeysCol = db.collection("api_keys");

	await apiKeysCol.createIndex({ api_key: 1 }, { unique: true });
	await apiKeysCol.createIndex({ expiration_date: 1 });
	await apiKeysCol.createIndex({ created_by: 1 });
	await apiKeysCol.createIndex({ data_classification: 1 });

	const accessLogsCol = db.collection("access_logs");

	await accessLogsCol.createIndex({ timestamp: 1 });
	await accessLogsCol.createIndex({ api_key: 1 });
	await accessLogsCol.createIndex({ endpoint: 1 });
	await accessLogsCol.createIndex({ status_code: 1 });

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
			KeySchema: [
				{ AttributeName: "customer_id", KeyType: "HASH" }, // Partition key
			],
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
