# Al Khadim LLC — Platform Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Docker)

---

## Option A: Quick Start with Docker (Recommended)

```bash
# 1. Start all services (PostgreSQL + API + Web)
docker-compose up -d

# 2. Done! Access at:
#    Public website: http://localhost:3000
#    Admin panel:    http://localhost:3000/login
#    API:            http://localhost:5000/health
```

---

## Option B: Manual Setup (PostgreSQL already installed)

### 1. Install PostgreSQL
```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Create database
psql postgres -c "CREATE USER alkhadim_user WITH PASSWORD 'alkhadim_pass';"
psql postgres -c "CREATE DATABASE alkhadim_db OWNER alkhadim_user;"
```

### 2. Setup API
```bash
cd api
cp ../.env.example .env
# Edit .env with your DATABASE_URL if different

npm install
npx prisma generate
npx prisma db push          # Creates all tables
node prisma/seed.js         # Seeds admin user & sample data
npm run dev                 # Starts API on port 5000
```

### 3. Setup Web
```bash
cd web
npm install
npm run dev                 # Starts website on port 3000
```

---

## Default Login Credentials
- **URL**: http://localhost:3000/login
- **Email**: admin@alkhadim.ae
- **Password**: Admin@123

---

## Project Structure

```
Al - Khadim/
├── api/                    # Express.js Backend
│   ├── src/
│   │   ├── index.js        # App entry point
│   │   ├── middleware/     # Auth, upload, rate limiting
│   │   └── routes/         # All API routes
│   ├── prisma/
│   │   ├── schema.prisma   # Full database schema
│   │   └── seed.js         # Sample data
│   └── uploads/            # File storage
│
├── web/                    # Next.js Frontend
│   └── src/
│       ├── app/            # Pages (App Router)
│       │   ├── page.tsx    # Homepage (matching Al Khadim design)
│       │   ├── admin/      # Full admin dashboard
│       │   ├── careers/    # Public job listings
│       │   ├── register/   # Candidate registration
│       │   ├── enquiry/    # Client enquiry form
│       │   ├── services/   # Services page
│       │   ├── contact/    # Contact page
│       │   └── login/      # Login portal
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── Footer.tsx
│       │   ├── home/       # Homepage sections
│       │   └── admin/      # Admin UI components
│       └── lib/
│           ├── api.ts      # Axios client with refresh token
│           └── auth.ts     # Zustand auth store
│
└── docker-compose.yml      # One-command full stack
```

---

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/login, /api/auth/refresh, /api/auth/logout |
| Clients | GET/POST/PUT/DELETE /api/clients |
| Candidates | GET/POST/PUT/DELETE /api/candidates |
| Jobs | GET/POST/PUT/DELETE /api/jobs |
| Interviews | GET/POST/PUT/DELETE /api/interviews |
| Employees | GET/POST/PUT/DELETE /api/employees |
| Attendance | GET/POST/PUT /api/attendance |
| Leave | GET/POST/PUT/DELETE /api/leave |
| Payroll | GET/POST /api/payroll/process, PUT/POST /api/payroll/:id/approve |
| Outsourcing | GET/POST/PUT/DELETE /api/outsourcing |
| Documents | GET/POST/DELETE /api/documents |
| Follow-ups | GET/POST/PUT/DELETE /api/follow-ups |
| Invoices | GET/POST/PUT /api/invoices |
| Enquiries | POST /api/enquiries/public (no auth), GET/PUT /api/enquiries |
| Registrations | POST /api/registrations/public (no auth), GET/PUT /api/registrations |
| Dashboard | GET /api/dashboard/stats |
| Reports | GET /api/reports/revenue, /reports/payroll-summary |

---

## Production Deployment (Hostinger VPS)

```bash
# On server (Ubuntu)
apt install -y nodejs npm postgresql nginx

# Clone repo, setup .env with production values
# Setup Nginx to proxy localhost:3000 and localhost:5000
# Use PM2 for process management:
npm install -g pm2
pm2 start api/src/index.js --name alkhadim-api
pm2 start "cd web && npm start" --name alkhadim-web
pm2 save
pm2 startup

# SSL with Certbot
certbot --nginx -d alkhadim.ae -d www.alkhadim.ae
```

---

## Admin Roles

| Role | Access |
|------|--------|
| SUPER_ADMIN | Full access including user management |
| ADMIN | All modules except system settings |
| MANAGER | CRM, ATS, Reports |
| RECRUITER | Candidates, Jobs, Interviews |
| HR | Employees, Attendance, Leave, Payroll |
| ACCOUNTANT | Payroll, Invoices, Reports |
| VIEWER | Read-only access |
