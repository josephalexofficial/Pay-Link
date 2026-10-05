# Whimsey STK Push

> Customers pay Whimsey Technologies by entering a Safaricom number and an amount. The app sends an M-Pesa prompt and records the result for an admin.

## 1. System Overview and Key Capabilities

- **Pay page:** One screen collects the payer's name, a Safaricom phone number, and an amount in Kenyan shillings, then sends an STK prompt.
- **Result tracking:** Safaricom's callback marks the payment paid and stores the receipt. If that callback is late, the server asks Daraja with an STK query.
- **Admin:** One signed-in user sees every prompt, the payer's name, the full phone number, the amount, the status, and the M-Pesa receipt.

## 2. Architecture and Data Flow

```text
[Pay page] -> [POST /api/v1/payments] -> [Daraja STK Push] -> [Neon payments row]
[Safaricom] -> [POST /api/v1/stk-callbacks] -> [store callback and update status]
[Pay page poll] -> [GET /api/v1/payments/:checkoutRequestId] -> [STK Query only when no callback has arrived]
[Admin] -> [session cookie] -> [Neon]
```

The browser never receives the Daraja consumer secret or passkey. A final Safaricom callback marks the payment paid, cancelled, timed out, or failed and stores the M-Pesa receipt. The STK query is only used when that callback has not arrived.

## 3. Technology Stack

- **Runtime and language:** Node.js 20, TypeScript 5
- **Framework:** Next.js 16 App Router
- **Persistence and storage:** Neon Postgres via Drizzle ORM
- **Styling and UI:** Tailwind CSS 4, Jost
- **Infrastructure and deployment:** Vercel

## 4. Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Neon Postgres database
- Daraja production credentials for M-PESA Express: consumer key, consumer secret, and Lipa na M-Pesa passkey
- A public https callback URL

## 5. Local Development Setup

```bash
cd "Stk Push"
```

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:migrate
npm run db:seed
```

```bash
npm run dev
```

The pay page is at http://localhost:3000. Admin sign-in is at http://localhost:3000/admin/login.

On Windows PowerShell, copy the example env file with `Copy-Item .env.example .env`.

## 6. Environment Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | None | Neon Postgres connection string. |
| `MPESA_CONSUMER_KEY` | Yes | None | Daraja production consumer key. |
| `MPESA_CONSUMER_SECRET` | Yes | None | Daraja production consumer secret. |
| `MPESA_PASSKEY` | Yes | None | Lipa na M-Pesa Online passkey. |
| `MPESA_SHORTCODE` | No | `4329875` | Organization shortcode on the Daraja app. Used to sign the prompt. |
| `MPESA_TILL_NUMBER` | No | `4277642` | Buy Goods till that receives the payment. |
| `MPESA_CALLBACK_URL` | Yes | None | Public https URL ending in `/api/v1/stk-callbacks`. |
| `AUTH_SECRET` | Yes | None | Secret used to sign the admin session cookie. At least 32 characters. |
| `ADMIN_EMAIL` | Yes, for seed | None | Admin sign-in email. Used by `npm run db:seed` only. |
| `ADMIN_PASSWORD` | Yes, for seed | None | Admin password, at least 12 characters. Used by `npm run db:seed` only. |
| `ADMIN_NAME` | No | `Whimsey Admin` | Name stored on the admin row. |

Safaricom cannot call `http://localhost`. The pay page still opens locally. A real prompt needs `MPESA_CALLBACK_URL` to be a public https address, such as the Vercel deployment URL. Until that callback arrives, the pay page can still learn the outcome through the STK query.

## 7. Operational and Build Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Starts local development with hot reloading. |
| `npm run build` | Compiles the production build. |
| `npm run start` | Starts the production build. |
| `npm run lint` | Runs ESLint. |
| `npm run db:generate` | Writes a SQL migration from the Drizzle schema. |
| `npm run db:migrate` | Applies migrations to the database in `DATABASE_URL`. |
| `npm run db:seed` | Creates or updates the admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. |

## 8. License

Proprietary. Whimsey Technologies.
