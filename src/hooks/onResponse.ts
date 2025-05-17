import type { FastifyRequest, FastifyReply } from "fastify";
import type { AccessLog } from "../schemas.ts";
import { saveAccessLog } from "../utils/access-logs.ts";

export async function onResponse(request: FastifyRequest, reply: FastifyReply) {
	if (!request.apiKeyData) {
		return;
	}

	const accessLog = {
		api_key: request.apiKeyData!.api_key,
		endpoint: request.url,
		method: request.method,
		ip_address: request.ip,
		elapsed_time_ms: reply.elapsedTime,
		user_agent: request.headers["user-agent"] || "",
		status_code: reply.statusCode,

		timestamp: request.requestContext.get("initialTime") ?? new Date(),
		accessed_resources: request.requestContext.get("accessedResources") ?? [],
		query_time_ms: request.requestContext.get("queryTime") ?? 0,
		validation_time_ms: request.requestContext.get("validationTime") ?? 0,
	} satisfies AccessLog;

	saveAccessLog(accessLog);
}
