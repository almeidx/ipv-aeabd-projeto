-- 1. Types

CREATE TYPE data_classification_enum AS ENUM ('Public', 'Internal', 'Confidential', 'Restricted');
CREATE TYPE transaction_status_enum AS ENUM ('Pending', 'Completed', 'Failed', 'Refunded');

-- 2. Tables

CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  first_name VARCHAR(64) NOT NULL,
  last_name VARCHAR(64) NOT NULL,
  email VARCHAR(320) UNIQUE NOT NULL,
  phone VARCHAR(13),
  address_line1 VARCHAR(128) NOT NULL,
  address_line2 VARCHAR(128),
  city VARCHAR(64) NOT NULL,
  postal_code VARCHAR(8) NOT NULL,
  country VARCHAR(64) NOT NULL,
  data_classification data_classification_enum DEFAULT 'Internal',
  consent_marketing BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
  transaction_id BIGINT PRIMARY KEY,
  customer_id INT NOT NULL,
  transaction_date TIMESTAMP NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status transaction_status_enum NOT NULL,
  data_classification data_classification_enum DEFAULT 'Confidential',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 3. Indexes

-- 3.1 Customers table indexes

CREATE UNIQUE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_customers_consent ON customers(consent_marketing) WHERE consent_marketing = TRUE;
CREATE INDEX idx_customers_data_class ON customers(data_classification);

-- 3.2 Transactions table indexes

CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_data_class ON transactions(data_classification);
CREATE INDEX idx_transactions_currency ON transactions(currency);

-- 4. Roles

CREATE ROLE data_steward;
CREATE ROLE auditor;
CREATE ROLE marketing;

-- 5. Users

CREATE USER data_steward_user WITH PASSWORD 'by5n25518wI4uM8Jhm84pfXv68MUVbr3';
CREATE USER auditor_user WITH PASSWORD 'MqX1KQ9OU0pkRZ29AtYHns4b1aB2M49a';
CREATE USER marketing_user WITH PASSWORD 'V8s2f64100Pr9JFi7X6oB3Id67U0u5g6';

GRANT data_steward TO data_steward_user;
GRANT auditor TO auditor_user;
GRANT marketing TO marketing_user;

-- 6. Row-Level Security

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 6.1 Customers table policies

CREATE POLICY marketing_access ON customers
FOR SELECT
TO marketing
USING (consent_marketing = TRUE);

CREATE POLICY steward_full_access ON customers
FOR ALL
TO data_steward
USING (true)
WITH CHECK (true);

CREATE POLICY auditor_read_access ON customers
FOR SELECT
TO auditor
USING (data_classification IN ('Public', 'Internal'));

-- 6.2 Transactions table policies

CREATE POLICY steward_transactions ON transactions
FOR ALL
TO data_steward
USING (true)
WITH CHECK (true);

CREATE POLICY auditor_transactions_read ON transactions
FOR SELECT
TO auditor
USING (data_classification IN ('Public', 'Internal'));

CREATE POLICY marketing_transactions_access ON transactions
FOR SELECT
TO marketing
USING (customer_id IN (SELECT customer_id FROM customers WHERE consent_marketing = TRUE));

-- 7. Column-Level Security

-- 7.1 Marketing role permissions

GRANT SELECT (customer_id, first_name, last_name, email, country, consent_marketing, consent_date)
ON customers TO marketing;

GRANT SELECT (transaction_id, customer_id, transaction_date, amount, currency, status)
ON transactions TO marketing;

-- 7.2 Auditor role permissions

GRANT SELECT (customer_id, first_name, last_name, city, country, data_classification, consent_marketing, consent_date, created_at, updated_at)
ON customers TO auditor;

GRANT SELECT (transaction_id, customer_id, transaction_date, currency, status, data_classification, created_at)
ON transactions TO auditor;

-- 7.3 Data steward role permissions

GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO data_steward;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO data_steward;
