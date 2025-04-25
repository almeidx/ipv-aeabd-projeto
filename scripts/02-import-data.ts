import { readFile } from "node:fs/promises";
import { BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { MongoClient } from "mongodb";
import { Client as PostgresClient } from "pg";
import { COLUMNS, DBGEN_DIR, TABLES } from "./constants.ts";

console.time("Parsing data");

const data: Record<(typeof TABLES)[number], Record<string, string | number | Date>[]> = {
	customer: [],
	orders: [],
	lineitem: [],
	part: [],
	partsupp: [],
	region: [],
	nation: [],
	supplier: [],
};

for (const table of TABLES) {
	const filePath = new URL(`${table}.tbl`, DBGEN_DIR);
	const content = await readFile(filePath, "utf-8");
	const rows = content.trim().split("\n");

	data[table] = rows.map((row) => {
		const values = row.split("|").slice(0, -1);
		return COLUMNS[table].reduce((acc, header, index) => {
			acc[header] = parseColumnValue(table, header, values[index]);
			return acc;
		}, {});
	});
}

console.timeEnd("Parsing data");

await importPostgres();
await importMongo();
await importDynamoDB();

// #region PostgreSQL

async function importPostgres() {
	const log = "[PostgreSQL] Completed importing all tables";
	console.time(log);

	const client = new PostgresClient(process.env.POSTGRES_URI!);

	try {
		await client.connect();

		for (const table of TABLES) {
			const log = `[PostgreSQL] Imported ${table}`;
			console.time(log);

			await importPostgresTable(table, client);

			console.timeEnd(log);
		}
	} catch (error) {
		console.error("[PostgreSQL] Error importing data:", error);
	} finally {
		await client.end();
	}

	console.timeEnd(log);
}

async function importPostgresTable<TableName extends keyof typeof data>(table: TableName, client: PostgresClient) {
	const BATCH_SIZE = 3000;
	const totalRows = data[table].length;

	for (let i = 0; i < totalRows; i += BATCH_SIZE) {
		const batch = data[table].slice(i, i + BATCH_SIZE);
		if (batch.length === 0) {
			break;
		}

		let placeholderCounter = 1;
		const valuesList = batch
			.map((row) => {
				const placeholders = Object.values(row)
					.map(() => `$${placeholderCounter++}`)
					.join(", ");
				return `(${placeholders})`;
			})
			.join(", ");

		const query = `INSERT INTO ${table} VALUES ${valuesList}`;
		const allValues = batch.flatMap((row) => Object.values(row));

		await client.query(query, allValues);
	}
}

// #endregion

// #region MongoDB

async function importMongo() {
	const log = "[MongoDB] Completed importing all tables";
	console.time(log);

	const client = new MongoClient(process.env.MONGO_URI!);

	await client.connect();

	try {
		for (const table of TABLES) {
			const log = `[MongoDB] Imported ${table}`;
			console.time(log);

			await importMongoTable(table, client);

			console.timeEnd(log);
		}
	} catch (error) {
		console.error("[MongoDB] Error importing data:", error);
	} finally {
		await client.close();
	}

	console.timeEnd(log);
}

async function importMongoTable<TableName extends keyof typeof data>(table: TableName, client: MongoClient) {
	await client.db().collection(table).insertMany(data[table]);
}

// #endregion

// #region DynamoDB

async function importDynamoDB() {
	const log = "[DynamoDB] Completed importing all tables";
	console.time(log);

	const client = new DynamoDBClient({
		region: process.env.DYNAMODB_REGION!,
		endpoint: process.env.DYNAMODB_ENDPOINT!,
		credentials: {
			accessKeyId: process.env.DYNAMODB_ACCESS_KEY!,
			secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY!,
		},
	});

	try {
		for (const table of TABLES) {
			const log = `[DynamoDB] Imported ${table}`;
			console.time(log);

			await importDynamoDBTable(table, client);

			console.timeEnd(log);
		}
	} catch (error) {
		console.error("[DynamoDB] Error importing data:", error);
	} finally {
		client.destroy();
	}

	console.timeEnd(log);
}

async function importDynamoDBTable<TableName extends keyof typeof data>(table: TableName, client: DynamoDBClient) {
	// DynamoDB is really slow... Trying to squeeze out as much performance as possible.
	const BATCH_SIZE = 25;
	const CONCURRENT_BATCHES = 10;

	const tableData = data[table];
	const totalRows = tableData.length;

	for (let i = 0; i < totalRows; i += BATCH_SIZE * CONCURRENT_BATCHES) {
		const batchPromises: Promise<unknown>[] = [];

		for (let j = 0; j < CONCURRENT_BATCHES; j++) {
			const startIndex = i + j * BATCH_SIZE;
			if (startIndex >= totalRows) break;

			const batch = tableData.slice(startIndex, startIndex + BATCH_SIZE);
			if (batch.length === 0) break;

			const requestItems = {
				[table]: batch.map((row) => ({
					PutRequest: {
						Item: Object.entries(row).reduce((acc, [key, value]) => {
							if (typeof value === "number") {
								acc[key] = { N: value.toString() };
							} else if (value instanceof Date) {
								acc[key] = { S: formatDate(value) };
							} else {
								acc[key] = { S: value };
							}
							return acc;
						}, {}),
					},
				})),
			};

			batchPromises.push(
				client.send(
					new BatchWriteItemCommand({
						RequestItems: requestItems,
					}),
				),
			);
		}

		await Promise.all(batchPromises);
	}
}

// #endregion

function parseColumnValue<TableName extends keyof typeof data>(
	table: TableName,
	column: (typeof COLUMNS)[TableName][number],
	value: string,
) {
	switch (table) {
		case "nation": {
			switch (column) {
				case "N_NATIONKEY":
				case "N_REGIONKEY":
					return Number.parseInt(value, 10);
				default:
					return value;
			}
		}

		case "region": {
			switch (column) {
				case "R_REGIONKEY":
					return Number.parseInt(value, 10);
				default:
					return value;
			}
		}

		case "part": {
			switch (column) {
				case "P_PARTKEY":
				case "P_SIZE":
					return Number.parseInt(value, 10);
				case "P_RETAILPRICE":
					return Number.parseFloat(value);
				default:
					return value;
			}
		}

		case "supplier": {
			switch (column) {
				case "S_SUPPKEY":
				case "S_NATIONKEY":
					return Number.parseInt(value, 10);
				default:
					return value;
			}
		}

		case "partsupp": {
			switch (column) {
				case "PS_PARTKEY":
				case "PS_SUPPKEY":
				case "PS_AVAILQTY":
					return Number.parseInt(value, 10);
				case "PS_SUPPLYCOST":
					return Number.parseFloat(value);
				default:
					return value;
			}
		}

		case "customer": {
			switch (column) {
				case "C_CUSTKEY":
				case "C_NATIONKEY":
					return Number.parseInt(value, 10);
				case "C_ACCTBAL":
					return Number.parseFloat(value);
				default:
					return value;
			}
		}

		case "orders": {
			switch (column) {
				case "O_ORDERKEY":
				case "O_CUSTKEY":
				case "O_SHIPPRIORITY":
					return Number.parseInt(value, 10);
				case "O_TOTALPRICE":
					return Number.parseFloat(value);
				case "O_ORDERDATE":
					return new Date(value);
				default:
					return value;
			}
		}

		case "lineitem": {
			switch (column) {
				case "L_ORDERKEY":
				case "L_PARTKEY":
				case "L_SUPPKEY":
				case "L_LINENUMBER":
					return Number.parseInt(value, 10);
				case "L_QUANTITY":
				case "L_EXTENDEDPRICE":
				case "L_DISCOUNT":
				case "L_TAX":
					return Number.parseFloat(value);
				case "L_SHIPDATE":
				case "L_COMMITDATE":
				case "L_RECEIPTDATE":
					return new Date(value);
				default:
					return value;
			}
		}

		default:
			return value;
	}
}

function formatDate(date: Date) {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
