import { accessLogsCollection } from "../lib/mongo.ts";
import type { AccessLog } from "../schemas.ts";

const MAX_BUFFER_SIZE = 5_000;
let requestedFlush = false;

const logsBuffer: AccessLog[] = [];

setInterval(async () => {
	await flushAccessLogs();
}, 60 * 1_000); // Every minute

export function saveAccessLog(accessLog: AccessLog) {
	logsBuffer.push(accessLog);

	if (logsBuffer.length >= MAX_BUFFER_SIZE && !requestedFlush) {
		flushAccessLogs();
		requestedFlush = true;
	}
}

export async function flushAccessLogs() {
	if (logsBuffer.length === 0) return;

	const logsToFlush = structuredClone(logsBuffer);

	try {
		await accessLogsCollection.insertMany(logsToFlush, {
			ordered: false,
			writeConcern: { w: 1 },
		});

		// Clearing the buffer only after a successful insert
		logsBuffer.splice(0, logsToFlush.length);
	} catch (error) {
		console.error("Error flushing access logs:", error);
		console.dir(error, { depth: Number.POSITIVE_INFINITY });
	} finally {
		requestedFlush = false;
	}
}
