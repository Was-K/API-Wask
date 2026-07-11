# CLAUDE.md — API-Wask (Backend)

> Contexto para asistentes de IA. Fuente de verdad del **contrato de API** para los 3 proyectos Wask.
> Los otros dos proyectos (`Wask-Business-App` web y `App-Frontend-Wask` móvil) consumen esta API.

## Qué es

API operacional de WAS-K construida en **NestJS + Prisma + PostgreSQL (Neon)**. Sirve a dos clientes:
- **Web de proveedores** (`Wask-Business-App`) → roles `ADMIN` y `BUSINESS_OWNER`.
- **App móvil** (`App-Frontend-Wask`, Flutter) → rol `CUSTOMER` (y `DELIVERY`).

Un `BUSINESS_OWNER` gestiona su tienda y productos desde la web; el `CUSTOMER` los ve y pide desde el móvil.

## Stack

- NestJS (módulos por dominio) + `@nestjs/swagger` (docs en `/docs`)
- Prisma ORM → PostgreSQL (Neon serverless)
- Auth JWT (access + refresh), guards por rol
- Helmet, cookie-parser, CORS
- Docker (`docker-compose.yml`, `Dockerfile`)

## Comandos

```bash
npm run start:dev      # desarrollo (watch)
npm run build          # compila a dist/
npm run start:prod     # producción
npx prisma migrate dev # aplicar migraciones
npx prisma studio      # explorar DB
npx prisma db seed     # seed (prisma/seed.ts)
```

## Convenciones CRÍTICAS del contrato de API

Estas reglas las asumen AMBOS frontends. No romperlas sin actualizar los 3 proyectos.

1. **Prefijo + versión**: todas las rutas viven bajo `/{API_PREFIX}/v1/...` → por defecto **`/api/v1`**
   (config en `main.ts`: `setGlobalPrefix('api')` + `enableVersioning URI defaultVersion '1'`).
2. **Envelope de respuesta** (via `ResponseTransformInterceptor`): toda respuesta exitosa se envuelve:
   ```json
   { "success": true, "data": <payload>, "timestamp": "ISO-8601" }
   ```
   Los errores pasan por `GlobalExceptionFilter`. Los frontends leen `data` y `message`.
3. **ValidationPipe global** con `whitelist: true` + `forbidNonWhitelisted: true`:
   → **cualquier campo del body que no esté en el DTO provoca 400**. Los frontends deben enviar EXACTAMENTE los campos del DTO.
4. **Auth**: `Authorization: Bearer <accessToken>`. Refresh vía `POST /auth/refresh-token` con `{ refreshToken }`. El refresh también se setea como cookie httpOnly.

## Estructura

```
src/
├── main.ts                # bootstrap, prefijo, versión, envelope, CORS, swagger
├── app.module.ts
├── common/                # decorators (CurrentUser, Roles, Public), guards (JwtAuth, Roles),
│                          # interceptors (ResponseTransform), filters (GlobalException)
├── gateways/              # websockets (tracking/logística)
└── modules/
    ├── auth/       business/   products/   orders/    inventory/
    ├── users/      dashboard/  analytics/  logistics/ notifications/
    ├── admin/      audit/      settings/   payments/  uploads/
    └── suppliers/  ← DEPRECADO (controlador vacío; reemplazado por business)
```

