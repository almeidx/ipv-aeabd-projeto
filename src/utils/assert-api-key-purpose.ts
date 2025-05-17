import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiKeyPurpose } from "../schemas.ts";

export function assertApiKeyPurpose(
	app: FastifyInstance,
	request: FastifyRequest,
	wantedPurpose: ApiKeyPurpose,
): asserts request is FastifyRequest & { apiKeyData: { purpose: ApiKeyPurpose } } {
	if (!request.apiKeyData) {
		throw app.httpErrors.unauthorized("API key data is missing");
	}

	if (request.apiKeyData.purpose !== wantedPurpose) {
		throw app.httpErrors.forbidden("API key does not have the required purpose");
	}
}
