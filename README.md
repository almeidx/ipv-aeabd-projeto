# AEABD - Data Governance

Practical project of the Advanced Database Administration and Exploration course @ IPV 2025.

## Project structure

- `scripts/`: Contains the tools used to load the data into the databases.

## Setup

This assumes you have the following installed and setup:
- [Node.js](https://nodejs.org/en/download/) version 24.1.0 or higher
	- Corepack should be enabled. You can do this by running `corepack enable`.
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Start and load data into the databases

1. `corepack install`
1. `pnpm install --frozen-lockfile`
1. `./run.sh`

In order to change the size of the dataset being generated, you can tweak the `SCALE` constant in the `scripts/generate-data.ts` file.
Currently, it is set to `1`, which generates approximately `10MB` of data across all databases.

After changing the `SCALE`, stop the API, and simply run the `./run.sh` script again. Then restart the API.

### Run and test the API

1. `node --run start`
1. Grab one of the API keys from the MongoDB `api_keys` collection.
1. You can use a tool like [`hey`](<https://github.com/rakyll/hey>) to stress test the API.

```bash
hey -n 1 -c 1 -H "X-Api-Key: <key here>" http://localhost:3333/transactions/recent
```

You can change the values of `-n` and `-c` to increase the number of requests and concurrency, respectively.
