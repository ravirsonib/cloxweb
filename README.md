# CLOX

Web application for every CLOX user: Super Admin, State, Local, Sender, Carrier, and Driver. CLOX is an Australia-first full-load freight marketplace.

The client lives in `app/`. It talks to the CLOX API and does not own business rules or authorization. Production host is `app.clox.com.au`.

What is built today is the Super Admin pre-launch workspace: email one-time sign-in, dashboard, lead review, and the activity log. Those screens call the API’s `/admin` routes. Other roles will be added in this same app.

## Stack

- Vite, React 19, TypeScript
- React Router
- TanStack Query, Zustand, Axios
- Tailwind CSS
- i18next (English and Hindi)

## Prerequisites

- Node.js 20 or later
- A running CLOX API (default `http://localhost:3000/v1`)

## Setup

```bash
cd app
copy .env.example .env
npm install
npm run dev
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

The dev server runs at [http://localhost:5174](http://localhost:5174).

## Scripts

Run these from `app/`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Typecheck the project |

## Environment

Copy `app/.env.example` to `app/.env`. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API base URL, including the `/v1` prefix |
| `VITE_APP_NAME` | Application name |
| `VITE_DEFAULT_LOCALE` | Starting locale (`en` or `hi`) |

## Routes

| Path | Screen |
| --- | --- |
| `/login` | Email OTP sign-in |
| `/` | Pre-launch dashboard |
| `/leads` | Lead queue, filters, and CSV export |
| `/leads/:id` | Lead detail, status, and internal notes |
| `/audit` | Activity log |

Signed-in routes require an access token. Unauthenticated visits redirect to `/login`.

## Layout

```text
app/
  src/
    app/          router and providers
    components/   shell, language switcher, status blocks
    lib/          HTTP client, API calls, i18n
    locales/      English and Hindi copy
    pages/        login, dashboard, leads, audit
    stores/       auth session
```
