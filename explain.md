## postgres

```sql
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
```

- guarda dados transacionais de clientes
- tem dados sensiveis (nome, email, morada, etc)
- tem dados de consentimento para marketing
- tem dados de transações (valor, data, etc)
- estamos a usar indices para performance etc.

- security:
  - existem varios roles de acesso (a nível de base de dados)
  - cada tabela tem uma coluna a indicar a classificação dos dados ('Public', 'Internal', 'Confidential', 'Restricted')
  - cada role tem permissões diferentes:
    - data_steward:
      - acesso total a todas as tabelas (READ-WRITE)
      - pode ver todos os dados
    - auditor:
      - READ-ONLY
      - pode ver alguns dados não considerados sensiveis (COLUMN LEVEL SECURITY), e de caracter ('Public', 'Internal')
    - marketing:
      - READ-ONLY
      - os dados de customers têm uma coluna que identifica se o cliente dá consentimento para marketing, e este user só consegue ver esses dados


## mongo

```js
await db.createCollection("api_keys", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["api_key", "type", "created_at"],
      properties: {
        api_key: { bsonType: "string", description: "Unique API key" },
        description: { bsonType: "string" },
        type: { bsonType: "string", enum: ["read", "write", "admin"] },
        data_classification: { bsonType: "string", enum: ["Public", "Internal", "Confidential", "Restricted"] },
        created_by: { bsonType: "string" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        expiration_date: { bsonType: "date" },
        last_used: { bsonType: ["date", "null"] },
        usages: { bsonType: "int" },
        allowed_ips: { bsonType: "array", items: { bsonType: "string" } },
        rate_limit: { bsonType: "int" },
      },
    },
  },
});

await db.createCollection("access_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["timestamp", "api_key", "endpoint"],
      properties: {
        timestamp: { bsonType: "date" },
        api_key: { bsonType: "string" },
        endpoint: { bsonType: "string" },
        method: { bsonType: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
        status_code: { bsonType: "int" },
        response_time_ms: { bsonType: "int" },
        ip_address: { bsonType: "string" },
        user_agent: { bsonType: "string" },
        request_body: { bsonType: ["object", "null"] },
        query_params: { bsonType: ["object", "null"] },
        accessed_resources: { bsonType: "array", items: { bsonType: "string" } },
      },
    },
  },
});
```

- guarda dados não estruturados (access logs) e api keys
- tem dados sensiveis (api keys)
- sempre que alguma coisa é acedida ao postgres, é guardado um log no mongo (tem timestamps, ip, recursos acedidos, etc)
- apesar do mongo ser não estruturado (documentos), estamos a usar uma validação de esquema para garantir que os dados estão sempre no mesmo formato
- estamos a usar indices para performance etc.

## dynamo

- guarda dados não estruturados (user prefs (pode ter flags dinamicas e assim))
- dadoos não sensiveis
