declare module "fastify" {
	interface FastifyRequest {
		apiKeyData?: ApiKey;
	}
}

export type ApiKeyPurpose = "Marketing" | "Audit" | "System";

export type DataClassification = "Public" | "Internal" | "Confidential" | "Restricted";

export interface ApiKey {
	api_key: string;
	description: string;
	purpose: ApiKeyPurpose;
	data_classification: DataClassification[];
	created_by: string;
	created_at: Date;
	updated_at: Date;
	expiration_date: Date | null;
	last_used: Date | null;
	usages: number;
	allowed_ips: string[];
	rate_limit: number;
}

export interface AccessLog {
	timestamp: Date;
	api_key: string;
	endpoint: string;
	method: string;
	status_code: number;
	response_time_ms: number;
	ip_address: string;
	user_agent: string;
	request_body: Record<string, any> | null;
	query_params: Record<string, any> | null;
	accessed_resources: string[];
}
