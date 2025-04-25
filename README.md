# AEABD - Data Governance

Practical project of the Advanced Database Administration and Exploration course @ IPV 2025.

## Project structure

- `scripts/`: Contains the tools used to load the data into the databases.
- `tpc-h/`: Contains the TPC-H data generator.

## Setup

### Generating data

1. `cd tpc-h/dbgen`
1. `make` - build TPC-H
1. `./dbgen -s 0.1 -f` - Generate 100MB of data

This will generate the following files:
- `customer.tbl`
- `lineitem.tbl`
- `nation.tbl`
- `orders.tbl`
- `part.tbl`
- `partsupp.tbl`
- `region.tbl`
- `supplier.tbl`

For the purposes of this project, we will only use the `customer.tbl`, `lineitem.tbl`, `orders.tbl`, and `part.tbl` files.

### Start and load data into the databases

This part requires Node.js version 23.11.0 or higher.

1. `docker compose up -d`
1. `corepack enable`
1. `corepack install`
1. `pnpm install --frozen-lockfile`
1. `node --run create-tables`
1. `node --run import-data`
1. `node --run create-constraints`
