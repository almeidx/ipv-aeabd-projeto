export function convertDataClassificationToPgArray(dataClassification: string[]): string {
	// Convert the data classification array to a PostgreSQL array format
	return dataClassification.map((classification) => `'${classification}'`).join(",");
}
