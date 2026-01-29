# SHIRE

## What is this repo
SHIRE is a lightweight admin portal prototype for managing student applicants and student employees. It includes a frontend dashboard with tables, filters, and modals, plus a backend API with authentication, authorization, and data persistence.

I wrote this entire repo using codex. I made very minimal changes to the code at some points. 99% of the code was written by AI. I outlined API specs, database schema, and UI structure, and codex generated the implementation.

## What this repo does
- Provides an admin UI to review applicants, approve/deny, and reopen decisions.
- Manages eligibility rules (age, credit hours, citizenship, visa) with a settings panel.
- Tracks student employees, pay, hours worked, and status.
- Enforces role-based access (superadmin, admin, readonly) and session-based auth.
- Stores data in SQLite using Prisma.

## How to run locally
1. Install dependencies:
   - `cd back-end && npm install`
2. Run database migrations and seed data:
   - `npx prisma migrate dev`
   - `npm run seed`
3. Start the backend:
   - `npm start`
4. Open the frontend:
   - Open `front-end/shire-mock-up.html` in a browser

Optional: If you want to reset data, re-run `node scripts/seed-from-json.js`.

## API
All protected endpoints require a session token header:
- `x-session-token: <token>`

Auth:
- `PUT /login` → returns `{ token, live, name, level, username }`

Applicants:
- `GET /getAllUndecidedStudents`
- `GET /getAllAcceptedStudents`
- `GET /getAllDeniedStudents`
- `PUT /acceptStudent`
- `PUT /denyStudent`
- `PUT /reopenStudent`

Eligibility rules:
- `GET /getEligibilityRequirements`
- `PUT /modifyEligibilityRequirements` (superadmin only)

Admins:
- `PUT /addAdmin` (superadmin only)
- `DELETE /removeAdmin` (superadmin only)

Student employees:
- `GET /getStudentEmployees`
- `PUT /increasePay`
- `DELETE /fireStudent`
