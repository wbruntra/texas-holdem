=== DATABASE SCHEMA ===

Migrations are created with knex. DDL for all tables is created by running the script `read_db.js`. The output is located in the `tables` folder.

Each table has its own file named `<table-name>.js`. Please check there for the complete schema. This is more reliable than reading the DDL in the migration files, which may be out of date.

=== TESTING ===

Most tests are located in the `backend/tests` folder. They should be run with `bun test`. The test database may need to be set up using knex with the command `NODE_ENV=test knex migrate:latest` from the root directory.
