import { closeDynamoDBClient } from "../lib/dynamo.ts";
import { closeMongoClient } from "../lib/mongo.ts";
import { closePostgresPool } from "../lib/postgres.ts";
import { app } from "../server.ts";

export async function gracefulShutdown(signal: string) {
	app.log.info(`Received ${signal}. Shutting down gracefully...`);

	await Promise.allSettled([app.close(), closeMongoClient(), closePostgresPool(), closeDynamoDBClient()]);

	app.log.info("Server shut down.");
	process.exit(0);
}
