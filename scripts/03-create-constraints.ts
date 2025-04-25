import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { Client as PostgresClient } from "pg";
import { DBGEN_DIR } from "./constants.ts";

const ri = await readFile(new URL("dss.ri", DBGEN_DIR), "utf-8");

await createPostgresConstraints();
await createMongoConstraints();

console.log("[DynamoDB] Constraints were created directly in the create-tables script");

async function createPostgresConstraints() {
	const client = new PostgresClient(process.env.POSTGRES_URI!);

	await client.connect();

	const riQuery = ri
		.replace(/CONNECT TO \w+;/i, "")
		.replaceAll("COMMIT WORK", "COMMIT")
		.replaceAll("TPCD.", "")
		.replaceAll(/ADD FOREIGN KEY (\w+)/gi, "ADD CONSTRAINT $1 FOREIGN KEY");

	await client.query(riQuery);

	await client.end();

	console.log("[PostgreSQL] Constraints created successfully");
}

async function createMongoConstraints() {
	const client = new MongoClient(process.env.MONGO_URI!);

	await client.connect();

	const db = client.db();

	// Primary keys
	await Promise.all([
		db.collection("region").createIndex({ R_REGIONKEY: 1 }, { unique: true }),
		db.collection("nation").createIndex({ N_NATIONKEY: 1 }, { unique: true }),
		db.collection("part").createIndex({ P_PARTKEY: 1 }, { unique: true }),
		db.collection("supplier").createIndex({ S_SUPPKEY: 1 }, { unique: true }),
		db.collection("partsupp").createIndex({ PS_PARTKEY: 1, PS_SUPPKEY: 1 }, { unique: true }),
		db.collection("customer").createIndex({ C_CUSTKEY: 1 }, { unique: true }),
		db.collection("lineitem").createIndex({ L_ORDERKEY: 1, L_LINENUMBER: 1 }, { unique: true }),
		db.collection("orders").createIndex({ O_ORDERKEY: 1 }, { unique: true }),
	]);

	await client.close();

	console.log("[MongoDB] Indexes created successfully");
}
