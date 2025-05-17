import type { FastifyRequest, FastifyReply } from "fastify";
import { apiKeysCollection } from "../lib/mongo.ts";

export async function onRequestAuth(request: FastifyRequest, reply: FastifyReply) {
	const nowDate = new Date();
	request.requestContext.set("initialTime", nowDate);

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

	const startTime = performance.now();

	const apiKeyRecord = await apiKeysCollection.findOne({
		api_key: apiKey,

		$and: [
			{
				$or: [
					// Not expired
					{ expiration_date: null },
					{ expiration_date: { $gt: nowDate } },
				],
			},
			// {
			// 	$or: [
			// 		// Not IP restricted
			// 		{ allowed_ips: { $size: 0 } },
			// 		{ allowed_ips: { $in: [request.ip] } },
			// 	],
			// },
		],
	});

	request.requestContext.set("validationTime", performance.now() - startTime);

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
