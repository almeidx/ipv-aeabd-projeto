import { MongoClient } from "mongodb";
import assert from "node:assert";
import type { AccessLog, ApiKey } from "../schemas.ts";

assert(process.env.MONGO_URI, "MONGO_URI environment variable is not set.");
assert(process.env.MONGO_DB, "MONGO_DB environment variable is not set.");

const mongoClient = new MongoClient(process.env.MONGO_URI);

await mongoClient.connect();

const mongoDb = mongoClient.db(process.env.MONGO_DB);

export const apiKeysCollection = mongoDb.collection<ApiKey>("api_keys");
export const accessLogsCollection = mongoDb.collection<AccessLog>("access_logs");

export async function closeMongoClient() {
	await mongoClient.close();
}
