# WAS-K API

Enterprise NestJS backend for the WAS-K B2B supply chain ecosystem.

## Stack

- NestJS, TypeScript, Prisma, PostgreSQL
- JWT access tokens, refresh rotation, secure cookie support, Argon2
- RBAC and permission guards
- BullMQ and Redis for async jobs
- WebSockets for live order, stock and dashboard updates
- S3-compatible upload architecture
- Swagger/OpenAPI at `/docs`

## Local Development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis minio
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run start:dev
```

The REST API is versioned under `/api/v1`.

## Core Modules

- `auth`: login, register, refresh rotation, session lifecycle, password reset, email verification
- `users`: enterprise user model and active session tracking
- `business`: company onboarding, verification and operations
- `suppliers`: supplier catalog, verification and operational profile
- `products`: SKU catalog with filtering and search-oriented indexing fields
- `inventory`: warehouses, stock movements, history and low-stock analytics
- `orders`: transactional order creation, timeline and status transitions
- `logistics`: shipments, tracking and delivery states
- `analytics`: operational KPIs and dashboard summaries
- `notifications`: queue-backed notification delivery pipeline
- `audit`: immutable activity records for security and compliance

## Production Notes

Use managed PostgreSQL and Redis, rotate JWT secrets through your secret manager, enable TLS on ingress,
run `prisma migrate deploy` during release, and keep MinIO only for local development unless it is deployed
as a hardened S3-compatible service.


password: ChangeMe123!