-- Runs once, when the Postgres container initialises an empty data volume
-- (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).
-- Creates a separate database for the test suite so tests never touch dev data.
CREATE DATABASE offerpath_test;
