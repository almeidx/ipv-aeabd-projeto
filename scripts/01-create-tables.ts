import { readFile } from "node:fs/promises";
import { Client as PostgresClient } from "pg";
import { MongoClient } from "mongodb";
import { DBGEN_DIR, TABLES } from "./constants.ts";
import {
	CreateTableCommand,
	type CreateTableCommandInput,
	DeleteTableCommand,
	DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import type { WritableDeep } from "type-fest";

await createPostgresTables();
await createMongoCollections();
await createDynamoDBTables();

async function createPostgresTables() {
	const client = new PostgresClient(process.env.POSTGRES_URI!);

	await client.connect();

	for (const tableName of TABLES) {
		await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
	}

	const ddl = await readFile(new URL("dss.ddl", DBGEN_DIR), "utf-8");

	await client.query(ddl);

	await client.end();

	console.log("[PostgreSQL] Tables created successfully");
}

async function createMongoCollections() {
	const client = new MongoClient(process.env.MONGO_URI!);

	await client.connect();

	for (const tableName of TABLES) {
		await client.db().dropCollection(tableName);
	}

	for (const tableName of TABLES) {
		await client.db().createCollection(tableName);
	}

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
			TableName: "nation",
			KeySchema: [{ AttributeName: "N_NATIONKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "N_NATIONKEY", AttributeType: "N" }],
		},
		{
			TableName: "region",
			KeySchema: [{ AttributeName: "R_REGIONKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "R_REGIONKEY", AttributeType: "N" }],
		},
		{
			TableName: "part",
			KeySchema: [{ AttributeName: "P_PARTKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "P_PARTKEY", AttributeType: "N" }],
		},
		{
			TableName: "supplier",
			KeySchema: [{ AttributeName: "S_SUPPKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "S_SUPPKEY", AttributeType: "N" }],
		},
		{
			TableName: "partsupp",
			KeySchema: [
				{ AttributeName: "PS_PARTKEY", KeyType: "HASH" },
				{ AttributeName: "PS_SUPPKEY", KeyType: "RANGE" },
			],
			AttributeDefinitions: [
				{ AttributeName: "PS_PARTKEY", AttributeType: "N" },
				{ AttributeName: "PS_SUPPKEY", AttributeType: "N" },
			],
		},
		{
			TableName: "customer",
			KeySchema: [{ AttributeName: "C_CUSTKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "C_CUSTKEY", AttributeType: "N" }],
		},
		{
			TableName: "orders",
			KeySchema: [{ AttributeName: "O_ORDERKEY", KeyType: "HASH" }],
			AttributeDefinitions: [{ AttributeName: "O_ORDERKEY", AttributeType: "N" }],
		},
		{
			TableName: "lineitem",
			KeySchema: [
				{ AttributeName: "L_ORDERKEY", KeyType: "HASH" },
				{ AttributeName: "L_LINENUMBER", KeyType: "RANGE" },
			],
			AttributeDefinitions: [
				{ AttributeName: "L_ORDERKEY", AttributeType: "N" },
				{ AttributeName: "L_LINENUMBER", AttributeType: "N" },
			],
		},
	] as const satisfies CreateTableCommandInput[];

	for (const table of tables) {
		try {
			await client.send(new DeleteTableCommand({ TableName: table.TableName }));
		} catch {
			// Ignore. Tables might not exist yet.
		}
	}

	const MaxAccountThroughput = 80_000;
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
				ProvisionedThroughput: {
					ReadCapacityUnits: MaxTableThroughput,
					WriteCapacityUnits: MaxTableThroughput,
				},
			}),
		);
	}

	client.destroy();

	console.log("[DynamoDB] Tables created successfully");
}
