## Coworking Space API

Node.js + Express REST API for managing coworking tenants, workspace plans, meeting-room bookings, and an extras tab (coffee, printing, lockers). It mirrors the structure of the gym membership, airline and hotel booking APIs so all projects look and feel the same when bootstrapping or grading exams.

### Features
- JWT authentication with `admin` and `tenant` roles
- Admins create/delete tenants, assign workspace plans, view balances
- Admins manage the extras catalog (coffee, printing, lockers, other)
- Tenants pay for their plan, book rooms, buy extras, and settle their extras tab
- Extras ledger tracks owed vs. paid purchases (oldest entries are paid first)
- Room bookings reject overlapping times for the same room (409 Conflict)

### Tech Stack
- Node.js, Express, MongoDB, Mongoose
- JWT + bcryptjs for auth
- express-validator, CORS, dotenv
- Jest + Supertest + mongodb-memory-server for the test suite

### Project Structure
```
src/
  app.js           # Builds and exports the Express app (no side effects)
  server.js        # Connects to MongoDB and starts the HTTP server
  config/          # database + JWT helpers
  controllers/     # auth, tenant, extra, booking handlers
  middleware/      # protect (JWT) + authorize (role) guards
  models/          # User (with embedded plan + extras ledger), Extra, Booking
  routes/          # route definitions per resource
tests/             # Jest + Supertest integration tests (in-memory MongoDB)
```

### Getting Started
```bash
cd coworking-api
npm install
npm install -g nodemon
npm run dev
```

Visit `http://localhost:5005/` (default port) to confirm the server is up. It returns `{ "success": true, "message": "Coworking API is running" }`.

> **Note:** running the server (`npm start` / `npm run dev`) requires a reachable MongoDB instance at `MONGO_URI`. The automated tests do **not**: they spin up an in-memory MongoDB, so `npm test` works with no local database.

### Environment Variables
Create a `.env` file in the project root before running the server:
```
PORT=5005
MONGO_URI=mongodb://127.0.0.1:27017/coworking
JWT_SECRET=supersecret
JWT_EXPIRES_IN=30d
NODE_ENV=development
```

### Testing
```bash
npm test
```
The suite exercises every documented endpoint against an in-memory MongoDB: happy paths, authentication/role guards, validation, and booking conflicts.

To exercise the API manually, use Postman/Thunder Client. Seed an admin by registering with `"role": "admin"` (admin creation through `/api/auth/register` is intentionally open for this exam project).

---

## API Reference

Base URL: `http://localhost:5005`

All protected endpoints require an `Authorization: Bearer <token>` header. Tokens are returned by `/api/auth/register` and `/api/auth/login`.

### Auth
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create user (`role` optional: `admin` or `tenant`, defaults to `tenant`) |
| POST | `/api/auth/login` | Public | Issue JWT |
| GET | `/api/auth/me` | Authenticated | Current profile (incl. plan + extras balance) |

### Tenants (Admin)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/tenants` | Admin | List tenants |
| POST | `/api/tenants` | Admin | Create tenant |
| GET | `/api/tenants/:tenantId` | Admin | Tenant detail (extras ledger & plan) |
| POST | `/api/tenants/:tenantId/plan` | Admin | Assign/extend workspace plan |
| GET | `/api/tenants/:tenantId/balance` | Admin | Plan + extras balance overview |
| DELETE | `/api/tenants/:tenantId` | Admin | Hard delete tenant |

### Plan (Tenant)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/tenants/me/plan` | Admin or Tenant | View own plan |
| POST | `/api/tenants/plan/pay` | Tenant | Pay or renew plan (defaults to 30 days) |

### Extras & Balances
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/extras` | Admin | Add extra to catalog |
| GET | `/api/extras` | Authenticated | List extras |
| POST | `/api/extras/purchase` | Tenant | Add extra(s) to balance |
| POST | `/api/extras/pay` | Tenant | Settle extras balance |
| GET | `/api/extras/balance/me` | Tenant | View own extras balance & ledger |

### Bookings
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/bookings` | Tenant | Book a room (409 if it overlaps an existing booking) |
| GET | `/api/bookings` | Tenant (own) / Admin (all) | List bookings, sorted by start time |

### Allowed values
- Plan `planName`: `hot_desk`, `dedicated_desk`, `private_office`
- Plan `status`: `inactive`, `pending`, `active`, `expired`
- Extra `category`: `coffee`, `printing`, `locker`, `other`
- Booking `room`: `focus_room`, `meeting_room`, `conference_room`
- Booking `status`: `scheduled`, `completed`, `cancelled`

---

## Sample JSON Payloads & Responses

**Register Admin / Tenant**
```json
POST /api/auth/register
{
  "name": "Alex Admin",
  "email": "admin@cowork.io",
  "password": "Secret123",
  "role": "admin"
}
```
Response
```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": "6650f6...",
    "name": "Alex Admin",
    "email": "admin@cowork.io",
    "role": "admin"
  }
}
```

**Admin creates tenant**
```json
POST /api/tenants
{
  "name": "Tara Tenant",
  "email": "tara@cowork.io",
  "password": "Tenant123"
}
```

**Admin assigns plan**
```json
POST /api/tenants/{tenantId}/plan
{
  "planName": "dedicated_desk",
  "price": 199,
  "durationInDays": 30,
  "markPaid": true,
  "autoRenew": true
}
```

**Tenant pays plan**
```json
POST /api/tenants/plan/pay
{
  "planName": "hot_desk",
  "price": 99,
  "durationInDays": 30
}
```
Response
```json
{
  "success": true,
  "plan": {
    "planName": "hot_desk",
    "price": 99,
    "status": "active",
    "startDate": "2030-03-01T00:00:00.000Z",
    "endDate": "2030-03-31T00:00:00.000Z",
    "lastPaidAt": "2030-03-01T00:00:00.000Z",
    "autoRenew": false
  }
}
```

**Admin adds extra**
```json
POST /api/extras
{
  "name": "Flat White",
  "category": "coffee",
  "price": 3.5,
  "description": "Double shot"
}
```

**Tenant buys extras**
```json
POST /api/extras/purchase
{
  "extraId": "6650fb...",
  "quantity": 2
}
```
Response
```json
{
  "success": true,
  "message": "Extra added to balance",
  "extrasBalance": 7
}
```

**Tenant pays extras balance**
```json
POST /api/extras/pay
{
  "amount": 5
}
```
Response
```json
{
  "success": true,
  "extrasBalance": 2,
  "extrasLedger": [
    {
      "itemName": "Flat White",
      "quantity": 2,
      "unitPrice": 3.5,
      "subtotal": 7,
      "amountPaid": 5,
      "status": "partial"
    }
  ]
}
```

**Tenant books a room**
```json
POST /api/bookings
{
  "room": "meeting_room",
  "startsAt": "2030-01-05T09:00:00.000Z",
  "endsAt": "2030-01-05T10:00:00.000Z",
  "notes": "Client pitch"
}
```
Response
```json
{
  "success": true,
  "booking": {
    "_id": "66510a...",
    "tenant": "664ffb...",
    "room": "meeting_room",
    "startsAt": "2030-01-05T09:00:00.000Z",
    "endsAt": "2030-01-05T10:00:00.000Z",
    "status": "scheduled",
    "notes": "Client pitch"
  }
}
```

Overlapping booking for the same room → `409`:
```json
{ "success": false, "error": "Room is already booked for that time" }
```
