import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const dynamoClient = new DynamoDBClient({
	region: process.env.DYNAMODB_REGION!,
	endpoint: process.env.DYNAMODB_ENDPOINT!,
	credentials: {
		accessKeyId: process.env.DYNAMODB_ACCESS_KEY!,
		secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY!,
	},
});

export function closeDynamoDBClient() {
	dynamoClient.destroy();
}
