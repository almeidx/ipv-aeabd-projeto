import type { FastifyRequest, FastifyReply } from "fastify";
import { apiKeysCollection } from "../lib/mongo.ts";

export async function onRequestAuth(request: FastifyRequest, reply: FastifyReply) {
	// public-ish endpoints
	if (
		request.url === "/" ||
		(request.url === "/admin/api-keys" && request.method === "POST" && request.ip === "127.0.0.1") // security is my passion
	) {
		return;
	}

	const apiKey = request.headers["x-api-key"] as string;
	if (!apiKey) {
		reply.status(401).send({ error: "X-API-Key header is missing" });
		return;
	}

	const apiKeyRecord = await apiKeysCollection.findOne({
		api_key: apiKey,

		$or: [
			[
				// Not expired
				{ expiration_date: null },
				{ expiration_date: { $gt: new Date() } },
			],
			[
				// Not IP restricted
				{ allowed_ips: { $len: 0 } },
				{ allowed_ips: { $in: [request.ip] } },
			],
		],
	});

	if (!apiKeyRecord) {
		reply.status(403).send({ error: "Invalid or unauthorized API Key" });
		return;
	}

	request.apiKeyData = apiKeyRecord;

	await apiKeysCollection.updateOne(
		{ api_key: apiKey },
		{
			$set: {
				last_used: new Date(),
				usages: apiKeyRecord.usages + 1,
			},
		},
	);
}