Cada módulo: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`.

## Enums (prisma/schema.prisma)

- `UserRole`: ADMIN | BUSINESS_OWNER | CUSTOMER | DELIVERY
- `UserStatus`: PENDING | ACTIVE | SUSPENDED | DISABLED
- `VerificationStatus`: PENDING | VERIFIED | REJECTED  (negocios)
- `OperationalStatus`: ACTIVE | PAUSED | SUSPENDED  (negocios)
- `ProductStatus`: DRAFT | ACTIVE | ARCHIVED
- `ProductApprovalStatus`: PENDING | APPROVED | REJECTED
- `OrderStatus`: PENDING | APPROVED | PROCESSING | SHIPPED | DELIVERED | CANCELLED
- Otros: `InventoryMovementType`, `ShipmentStatus`, `NotificationType/Status`, `PaymentStatus`

Modelos: User, Session, Business, Product, Warehouse, InventoryItem, InventoryMovement,
StockReservation, Order, OrderItem, OrderEvent, Shipment, Payment, Notification, AuditLog, etc.
**No existe modelo `Supplier`** — fue reemplazado por `Business`.

## Rutas por módulo (todas bajo /api/v1)

### auth  (todas `@Public` salvo change-password / validate-session)
- `POST /auth/register-customer`  → registro cliente (móvil). Body: `RegisterCustomerDto`
- `POST /auth/register-business-owner` → solicitud de negocio (web). Queda PENDING
- `POST /auth/login` · `POST /auth/refresh-token` · `POST /auth/logout` · `POST /auth/logout-global`
- `POST /auth/forgot-password` · `POST /auth/reset-password`
- `POST /auth/verify-email` · `POST /auth/resend-verification`
- `POST /auth/change-password` · `POST /auth/validate-session`
- ⚠️ **NO existe `POST /auth/register`** (el móvil lo llama por error — ver falencias).

### users
- `GET /users/me` · `GET /users` (ADMIN) · `GET /users/:id` · `PATCH /users/:id` · `DELETE /users/:id`

### business
- `POST /business` (ADMIN) · `GET /business` (ADMIN; filtros: verificationStatus, q, deleted)
- `GET /business/my-business` (BUSINESS_OWNER) · `PATCH /business/my-business`
- `PATCH /business/:id` (ADMIN) · `POST /business/:id/approve` · `POST /business/:id/reject`
- `DELETE /business/my-business` · `DELETE /business/:id` (ADMIN) · `POST /business/:id/restore`
- ⚠️ **NO existe `GET /business/:id`** ni endpoint público de tiendas para CUSTOMER (ver falencias).

### products
- `POST /products` (BUSINESS_OWNER; queda PENDING) · `POST /products/admin` (ADMIN)
- `GET /products` (ADMIN | BUSINESS_OWNER | CUSTOMER). CUSTOMER solo ve APPROVED+ACTIVE; BUSINESS_OWNER solo los suyos
- `GET /products/pending-approval` (ADMIN)
- `PATCH /products/:id` · `POST /products/:id/approve` · `POST /products/:id/reject` · `POST /products/:id/archive` · `DELETE /products/:id`
- ⚠️ **NO existe `GET /products/:id`** (ambos frontends lo llaman — ver falencias).

### orders
- `POST /orders` (CUSTOMER) · `GET /orders` (todos los roles, filtrado por rol)
- `GET /orders/business` (BUSINESS_OWNER) · `PATCH /orders/:id/status`

### inventory
- `POST /inventory/warehouses` · `POST /inventory/warehouses/admin` · `POST /inventory/items` · `POST /inventory/movements`
- `GET /inventory/my-inventory` · `GET /inventory/low-stock`

### otros
- `GET /dashboard/summary`
- `GET /analytics/summary` · `GET /analytics/orders` · `GET /analytics/inventory`
- `GET /admin/overview` · `GET /audit` · `GET /settings`
- `GET/POST /notifications`
- `POST /logistics/shipments` · `GET /logistics/shipments` · `PATCH /logistics/shipments/:id/status`
- `POST /payments/hooks`
- `suppliers` → **vacío/deprecado**, usar `business`.

## Variables de entorno (.env)

`NODE_ENV, PORT(3000), API_PREFIX(api), DATABASE_URL, REDIS_HOST/PORT,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL(15m), JWT_REFRESH_TTL(30d),
COOKIE_DOMAIN, SMTP_*, S3_*`

⚠️ **Seguridad**: `.env.example` no debe contener credenciales reales (actualmente tiene una cadena Neon real — reemplazar por placeholder).

## Estado de conexión (corregido 2026-07)

Resuelto en la última pasada de integración:
1. ✅ Agregado `GET /products/:id` (CUSTOMER solo APPROVED+ACTIVE, BUSINESS_OWNER solo el suyo, ADMIN todo).
2. ✅ Agregado `GET /business/shops` y `GET /business/shops/:id` (público CUSTOMER: solo VERIFIED+ACTIVE, campos seguros).
3. ✅ Agregado `GET /business/:id` (solo ADMIN, detalle completo — lo usa la web).
4. ✅ `.env.example` saneado (placeholder en `DATABASE_URL`).
   ⚠️ La credencial Neon anterior quedó en el historial de git → **rotarla en Neon**.
5. ✅ Móvil migrado: registro a `/auth/register-customer`, tiendas a `/business/shops`,
   pedidos envían solo `businessId` (no `supplierId`).

Notas de contrato a respetar:
- `CreateOrderDto` solo acepta `businessId`, `items`, `notes`, `deliveryAddress`.
- El módulo `suppliers` sigue **vacío/deprecado**: no agregar rutas ahí, usar `business`.

## Reglas de negocio clave

- Un `BUSINESS_OWNER` nuevo queda **PENDING** hasta aprobación de ADMIN; su negocio pasa por `VerificationStatus`.
- Un producto creado por BUSINESS_OWNER queda **PENDING** hasta aprobación; editar campos sensibles lo regresa a PENDING.
- CUSTOMER solo ve productos `APPROVED` + `ACTIVE`.
