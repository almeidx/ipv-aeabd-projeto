import "@fastify/request-context";
import { z } from "zod";

declare module "fastify" {
	interface FastifyRequest {
		apiKeyData?: ApiKey;
	}
}

declare module "@fastify/request-context" {
	interface RequestContextData {
		accessedResources: string[];
		queryTime: number;
		validationTime: number;
		initialTime: Date;
	}
}

export const dataClassificationSchema = z.enum(["Public", "Internal", "Confidential", "Restricted"]);
export type DataClassification = z.output<typeof dataClassificationSchema>;

export const apiKeyPurposeSchema = z.enum(["Marketing", "Audit", "System"]);
export type ApiKeyPurpose = z.output<typeof apiKeyPurposeSchema>;

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
	query_time_ms: number;
	validation_time_ms: number;
	elapsed_time_ms: number;
	ip_address: string;
	user_agent: string;
	accessed_resources: string[];
}

export interface Customer {
	customer_id: number;
	first_name: string;
	last_name: string;
	email: string;
	phone: string | null;
	address_line1: string;
	address_line2: string | null;
	city: string;
	postal_code: string;
	country: string;
	nif: number;
	data_classification: DataClassification;
	consent_marketing: boolean;
	consent_date: Date | null;
	created_at: Date;
	updated_at: Date;
}
