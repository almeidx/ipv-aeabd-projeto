import { Pool } from "pg";
import assert from "node:assert";

assert(process.env.PG_DATA_STEWARD_USER_URI, "PG_DATA_STEWARD_USER_URI environment variable is not set.");
assert(process.env.PG_AUDITOR_USER_URI, "PG_AUDITOR_USER_URI environment variable is not set.");
assert(process.env.PG_MARKETING_USER_URI, "PG_MARKETING_USER_URI environment variable is not set.");

export const dataStewardPool = new Pool({ connectionString: process.env.PG_DATA_STEWARD_USER_URI });
export const auditorPool = new Pool({ connectionString: process.env.PG_AUDITOR_USER_URI });
export const marketingPool = new Pool({ connectionString: process.env.PG_MARKETING_USER_URI });

export async function closePostgresPool() {
	await Promise.allSettled([dataStewardPool.end(), auditorPool.end(), marketingPool.end()]);
}
