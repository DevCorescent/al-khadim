# Al Khadim — Panel-by-Panel Manual Testing Guide

Purpose: click through every panel of the app and confirm the new backend (`src/app/api/**` → `src/server/controllers/**`) works with the existing frontend.

How to use this guide:
- Work top to bottom. Section 2 gives an order that builds data step by step, so later panels have something to show.
- Tick `- [ ]` boxes as you go. Record failures in the checklist at the end (section 10) with the URL, what you clicked, the toast text, and the failing request from DevTools.
- **✅ Expected** lists what should happen, including where the result should appear elsewhere.
- Labels in **bold** are the exact on-screen button, tab or menu text.

## 0. Test accounts

Created by `npm run db:seed` (demo accounts are skipped with `SEED_DEMO_DATA=false`). Change or delete the demo accounts before going live.

| Panel | Login URL | Email | Password | Role |
|---|---|---|---|---|
| Admin | `/login` | `admin@alkhadim.ae` | `Admin@123` | SUPER_ADMIN (everything) |
| Admin | `/login` | `admin@demo.alkhadim.ae` | `Admin#Khadim26` | ADMIN (all modules; no user delete, no AI settings/roles editing) |
| Admin | `/login` | `manager@demo.alkhadim.ae` | `Manager#Khadim26` | MANAGER (CRM, candidates, jobs, interviews, leave approval, reports) |
| Admin | `/login` | `recruiter@demo.alkhadim.ae` | `Recruiter#Khadim26` | RECRUITER (candidates, jobs, interviews, documents) |
| Admin | `/login` | `hr@demo.alkhadim.ae` | `HrTeam#Khadim26` | HR (employees, attendance, leave, payroll view) |
| Admin | `/login` | `accountant@demo.alkhadim.ae` | `Accounts#Khadim26` | ACCOUNTANT (payroll, invoices, finance, reports) |
| Admin | `/login` | `viewer@demo.alkhadim.ae` | `Viewer#Khadim26` | VIEWER (read-only: dashboard, candidates, jobs, clients, reports) |
| Candidate portal | `/candidate/login` | `rajesh.kumar@example.com` | `Candidate#Khadim26` | Candidate "Rajesh Kumar" |
| Company portal | `/company/login` | `company@demo.alkhadim.ae` | `Company#Khadim26` | COMPANY_ADMIN of "Emirates Group" |

Exact access per role is on **Settings → Users → Roles & Permissions**; the sidebar only shows what the logged-in user may open, and forbidden actions show "You don't have permission to do that".

---

## 1. Setup

### 1.1 Start the app
- [ ] From `web/`: `npm install` (first time only). This also runs `prisma generate`.
- [ ] Apply migrations: `npm run db:deploy`.
- [ ] Seed: `npm run db:seed`.
- [ ] Start: `npm run dev` and open **http://localhost:3000**.
  - Use `localhost`, not `127.0.0.1`. `.env` sets `NEXT_PUBLIC_API_URL=http://localhost:3000`. Tokens are kept in `localStorage`, which is separate for each origin.
- [ ] **Restart `npm run dev` after any `.env` change.** `NEXT_PUBLIC_*` values are compiled into the frontend. Server env such as `SMTP_*`, `OPENAI_API_KEY` and `WEB_URL` is only read at startup.

### 1.2 Seed data and resets
- `npm run db:seed` is **idempotent and never overwrites**. It only inserts missing rows, so it will not undo your test edits.
- For a **full reset**, run `npx prisma migrate reset`. It drops the database, re-applies migrations and runs the seed. All test data is lost.
- The seed provides:

  | Data | What's seeded |
  |---|---|
  | Staff | `admin@alkhadim.ae` / `Admin@123` (SUPER_ADMIN). The login page is pre-filled with these. |
  | Industries (14) | 4 with tracking: General, Construction, Oil & Gas, Healthcare / Medical. Their **tracking templates are empty** until you build one (section 4.4). 10 plain ones, e.g. Technology, Aviation, Finance. |
  | Categories (10) | Technology, Engineering, Finance, HR, Marketing, Sales, Operations, Legal, Design, Other |
  | Email templates (16) | transactional templates (OTP, welcome, invites, share notifications …) |
  | Clients | "Emirates Group" (`hr@emirates.ae`) and "ADNOC Group" (`hr@adnoc.ae`). Both APPROVED, with **no portal users**. |
  | Jobs (3, OPEN, published) | Senior Software Engineer, HR Manager, Civil Engineer |
  | Candidates | Rajesh Kumar (SHORTLISTED), Maria Santos (INTERVIEW_SCHEDULED). Neither has a portal account. |

### 1.3 Environment facts that change what you'll see

**No SMTP, so no email is delivered.**
- Every email is logged in the terminal running `npm run dev`:
  ```
  [mailer] SMTP not configured — emails are logged, not delivered.
  [mailer:<module>] (dev) <from> -> <to> | <subject>
  ```
- Only the subject line is printed, not the body.
- Each email is also saved in the DB (`ScheduledEmail`, with the HTML body) and shows up in **Admin → Emails → History** with status SENT.
- Links that normally arrive by email are not shown anywhere in the UI. This covers the company invite link and the public share link. Get them from the DB:
  - Run `npx prisma studio` (opens a DB browser at http://localhost:5555).
  - **Company invite link:** table `ClientUser`, column `inviteToken`. Open `http://localhost:3000/company/accept-invite/<inviteToken>`.
  - **Public share link:** table `ProfileShare`, column `accessToken`. Open `http://localhost:3000/company/view/<accessToken>`.
  - Alternatively, open the `ScheduledEmail` row and read the link from `html`.

**The OTP code is shown on screen** (candidate and company registration).
- `POST /api/otp/send` returns a `devCode` when SMTP isn't configured.
- A toast says **"SMTP not configured — showing the code directly below"**.
- An amber box headed **"Dev mode — SMTP not configured"** reads "Your code is **NNNNNN** (pre-filled below)". The 6-digit input is already filled.
- Click **Verify Code**. ✅ Toast "Email verified".
- Limits:
  - Resend is disabled for 60 s (**Resend code in Ns**).
  - Max 5 sends per hour per email.
  - Max 5 wrong attempts.
  - Codes expire after 10 min.
- Always use the code from the amber box. Do **not** rely on any fixed bypass code.

**Portal sessions last 15 minutes.**
- Candidate and company portal access tokens expire after 15 min, and the portals don't refresh them.
- After that, lists go empty or pages keep loading, and Network shows 401 "Token expired".
- **Log out and back in**, then carry on, and log it as a known issue (§9). The admin panel does refresh its token.

**No OpenAI key, so the AI features return errors.**
- Admin AI drawer (bot icon in the header): sending a message shows a red toast **"AI assistant is not configured"** and the same text in a red box under the reply. No conversation is saved.
- Public AI widget (floating round button, bottom-right on public pages only): the reply is "The assistant is taking a break right now — feel free to browse our careers page or reach out via the contact form." The API returns 503 "The assistant is currently unavailable".
  - Once a key is added, the public widget also needs **Enable public homepage assistant** in Settings → AI, or `OPENAI_PUBLIC_ENABLED=true` in the env.
- Admin → Settings → AI Assistant shows the banner "Not configured — the assistant will return an error to users until a key is set."

**Uploads**
- Files go to `web/uploads/<images|documents|misc>/<uuid>.<ext>`.
- They are served back at `http://localhost:3000/uploads/...`.
- After each upload test, check that a new file exists in that folder.

### 1.4 How to spot API errors
- Keep **DevTools → Network** open, filtered to **Fetch/XHR**. Every call goes to `/api/...`.
  - 4xx/5xx rows are failures. Click one and read **Response** for the `{ "error": "..." }` message.
- Failures normally show as a **red toast** (react-hot-toast, top of the screen) with the backend's `error` text.
- A few actions have **no error toast** at the time of writing: payroll **Approve**, leave approve/reject, employee delete, user delete on Settings. For these, always confirm in the Network tab that the response was 2xx.
- **401 on an admin page:** the client silently refreshes the token once. If that fails you are sent back to `/login`.
- **Server errors:** read the `npm run dev` terminal for stack traces (`console.error`) and the `[mailer...]` lines.

---

## 2. Recommended test order

Each step creates data that later steps use.

1. **Login and Settings**: General settings, Categories, Industries, one **tracking template**, Email and AI pages (expect "not configured").
2. **Team**: create one test user per role. You'll use them in section 8.
3. **CRM**: add a client, deal, follow-up and activity. Submit a **public enquiry**, then convert it to a deal.
4. **Recruitment, jobs**: add or edit a job order and toggle publish. Check `/careers`.
5. **Candidates**:
   - Admin **Add Candidate** and **Import from CV**.
   - Public `/register` and `/candidate/register`, then approve them in **CV Registrations**.
   - Log in to the candidate portal.
6. **Interviews**: schedule, edit and rate one.
7. **Company portal**:
   - `/company/register`, then approve in CRM, then log in.
   - Post a job request, then publish it in admin.
   - Invite a teammate and accept the invite.
8. **Profile shares**:
   - Share a candidate with the approved company.
   - The company views it and responds with **Request Interview**.
   - Admin **Schedule Now**.
   - Check the candidate portal and the public `view/[token]` link.
9. **Candidate tracking and document requests**: fill tracking, request a document, candidate uploads it, verify, make it visible to the company.
10. **Profile requests**: submit from the public talent pool, then work it in admin.
11. **HRMS**: employees, then attendance (with overtime), leave, outsourcing, documents.
12. **Finance**:
    - Bank accounts, then invoice (quotation, proforma, invoice), expenses (approve and pay).
    - **Payroll** month (process, approve, pay from an account).
    - Budgets, then Finance overview.
13. **Emails**: compose, templates, groups, campaigns, history.
14. **Reports and Dashboard** last, so the numbers are non-zero.
15. **Site Editor** (changes the public site; do it last or revert afterwards).
16. **Role checks** (section 8).

---

## 3. Admin: login, shell, dashboard

### 3.1 Login — `/login`
- [ ] Open `/login`. ✅ Heading **Sign In**, fields **Email Address** and **Password**, pre-filled with the seed admin.
- [ ] Clear both fields and click **Sign In**. ✅ Toast "Please enter email and password".
- [ ] Wrong password. ✅ Red toast "Invalid credentials", with a 401 on `POST /api/auth/login`.
- [ ] Correct credentials. ✅ Toast "Welcome back!" and a redirect to `/admin`.
- [ ] Refresh the page. ✅ You stay logged in.
- [ ] Open `/admin` in a private window. ✅ Redirect to `/login`.

### 3.2 Shell: sidebar, header, logout
- [ ] Sidebar groups:
  - **Dashboard**
  - **CRM** (Deals, Clients, Follow-Ups, Enquiries)
  - **Finance** (Overview, Invoices, Expenses, Payroll, Accounts, Budgets)
  - **Recruitment** (Candidates, Job Orders, Interviews, CV Registrations, Profile Requests, Profile Shares, Candidate Tracking)
  - **HRMS** (Employees, Attendance, Leave)
  - **Outsourcing**, **Documents**, **Emails**, **Reports**
  - **Team** (Users, Roles & Perms)
  - **Site Editor**
  - **Settings** (General, Categories, Industries, Email, AI Assistant)
- [ ] **Collapse** button (desktop): the sidebar shrinks to icons with hover flyouts, and the state survives a refresh.
- [ ] Mobile width: a bottom nav appears (Dashboard, Candidates, Jobs, Clients, **More**), and More opens the drawer.
- [ ] Header:
  - The breadcrumb updates per page.
  - The bot icon opens the AI drawer (section 4.44).
  - The avatar links to `/admin/settings`.
  - The header search box and the bell are placeholders with no function. Don't file these as backend bugs.
- [ ] **Sign Out** (sidebar footer). ✅ Returns to `/login`, and `/admin` redirects to login again.

### 3.3 Dashboard — `/admin`
- **Precondition:** best run again at the end (step 14).
- [ ] The page loads with no red toast. `GET /api/dashboard/stats` returns 200.
- [ ] **Financial Overview**: Revenue, Paid Revenue, Pending Collection, Overdue Invoices, and Collection Rate once invoices exist.
- [ ] **Operations Overview**: Total Candidates, Active Clients, Open Jobs, Active Employees, Pending Follow-Ups, Pending Leaves, Expiring Docs, New This Month.
- [ ] Charts: **Monthly Revenue** ("No invoice data yet" when empty) and **Candidates by Status**.
- [ ] Lists: **Recent Candidates** and **Recent Clients**. Each client's **View** opens `/admin/crm/clients/:id`.
- ✅ After the full run, counts match what you created. For example, Total Candidates = 2 seeded + yours, Pending Leaves = leaves still PENDING, and Expiring Docs includes a document with an expiry under 30 days.

---

## 4. Admin panel, page by page

### Settings

#### 4.1 General — `/admin/settings`
- [ ] **My Profile** card shows your name, email and role.
- [ ] **Change Password**: enter a wrong Current Password. ✅ Error "Current password is incorrect".
- [ ] Enter the correct current password and a new one (at least 8 characters), then **Update**. ✅ Toast "Password changed".
  - Log out and in with the new password, then change it back.
- [ ] **General Settings**: change Company Name, Dashboard Currency (the symbol auto-fills) and Date Format, then **Save Settings**.
  - ✅ Toast "Settings saved". `PUT /api/site-config/general` returns 200. Values persist after a refresh.
- [ ] **User Management** table: **Add User** (Full Name, Email, Password, Role, Phone).
  - ✅ The user appears here and in Team → Users.
  - Your own row shows **You** instead of actions.

#### 4.2 Categories — `/admin/settings/categories`
- [ ] 10 seeded categories are listed.
- [ ] **Add Category** (Name *, Description, Color). ✅ It appears, and is selectable in the Job and Candidate forms.
- [ ] Add a duplicate name. ✅ Error "A category with this name already exists".
- [ ] Edit (pencil) and save.
- [ ] Delete a category used by a job or candidate. ✅ 409 "Cannot delete — still used by …".
- [ ] Delete an unused category. ✅ It is removed.
- [ ] Import icon: download the **Template**, fill 2 rows, then **Import N rows**. ✅ Status per row, plus "Imported X of Y rows".
- [ ] Export icon: **CSV**, **Excel (XLSX)** and **PDF** each download a file.

#### 4.3 Industries — `/admin/settings/industries`
- [ ] 14 industries are listed. The 4 tracking industries show **Configure Template** in the Tracking column; the rest show "Off".
- [ ] **Add Industry**: Name, Description, Color, and tick **Enable SOP/KPI tracking for this industry**. ✅ A key is auto-generated (shown in monospace).
- [ ] Edit: the modal shows "Machine key: X (fixed once created)".
- [ ] Delete an industry in use. ✅ 409 "Cannot delete — still used by …".

#### 4.4 Industry tracking template — `/admin/settings/industries/[id]/template`
- **Precondition:** open **Configure Template** for "Oil & Gas".
- [ ] **Add Section**, rename it (e.g. "Certifications"), then **Add Field** several times, using different types:
  - text, date, boolean
  - select (options "Yes, No, N/A")
  - checklist (items + status options)
  - table (**Add column** ×2)
- [ ] Reorder with the up/down icons. The **Live Preview** updates.
- [ ] **Save Template**. ✅ Toast "Template saved". After a refresh the structure is still there.
- ⚠ In the table-column editor, the label input may lose focus after the first keystroke (known UI issue). Click back in and keep typing.
- ✅ Later, the template appears as tabs on a candidate's **tracking** tab (4.25).

#### 4.5 Email / SMTP — `/admin/settings/email`
- [ ] Banner: "Live: no SMTP configured anywhere — outgoing emails are only logged to the server console, not delivered."
- [ ] Tick **Enable custom SMTP** with SMTP Host empty, then **Save Settings**. ✅ Error "Host is required to enable SMTP".
- [ ] **Send a Test Email** with an address and no settings. ✅ Error "No SMTP settings are saved and enabled yet …".
- [ ] If you have real SMTP credentials, save them and re-test. ✅ "Test email sent to …". **Untick and save again afterwards** if the rest of the run should stay in dev mode. Otherwise OTP codes will no longer be shown on screen.

#### 4.6 AI Assistant settings — `/admin/settings/ai` (SUPER_ADMIN only)
- [ ] Banner "Not configured — …".
- [ ] Tick **Enable internal assistant** with no API key, then **Save Settings**. ✅ Error "An API key is required to enable the assistant".
- [ ] **Test Connection** with no key. ✅ "No API key is saved yet — enter a key and test before saving."
- [ ] Model list shows gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini and gpt-3.5-turbo. Temperature, Max Tokens, the two rate limits and the Extra system prompt field are present.

### Team

#### 4.7 Users — `/admin/users`
- [ ] Tiles: Total Users, Active, Inactive, Custom Roles.
- [ ] **New User**: Full Name, Email, Phone, Department, Password (min 8), **System Role** buttons (7 roles), optional **Custom Role Label**.
  - ✅ Toast "User created!" and a new card appears.
  - Create one user for each role now (see section 8 for the list).
- [ ] **Edit**: change the department. ✅ "User updated!".
- [ ] **Reset PW**: set a new password. ✅ "Password reset!".
  - Log in as that user with the new password (in a private window).
- [ ] **Disable** a user (SUPER_ADMIN only). Log in as them. ✅ 401 "Invalid credentials"; disabled accounts can't log in.
  - **Enable** again.
- [ ] Try to disable or delete yourself. ✅ Buttons are hidden, or the backend refuses.
- [ ] Delete a test user. Confirm "Delete <name>? This cannot be undone." ✅ The user is removed. A user who owns records gets a 409 suggesting deactivation instead.
- [ ] Search box and **All Roles** filter narrow the list.

#### 4.8 Roles & Perms — `/admin/users/roles`
- [ ] **System Roles (built-in)**: 7 cards that expand to show their preset.
- [ ] **New Custom Role**:
  - Role Name, Description, Badge Color.
  - Permissions grid with **Quick set** (ADMIN/MANAGER/…) and **Clear all**.
  - Save with **Create Role**.
  - ✅ The card appears with "N permissions granted".
- [ ] **Edit** and **Delete** a custom role.
- ℹ The custom role is only a *label* you can assign in Users. Access is decided by the **System Role** (section 8).

### CRM

#### 4.9 Clients — `/admin/crm`
- [ ] Two seeded clients are shown. Stat cards: Total Clients, Active, Total Revenue, Open Jobs.
- [ ] Filters:
  - Search.
  - Industry.
  - Status (All Status / Active / Inactive).
  - Approval (All Approvals / **Pending Approval** / Approved / Rejected).
  - Grid/List toggle.
- [ ] **+ Add Client**:
  - Required: Company Name, Contact Person, Email, Phone.
  - Optional: Alt Phone, Country, City, Address, Website, Notes, Industry, Source (Other shows "Specify source"), Status.
  - ✅ The client appears as Approved and Active.
- [ ] Edit (pencil) and save.
- [ ] Delete a client that has jobs or invoices. ✅ 409 "This client has linked records … Deactivate it instead."
- [ ] Import icon (Template, then rows), and Export.

#### 4.10 Client detail — `/admin/crm/clients/[id]`
- [ ] Open "Emirates Group" with **View Details**.
- [ ] Tags: type in **+ Add tag** and press Enter. ✅ The tag persists after a refresh. Remove it with ×.
- [ ] Tabs, each loading without error:
  - **Overview**: KPIs and charts.
  - **Deals**.
  - **Jobs**: 2 seeded jobs, each with **View**.
  - **Invoices**, **Follow-Ups**, **Enquiries**, **Placements**.
  - **Timeline**.
  - **Shared Candidates**.
  - **Portal Users**.
- [ ] **Deals** tab: **New Deal** (Title *, Value, Currency, Expected Close Date), then **Create Deal**. ✅ "Deal created", and the deal shows on the CRM → Deals board as **Lead**.
- [ ] **Timeline** tab: pick Note/Call/Meeting/Email/Task, write text, then **Log**. ✅ "Activity logged" and the entry is listed.
- [ ] **Portal Users** tab: **Invite Portal User** (Name, Email, Role Company Admin/Member), then **Send Invite**.
  - ✅ "Invite sent" and a row with an **Invite Pending** badge.
  - The terminal logs a mail to that address.
  - Get the link from Prisma Studio (§1.3) and test it in 5.16.
- [ ] Resend (send icon) and toggle active (power icon) on that portal user.
- ⚠ **Edit Client** and **+ Invoice** in the header are known not to open an edit modal or a pre-filled invoice. Note them and move on.
- **Pending company approval** (after 5.10 company registration):
  - Filter Approval = **Pending Approval** and open the company.
  - An amber banner shows with **Reject** / **Approve Company**.
  - [ ] **Approve Company**. ✅ Toast "Company approved", the badge disappears, and the terminal logs `client-profile-approved`.
  - [ ] (Separate test company) **Reject** with a reason. ✅ A red banner shows the reason plus **Approve Anyway**, and the company portal shows the rejection screen.

#### 4.11 Deals — `/admin/crm/deals`
- [ ] **Deal Pipeline** kanban: Lead, Qualified, Proposal Sent, Negotiation, Won, Lost. KPIs: Total Open Value, Weighted Forecast, Win Rate, Open Deals.
- [ ] **New Deal**:
  - Client (auto-fills the title), Deal Title, Value, Currency, Stage, Expected Close, Owner.
  - Save with **Create Deal**.
  - ✅ It opens the deal detail page.
- [ ] Drag a card to another column. ✅ The stage persists after a refresh, and the KPIs change.
- [ ] Drag to **Lost**. ✅ Modal "Mark Deal as Lost"; **Confirm Lost** stays disabled until a Loss Reason is entered.
- [ ] Filters: search, Owner, **Filter by tag…**.
- **Deal detail `/admin/crm/deals/[id]`:**
  - [ ] Edit the title inline (pencil, then ✓).
  - [ ] **Advance to …**. ✅ The stage changes and the timeline gets a STAGE_CHANGE entry.
  - [ ] **Mark Won** on another deal. ✅ Won, with probability 100.
  - [ ] The trash icon opens **Delete Deal**; confirm. ✅ Redirect to the board.

#### 4.12 Follow-Ups — `/admin/crm/follow-ups`
- [ ] **Add Follow-Up**: Subject *, Type (CALL/EMAIL/MEETING/WHATSAPP/OTHER), Due Date *, Client, Notes. Then **Save**. ✅ "Follow-up created".
- [ ] Check icon. ✅ "Marked complete", and the row moves to the **Completed** pill.
- [ ] Delete a pending one.
- ⚠ The **All** pill currently shows only pending follow-ups (known issue). Note it.
- ✅ The dashboard's **Pending Follow-Ups** count and the client's Follow-Ups tab reflect these.

#### 4.13 Enquiries — `/admin/crm/enquiries`
- **Precondition:** submit the public enquiry form first (6.6).
- [ ] The enquiry row shows: Company, Contact, Email, Phone, Service Required, Message, Status NEW, Date.
- [ ] Change the status dropdown to IN_PROGRESS. ✅ "Status updated".
- [ ] **Convert to Deal**. ✅ Toast `Converted — deal "<Company> — <Service>" created`, and the status becomes CONVERTED.
  - CRM → Clients now has that company (Approved, source "Enquiry Form") if it didn't exist.
  - CRM → Deals has a new **Lead**.
  - The client's Timeline shows "Deal created from converted enquiry".
- [ ] Convert again (e.g. after resetting the status to NEW). ✅ Error "This enquiry has already been converted".

### Recruitment

#### 4.14 Job Orders — `/admin/jobs`
- [ ] 3 seeded jobs. Columns include **Source** (Staff / Company Request) and **Published** (Published / Awaiting Publish).
- [ ] **+ Add Job**:
  - Required: Job Title *, Client *.
  - Optional: Location, Country, Min/Max Salary, Positions Count, Experience Required, Category, Industry, Status, Deadline, Description.
  - Save with **Save Job**. ✅ "Saved", and the job is Published immediately.
  - Also try with the salary and deadline left **empty**. ✅ It must still save.
- [ ] Edit a job: change positions and the deadline, then save. ✅ "Saved" (not "Job not found").
- [ ] Eye icon: **Unpublish**. ✅ "Job unpublished", and the job disappears from `/careers` and the home page jobs strip. **Publish** again.
- [ ] Delete a test job.
- [ ] Industry filter, search and export.

#### 4.15 Job detail — `/admin/jobs/[id]`
- [ ] Header: status badge (click it, pick FILLED, then **Save**, and put it back), client link, **Publish to Website / Unpublish**.
- [ ] Tabs:
  - **Overview**: KPIs, Fill Rate, Job Details, Client card.
  - **Applicants**: change an applicant's status in the Action select. ✅ "Updated".
  - **Interviews**.
  - **Pipeline**: Recruitment Funnel.
- ℹ Applicants appear after a profile-share interview is scheduled (4.22), which creates or updates the job application.

#### 4.16 Candidates — `/admin/candidates`
- [ ] Rajesh and Maria are listed. Industry pills (**All Industries** + each industry), Category filter, search.
- [ ] **+ Add Candidate**:
  - Required: First Name *, Last Name *, Email *, Phone *.
  - Optional: Nationality, Experience, salaries, Current Location, Status, Source, **Visibility**, Category, Industry, Skills (comma-separated), **Upload CV (PDF/DOCX)**, Notes.
  - Save.
  - ✅ The row appears with a generated **CV ID** (`AK-CV-<year>-NNNNN`), and the CV file lands in `web/uploads/documents/`.
- [ ] **Quick Edit** (pencil): change the status and save. ✅ The candidate's **history** tab gets an entry.
- [ ] **Make Public / Make Private** icon. ✅ "Candidate is now public!" / "Candidate set to draft". Public candidates appear on `/candidates` (talent pool).
- [ ] Delete a test candidate (confirm "Delete this candidate?").
- [ ] Import (Template: First Name*, Last Name*, Email*, Phone*, …) and Export.
- [ ] **Bulk Share** goes to 4.23. **Import from CV** goes to 4.17.

#### 4.17 Import from CV — `/admin/candidates/import`
- [ ] Drop a PDF/DOCX CV. ✅ "CV parsed successfully!" and a form pre-filled with name, email, phone and skills. If parsing fails: "Could not extract text from CV — please fill in manually".
- [ ] Clear Email and save. ✅ "First name, last name, email and phone are required".
- [ ] **Save as Draft**. ✅ "Candidate added (draft)", then the "Candidate Added!" screen with **View Profile / Import Another / All Candidates**.
- [ ] Import the same email again. ✅ 409 "A candidate with this email already exists."
- [ ] Repeat with **Save & Make Public**. ✅ The candidate appears on `/candidates`.

#### 4.18 Candidate detail — `/admin/candidates/[id]`
- [ ] Header: CV ID, status, Public/Private badge, **Share Profile**, **Edit**, trash.
- [ ] Tabs: profile, history, applications, documents, shares, tracking.
- [ ] **Edit** (inline):
  - Change the headline, a salary, and tick **Visible on public page**.
  - Add a skill.
  - Add a YouTube URL. An invalid one shows "That doesn't look like a valid YouTube link".
  - **Save**. ✅ "Candidate updated", and the **history** tab lists each changed field (old value struck through, new value, "Admin").
- [ ] **View / Download CV** opens the uploaded file.
- [ ] **shares** tab: lists shares after 4.21. The ban icon withdraws a share (confirm).
- [ ] **tracking** tab: see 4.25.

#### 4.19 CV Registrations — `/admin/candidates/registrations`
- **Precondition:** submit `/register` (6.3) and `/candidate/register` (5.1).
- [ ] Pills: All / Pending / Approved / Rejected, with counts. Expand a card with the chevron. ✅ Details, skills, **View CV / Resume**.
- [ ] **Approve & Make Public** (confirm).
  - ✅ Toast "Candidate approved! Portal account created." The card says "Portal account created. Candidate can log in."
  - The candidate now appears in Recruitment → Candidates (source WEBSITE, status NEW, new CV ID).
  - The terminal logs the `candidate-welcome` email.
  - Password: registrations from `/candidate/register` keep the password the candidate chose. Registrations from the public `/register` form had no password, so their portal password is **`AlKhadim@123`**.
- [ ] **Approve (Private)** on another one. ✅ The candidate is created but not shown on `/candidates`.
- [ ] **Reject** with a reason. ✅ "Registration rejected." and "Rejection reason: …" on the card.
  - ⚠ Pressing Cancel on the reason prompt still rejects (known issue).
- [ ] Approve an already-approved registration (via a stale tab). ✅ 409 "Already approved".

#### 4.20 Interviews — `/admin/interviews`
- [ ] **+ Schedule Interview**:
  - Required: Candidate *, Job Position * (only OPEN jobs are listed), Date & Time *.
  - Optional: Interview Type, Status.
  - Save with **Save**. ✅ "Saved" and the row appears.
- [ ] Edit (pencil): set Status COMPLETED, **Rating (1–5)** = 4, and Feedback, then **Save**. ✅ "Saved", and the Rating column shows "4/5 ★".
- [ ] Delete (confirm).
- ℹ This page sends **no emails**. Interviews created from a profile share (4.22) also appear here.

#### 4.21 Profile Shares (single) — Share Profile modal
- **Precondition:** an APPROVED company with a portal user (5.10–5.11), and a candidate with a CV.
- [ ] From the candidate detail page, click **Share Profile**:
  - Company * (the approved company).
  - Job (optional; pick one of that company's jobs so an interview can be scheduled later).
  - Toggle **Fields to share** (Personal / Identity Documents / Professional / Compensation / Media).
  - Tick **CV / Resume** under **Documents to share**.
  - Delivery: **Portal only / Email only / Both**. Use Both.
  - Message (optional). Try **Preview**.
  - Click **Share Profile**.
- ✅ Toast "Profile shared".
  - The candidate's **shares** tab and Recruitment → **Profile Shares** list a row with status SENT.
  - The terminal logs the `profile-shared-client` email (the email contains `/company/view/<token>`).
  - The company portal's **Candidates** and **Dashboard** list the share (5.12, 5.13).
  - The candidate portal's **Shared With** lists it (5.7).
  - The client detail **Shared Candidates** tab lists it.
- [ ] Pick a job from another company (if possible). ✅ Error "Job does not belong to the selected client".

#### 4.22 Profile Shares list and detail — `/admin/profile-shares`, `/admin/profile-shares/[id]`
- [ ] The list auto-refreshes about every 20 s. Filter by status. The eye icon opens the detail page.
- [ ] Detail page:
  - Cards: **Fields Shared**, **Documents**, **Message**, **Internal Note**.
  - **Tracking Timeline** with CREATED and EMAIL_SENT.
  - After the company opens the share: VIEWED, then DOWNLOADED, SHORTLISTED and so on.
- [ ] **Resend**. ✅ "Share resent", a RESENT event, and a mail logged.
- [ ] After the company clicks **Request Interview** (5.13):
  - ✅ An amber banner shows **"Company requested an interview"** with the preferred time and interviewer emails, plus **Schedule Now**.
  - Click **Schedule Now** (or **Schedule Interview**): Date & Time (pre-filled), Mode **Online** (Meeting Link *) or **In Person** (Location / Address *), interviewer email chips, and Notes.
  - Submit **Schedule Interview**.
  - ✅ Toast "Interview scheduled and emailed to the candidate and company." If the candidate had no portal account, the toast mentions a created account.
  - Status becomes INTERVIEW_SCHEDULED and an indigo "Interview Scheduled" box appears.
  - Admin → Interviews has a new row. The job's **Applicants** tab shows the candidate as INTERVIEW_SCHEDULED.
  - The company sees "Interview Scheduled". The terminal logs 3 kinds of email (candidate, company, each interviewer).
  - ℹ If a portal account is auto-created here, its random password is only in the (logged) email. Test candidate login with a candidate approved through CV Registrations instead.
- [ ] **Withdraw** (confirm). ✅ "Share withdrawn" and status WITHDRAWN.
  - The public `view/<token>` link now fails with "no longer available".
  - A second withdraw returns "Already withdrawn".

#### 4.23 Bulk Share — `/admin/profile-shares/bulk`
- [ ] Filters: search, status, Skill (exact, case-sensitive), Nationality, Min experience.
- [ ] Tick 2 candidates (**Select all on page** also works), pick a Company, fields, **Include each candidate's CV**, and Delivery.
- [ ] Click **Share with N Candidates**. ✅ "Shared with 2 candidates" and a redirect to the list, with one row per candidate.

#### 4.24 Profile Requests — `/admin/profile-requests`
- **Precondition:** submit a request from the public talent pool (6.5).
- [ ] Tiles: Total / New / Reviewing / Connected. The card reads "<requester> from <company>" / "Requested: <candidate>".
- [ ] Expand it. ✅ Requester Details (mailto/tel links), Requested Candidate link, Message.
- [ ] Type internal notes, then click **REVIEWING**. ✅ "Status updated", and the notes persist after a refresh.
  - Notes only save when you click a status button.
- [ ] Move it to **CONNECTED**, then **CLOSED**. No email is sent to the requester.

#### 4.25 Candidate Tracking — candidate **tracking** tab and `/admin/candidate-tracking`
- **Precondition:** the Oil & Gas template from 4.4.
- [ ] On a candidate's **tracking** tab, choose **+ Start tracking…** → Oil & Gas. ✅ "Tracking started", with your sections as tabs.
- [ ] Fill some fields, then **Save Changes**. ✅ "Tracking saved", and the values persist after a refresh.
- [ ] **Sample CSV** and **Export CSV** download files. **Import CSV** with the exported file (edit a value first). ✅ "Tracking imported from CSV". Import replaces all data.
- [ ] Visibility: **Public**, then tick **Candidate** and **Company**.
  - ✅ The candidate sees it in portal **My Tracking** (5.9).
  - ✅ The company sees it on the share detail and the public view.
  - Set it back to **Private**. ✅ Both lose access.
- [ ] Trash (remove tracking) as SUPER_ADMIN/ADMIN. ✅ "Tracking removed".
- [ ] **Requested Documents** (under the tracking panel):
  - **Request Document**: title "BOSIET Certificate" plus instructions, then **Send Request**.
    - ✅ "Document requested — candidate notified by email" and badge **Awaiting Upload**. The candidate dashboard shows it (5.8).
  - After the candidate uploads: badge **Uploaded — Review**. **Download** works.
  - **Reject** with a reason, then **Confirm Reject**. ✅ The candidate sees "Re-upload needed" with the reason.
  - After a re-upload, **Verify**. ✅ Badge **Verified**.
  - Tick **Visible to Company**. ✅ The company sees it under documents on the share, and it can be downloaded.
- [ ] `/admin/candidate-tracking` list: one row per tracking record (Candidate, Industry, Visibility, Updated By, Last Updated). The industry filter works. The eye icon opens the candidate's tracking tab.

### HRMS and operations

#### 4.26 Employees — `/admin/employees`
- [ ] **Add Employee**:
  - Required: Employee ID * (EMP001), First/Last Name *, Email *, Phone *, Designation *, Basic Salary (AED) *, Joining Date *.
  - Optional: Status, Department, Nationality, Passport No./Expiry, Visa No./Expiry, Emirates ID/Expiry, Bank Name, IBAN, Photo.
  - Save with **Save Employee**. ✅ "Saved"; the photo lands in `uploads/images/`.
  - Create **at least 2 ACTIVE employees** for payroll.
- [ ] Add a duplicate Employee ID or email. ✅ 409 "An employee with this employee ID or email already exists".
- [ ] Edit and save. Search. Import and export.
- [ ] Delete an employee that has attendance or payroll records. ✅ It must be refused with 409. Check the Network tab; there may be no toast.

#### 4.27 Attendance — `/admin/attendance`
- [ ] Pick the current month and year. Click **Mark Attendance**:
  - Employee *, Date *, Check In, Check Out, Hours Worked, **Overtime (hours)** = 4, Status (PRESENT/ABSENT/LEAVE/HALF_DAY).
  - **Save**. ✅ "Attendance saved" and the row appears in "Attendance — <Mon> <year> (N records)".
- [ ] Mark the same employee and date again with different values. ✅ The row is **updated**, not duplicated.
- ℹ Hours are not calculated from check-in and check-out times. Overtime feeds payroll (4.29).

#### 4.28 Leave — `/admin/leave`
- [ ] **New Leave Request**:
  - Employee *, Leave Type * (Annual/Sick/Emergency/Maternity/Unpaid), Start Date *, End Date *, Number of Days *, Reason.
  - **Submit**. ✅ "Leave request created" under the **PENDING** pill (the default filter).
- [ ] End date before start date. ✅ Error from the backend.
- [ ] Green check. ✅ "Status updated"; the row moves to **APPROVED** (approvedBy = your name).
- [ ] On another request, the red X. ✅ The row moves to **REJECTED**.
- ✅ The dashboard's **Pending Leaves** count updates. There are no leave balances in this system.

#### 4.29 Payroll — `/admin/payroll` (Finance → Payroll)
- **Precondition:** ACTIVE employees (4.26), optional overtime (4.27), and a bank account (4.33).
- [ ] Select the month and year, then **Process Payroll — <Month> <year>**.
  - ✅ Toast "Processed N payrolls".
  - One row per ACTIVE employee, status PROCESSED.
  - Gross = Basic + overtime pay, where overtime pay = basic/30/8 × 1.5 × OT hours.
- [ ] **Approve** a row. ✅ Status APPROVED (check for a 200 in Network).
- [ ] **Mark Paid**: **Pay From Account** = your bank account, Payment Method "Bank Transfer", then **Mark Paid**.
  - ✅ "Payroll marked paid" and status PAID.
  - Finance → Accounts → that account shows a **PAYROLL PAYMENT** of −Net Pay, and the balance drops.
- [ ] **Payslip** opens a print window (allow pop-ups).
- [ ] Process the same month again. ✅ PAID rows are untouched. (APPROVED rows go back to PROCESSED; current behaviour.)

#### 4.30 Outsourcing — `/admin/outsourcing`
- [ ] **+ Add Assignment**:
  - Required: Employee *, Client / Company Name *, Designation *, Start Date *, Salary *.
  - Optional: End Date (leave empty once), Visa Status, Accommodation, Status (Active/Ended).
  - **Save**. ✅ "Saved"; End shows "Ongoing".
- [ ] Edit: set Status Ended and an End Date. ✅ Saved.
  - End Date before Start Date. ✅ Error "endDate must not be before startDate".
- [ ] Delete.

#### 4.31 Documents — `/admin/documents`
- [ ] **+ Upload Document**:
  - Document Title *, Document Type * (PASSPORT, VISA, …), Employee (try **None** once and an employee once), Expiry Date (e.g. in 10 days), File * (pdf/jpg/png/doc/docx, ≤ 10 MB), Notes.
  - **Upload**. ✅ "Document uploaded", and the file lands in `uploads/documents/`.
- [ ] Upload an `.exe` or `.txt`. ✅ "File type not allowed".
- [ ] Download icon. ✅ The file downloads. A 401 means the auth-download fix hasn't landed yet.
- [ ] The Expiry column is red with an alert icon when under 30 days. The dashboard **Expiring Docs** count includes it.
- [ ] Delete. ✅ The row is gone and the file is removed from disk.

### Finance

#### 4.32 Invoices — `/admin/crm/invoices` (Finance → Invoices)
- [ ] **+ New ▾** (hover): **Quotation**. In the builder:
  - Client *, Subject, Issue Date, Valid Until, Currency.
  - Line Items (**Add Line**, Qty, Unit Price).
  - Discount (try the % mode), Tax.
  - Tabs: From / Sender, Bill To (**Re-fill from client**), Payment, 🎨 Design.
  - The Live Preview updates as you type.
  - **Save**. ✅ Number `QT-<year>-NNNN`, and you land on the edit URL.
- [ ] Empty line description. ✅ "All line items need a description". No client. ✅ "Please select a client".
- [ ] Create a **Proforma Invoice** (`PI-…`) and an **Invoice** (`INV-…`).
- [ ] Invoice view `/admin/crm/invoices/[id]`:
  - **Mark Sent** (DRAFT → SENT).
  - **Mark Paid** (SENT → PAID; shows "Paid <date>").
  - **Print**.
  - **Duplicate** (a new number, which opens edit).
  - **Edit**, and delete (confirm).
- [ ] Re-open an invoice that has a **% discount**, save without changes, and compare the total. ⚠ A known issue can change the total. Record the before and after.
- [ ] List:
  - Tabs All / Invoices / Proforma / Quotations.
  - Filters: search, status, year.
  - Inline status dropdown per row.
  - **Reports** panel (KPIs, Monthly Revenue, By Status, Top Clients).
- ✅ Everywhere else:
  - Dashboard Financial Overview.
  - The client's **Invoices** tab and Overview KPIs.
  - Finance Overview **Revenue**: counts non-DRAFT/CANCELLED invoices by issue date.
  - Reports → Revenue.
- ⚠ **Marking an invoice PAID does not post money into any bank account.** The UI never sends an account. See flow 7.5 for the manual step.

#### 4.33 Accounts — `/admin/finance/accounts`
- [ ] **+ New Account**: Name *, Type (Bank/Cash/Petty Cash), Bank Name, Account Number, IBAN (Bank only), Opening Balance 10000.
  - ✅ "Account created" and a card showing AED 10,000.
  - Create a second account (Cash, 0).
- [ ] **Transfer Funds**: From = Bank, To = Cash, Amount 500. ✅ "Transfer completed"; the balances are 9,500 / 500.
  - The same account on both sides. ✅ "From and To accounts must be different".
- [ ] Account detail `/admin/finance/accounts/[id]`:
  - **Record Transaction**: Deposit 1000, then Withdrawal 200. ✅ The Transaction Ledger shows DEPOSIT (+) and WITHDRAWAL (−), and **Current Balance** updates.
  - **Edit Account**: rename it, untick Active, then tick it again.
  - **Delete Account** on one with transactions. ✅ "This account has N transaction(s) and cannot be deleted."

#### 4.34 Expenses — `/admin/finance/expenses`
- [ ] **+ New Expense**:
  - Required: Category * (e.g. Rent), Description *, Amount *, Date *.
  - Optional: Vendor, Tax Amount, Due Date, "This is a recurring expense" (+ interval), Notes.
  - **Save**. ✅ "Expense created", number `EXP-<year>-NNNN`, status DRAFT.
- [ ] Amount 0. ✅ "Amount must be greater than 0".
- [ ] Detail page:
  - **Approve**. ✅ "Expense approved".
  - **Mark Paid**: Account = the bank account, Payment Method, Payment Reference, then **Confirm Payment**.
    - ✅ "Expense marked as paid".
    - The account ledger shows **EXPENSE PAYMENT** (−total) and the balance drops.
- [ ] **Upload Receipt** (choose a file first). ✅ "Receipt uploaded", then a **View Receipt** link.
- [ ] **Edit** is disabled for PAID expenses ("Paid expenses cannot be edited"). Delete a DRAFT expense.
- [ ] List: KPIs (Total, Paid, Pending, Count), filters (search, category, status, date range).

#### 4.35 Budgets — `/admin/finance/budgets`
- [ ] Pick Year / Monthly / the current month. Type 5000 in **Rent**, then click outside. ✅ "Budget saved" (it saves on blur).
- [ ] **Budget vs Actual** shows Rent with Actual = your approved or paid Rent expense, plus Variance and % Used.
  - Enter a budget below the actual. ✅ A red row and an "N over budget" badge.
- ℹ DRAFT and REJECTED expenses don't count toward Actual.

#### 4.36 Finance Overview — `/admin/finance`
- [ ] KPIs: Revenue, Total Expenses, Payroll Expense, Net Profit, **Cash Position** (the sum of account balances), Budget Utilization. Also **P&L Summary**, **Cash Flow Trend** and **Quick Links**.
- ✅ Cash Position = the total of the Accounts page. Payroll Expense includes the paid payroll.

### Emails (SUPER_ADMIN, ADMIN, or a custom role with Emails access)

#### 4.37 Compose — `/admin/emails`
- [ ] Tabs: **Compose, Campaigns, Templates, Groups, History**.
- [ ] Template gallery: **Start blank**, or pick a template.
- [ ] Compose to **One person**: From (module identity), To, Cc, Subject *, Body.
  - Send. ✅ "Email sent", a terminal log line, and a SENT row in **Scheduled & Sent**.
- [ ] Toggle **Schedule** and pick a time 2 minutes ahead. ✅ "Email scheduled" and status PENDING.
  - About 1–2 minutes after the send time: SENT (the scheduler polls every 60 s).
  - Schedule another one and cancel it with the trash icon. ✅ "Cancelled" and status CANCELLED.
- [ ] **A group** with a group from 4.39. ✅ A campaign "Compose: <subject>" is created and sent.

#### 4.38 Templates — `/admin/emails/templates`
- [ ] 16 seeded templates. Filters: category and recipient type.
- [ ] **New Template**:
  - Name, Slug (auto), Category, Recipient Type, From, Subject with `{{name}}`, Body.
  - **Save Template**. ✅ "Template created".
- [ ] Edit and **Save Changes**. ✅ The version bumps.
- [ ] Duplicate. ✅ "(copy)", as a Campaign template.
- [ ] Activate/deactivate with the power icon.
- [ ] Delete: only enabled for Campaign templates. Transactional ones must be deactivated instead.
- ⚠ Do **not** deactivate or rename the slug of system templates (otp-verification, candidate-welcome, client-portal-invite, …). Their flows will start failing.

#### 4.39 Groups — `/admin/emails/groups`
- [ ] **New Group** (Name *, Description). ✅ It opens the group page.
- [ ] **Add Members**: browse the directory (Candidates / Employees / Clients / Client Users / Internal Staff), tick people, then **Add Members**. ✅ "Added N members".
- [ ] Remove a member. Rename or delete the group from the list.

#### 4.40 Campaigns — `/admin/emails/campaigns`
- [ ] **+ New Campaign**:
  - Campaign Name *, From, Subject *, Body.
  - **Audience**: try **Filter by criteria** (a live "N recipients match" count), **Saved group**, and **Pick people**.
  - **Save Draft**. ✅ "Draft created", then the edit page.
- [ ] Edit page:
  - **Send Test** to an address. ✅ "Test sent to …".
  - **Send Now** (confirm). ✅ "Campaign is sending".
- [ ] Campaign detail: status SENDING, then SENT. The recipients table auto-refreshes every 5 s, and totals appear.
- [ ] A second campaign scheduled in the future, then **Cancel**. ✅ CANCELLED.
- [ ] A campaign whose filter matches nobody, then Send. ✅ "No recipients match the current targeting".

#### 4.41 History — `/admin/emails/history`
- [ ] Source tabs All / Transactional / Compose / Campaign. Filters: status, module, From/To dates, search.
- ✅ Every mail the run generated is listed: OTP, welcome, invites, share and interview emails, and so on, with status SENT (dev transport).

### Reports, Site Editor, AI

#### 4.42 Reports — `/admin/reports`
- [ ] Each section loads with no "Error: …":
  - **Overview**
  - **Recruitment**
  - **Placements**
  - **Pipeline**
  - **Revenue**
  - **Financial Statements**
  - **HR & Workforce** (+ Attendance Month)
  - **CRM & Clients**
- [ ] Year selector changes the data.
- [ ] **Export**: PDF (Charts), Excel (.xlsx), CSV for the current section, and **Export All as PDF** (progress overlay, then `AlKhadim_Full_Report_<year>.pdf`).
- ✅ The numbers match what you created. For example, Financial Statements P&L = invoices − expenses − payroll, and Accounts Summary matches Finance → Accounts.

#### 4.43 Site Editor — `/admin/site-editor`
- [ ] Tabs: **Theme, Navbar, Hero, Sections, Footer**. Change the Hero headline and toggle one homepage section off.
- [ ] **Save <Tab>** (Quick Save) or **Save All Changes**. ✅ "<Key> saved!" / "All changes saved!".
  - **Preview Site** (or reload `/`) shows the new headline, and the section is hidden.
- [ ] Navbar → Logo Image → Upload an image. ✅ "Image uploaded", and the file lands in `uploads/images/`.
- [ ] Revert your changes and save again.

#### 4.44 AI Assistant drawer (header bot icon)
- [ ] Opens the drawer with **New chat**. Type a question and press Enter.
  - ✅ With no key: a red toast and a red message "AI assistant is not configured".
  - The conversation list stays empty ("No conversations yet …").
- [ ] Full screen toggle and close (X, Esc).

---

## 5. Candidate portal and company portal

### Candidate portal (`/candidate/**`)

#### 5.1 Register — `/candidate/register`
- [ ] **Upload Your CV**: upload a PDF. ✅ The **Review Your Details** form is pre-filled. Alternatively, **Skip — I'll fill in my details manually →**.
- [ ] Review:
  - Required: First Name *, Last Name *, Email * (use an email not used before), Phone *.
  - Optional: Nationality, Current Location, Years of Experience, LinkedIn URL, Professional Headline, Professional Summary, Education, **Skills**, **Languages** (Enter to add).
  - Click **Continue**. Missing required fields show "Please fill all required fields".
- [ ] **Verify Your Email**: the amber dev box shows the code, and it is pre-filled. Click **Verify Code**. ✅ "Email verified" and the heading **Email Verified**.
- [ ] **Create Your Password**: Password + Confirm Password (min 8). Mismatch shows "Passwords do not match".
- [ ] **Submit Application**. ✅ **Application Submitted!**
  - Admin → **CV Registrations** has it as Pending.
  - The terminal shows the OTP mail.
- [ ] Register the same email again. ✅ An error: the email is already registered or pending.

#### 5.2 Login before approval — `/candidate/login`
- [ ] Log in with the new account **before** approval. ✅ Red toast **"Invalid credentials or account not yet approved."**
- [ ] Approve it in Admin → CV Registrations (4.19), then log in again. ✅ "Welcome back!" and the candidate dashboard.
- [ ] Wrong password. ✅ "Invalid credentials".

#### 5.3 Portal layout
- [ ] Nav: **Dashboard, My Profile, My Applications, Shared With, My Tracking**, and **Log out**.
- [ ] Log out, then open `/candidate/dashboard`. ✅ Back to the candidate login.

#### 5.4 Dashboard — `/candidate/dashboard`
- [ ] Sections: KPIs (Applications, Interviews, Offers), **Recent Applications**, **Upcoming Interviews**, **Profile Strength** (Headline, Summary, Skills, Education, Location, LinkedIn, Intro Video), **Quick Actions** (links to profile, jobs, careers, talent pool).
- [ ] **Document requests** block: see 5.8.

#### 5.5 My Profile — `/candidate/profile`
- [ ] Edit Nationality, Location, Headline, Summary, LinkedIn, Education, skills and languages, and a YouTube intro video URL.
  - Save. ✅ "Profile updated successfully!"
  - Admin → candidate → **history** shows the changes labelled "Candidate".
- [ ] Password section: mismatch shows "Passwords do not match"; under 8 characters shows "Minimum 8 characters".
  - Valid change, then **Update Password**. ✅ "Password changed!" and the new password works on the next login.

#### 5.6 My Applications — `/candidate/jobs`
- [ ] Lists the candidate's applications with statuses (Applied … Placed & Joined). Search works, as do the filter chips.
  - Empty state has a **Browse Jobs** link.
- ℹ Candidates cannot apply to a specific job from the portal. Applications are created when:
  - staff schedule an interview from a share (4.22), or
  - a company **Shortlists** or **Rejects** a share that is linked to a job (5.13).

  The job then shows here.

#### 5.7 Shared With — `/candidate/shared-with`
- [ ] After 4.21 it lists each company the profile was shared with, with its status (Shared, Viewed by Company, Downloaded, Shortlisted, Not Selected, Interview Requested, Interview Scheduled).
  - It updates as the company acts (5.13, 5.14).

#### 5.8 Document requests (candidate side)
- [ ] After admin **Request Document** (4.25): the dashboard shows the request with the badge **Upload needed** and its instructions.
- [ ] Upload a file. ✅ "Document uploaded — Al Khadim will review it" and the badge **Under review**.
  - The admin panel shows **Uploaded — Review**.
  - The terminal logs `document-uploaded-notify` to staff.
- [ ] After an admin reject: **Re-upload needed** with the reason. After verify: **Verified**. **View my upload** downloads the file.

#### 5.9 My Tracking — `/candidate/tracking`
- [ ] When the tracking record is Public with **Candidate** ticked (4.25), the industry tabs are shown read-only.
- [ ] When it is Private or Candidate is unticked, the record is not shown.

### Company portal (`/company/**`)

#### 5.10 Register — `/company/register`
- [ ] **Create Your Business Profile**:
  - Required: Company Name *, Contact Person *, Business Email * (new), Phone *.
  - Optional: Industry, Country, City, Website, Address.
  - Click **Continue**.
- [ ] OTP step: dev code box, then **Verify Code**. ✅ **Email Verified**.
- [ ] **Set Your Password**: Password + Confirm (min 8), then **Create Business Profile**. ✅ **Business Profile Created!**, then **Go to Dashboard**.
- ✅ Everywhere else:
  - Admin → CRM → Clients: filter **Pending Approval** to find the company.
  - The terminal logs `client-signup-review` (to the company) and `admin-new-company-registration` (to every SUPER_ADMIN and ADMIN).
- [ ] Register with an email that already exists as a client. ✅ 409 "A company record with this email already exists. Please contact Al Khadim." For an existing portal user: "An account with this email already exists. Please log in."

#### 5.11 Login and pending state — `/company/login`
- [ ] Log in **before** approval. ✅ Login works, but the layout shows **"Your business profile is under review"** and the portal data is blocked (API 403 "Your company account is pending approval").
- [ ] Admin approves (4.10). Refresh. ✅ The full portal: **Dashboard, Candidates, Jobs, Team**, and **Log out**.
- [ ] Rejected company: **"We couldn't approve your business profile"**.
- [ ] Wrong password. ✅ "Invalid credentials".

#### 5.12 Dashboard — `/company/dashboard`
- [ ] KPIs: Total Shared, Interview Requests, Interviews Scheduled. **Recent Shares** has links to each share.

#### 5.13 Candidates — `/company/candidates` and `/company/candidates/[shareId]`
- [ ] **Shared Candidates** list with status chips (New, Viewed, …) and search.
- [ ] Open a share.
  - ✅ The candidate card shows only the fields admin chose, plus **Documents**. Downloading the CV works.
  - The admin timeline gets VIEWED, then DOWNLOADED.
  - Industry tracking tabs appear if the record is visible to the company.
- [ ] **Your Decision**. The share must be linked to a job; without one the API returns 400 "This share has no associated job order …".
  - **Shortlist**.
    - ✅ "Response recorded" and status Shortlisted.
    - Admin sees SHORTLISTED, and the candidate's My Applications lists the job.
    - The terminal logs an email to the staff member who shared.
  - On another share: **Request Interview** with **Preferred date & time *** and **Interviewer email(s) *** (e.g. `a@x.com, b@x.com`), plus an optional note. Then **Confirm Request**.
    - ✅ Status Interview Requested, and the admin share detail shows the amber banner (4.22).
  - On a third share: **Reject** with an optional reason, then **Confirm**. ✅ Rejected, and the candidate's Shared With shows "Not Selected".
- [ ] After admin schedules: the share shows the **Interview Scheduled** box with the date and the link or location.
- [ ] A withdrawn share shows "No Longer Available".

#### 5.14 Public share link — `/company/view/[token]`
- **Precondition:** get `ProfileShare.accessToken` from Prisma Studio (§1.3).
- [ ] Open it in a private window (not logged in). ✅ The profile renders read-only, plus **Verified Documents** when documents are visible to the company.
  - Downloads work. There is a **Log in to Company Portal** button instead of decision buttons.
  - Admin timeline: VIEWED / DOWNLOADED.
- [ ] Once withdrawn or expired (30 days). ✅ An error page ("no longer available").

#### 5.15 Jobs — `/company/jobs`
- [ ] **Post a Job**:
  - Required: Job Title *.
  - Optional: Description, Location, Country, Job Type, Experience, Positions, Deadline, Min/Max Salary, Category, Industry.
  - **Submit Job Request**. ✅ "Job request submitted — Al Khadim will review it", and the job is listed.
- ✅ Everywhere else:
  - Admin → Job Orders shows it with **Source = Company Request** and **Awaiting Publish**. It is not on `/careers` yet.
  - The terminal logs `admin-new-job-request`.
  - Admin **Publish**. ✅ It appears on `/careers`.

#### 5.16 Team and accept invite — `/company/team`, `/company/accept-invite/[token]`
- [ ] As the company admin: **Invite Teammate** (Name, Email, Role Member/Admin), then **Send Invite**. ✅ "Invite sent", and the teammate is listed as pending.
- [ ] Get `ClientUser.inviteToken` from Prisma Studio and open `/company/accept-invite/<token>`.
  - Password + Confirm Password (min 8), then **Get Started**. ✅ "Welcome! Your account is ready." and you are logged in as the teammate.
- [ ] Reuse the same link, or a bad token. ✅ "This invite link is invalid or has expired."
- [ ] Toggle a teammate inactive. ✅ "Updated", and they can no longer log in.
  - Try to deactivate yourself. ✅ "You can't deactivate your own account".
- [ ] Log in as a **Company Member** and try inviting. ✅ Error "Only a company admin can perform this action".
- [ ] Also test the admin-created invite from 4.10 (Portal Users). The flow is the same.

---

## 6. Public website

#### 6.1 Home — `/`
- [ ] Sections render: Hero, Clients, Stats, Services, Process, Why Us, Industries, **Jobs**, Candidates, Global banner, Testimonials, Awards, CEO, **Upload your CV**, CTA. Their visibility and text come from the Site Editor.
- [ ] Jobs strip: shows published OPEN jobs (`GET /api/jobs/public?limit=6`).
  - ⚠ Clicking a job card goes to `/careers/<id>`, which has **no page (404)**. Known issue.
- [ ] **Upload your CV** block: **Upload CV Now** goes to `/candidate/register`; **Already registered? Sign In** goes to `/candidate/login`. There is no direct upload here; the CV is uploaded inside the registration wizard.
- [ ] Navbar links (Find Talent, Find Work, Candidates, About, Contact, and staff login), Footer links, and the mobile bottom nav.

#### 6.2 About / Services — `/about`, `/services`
- [ ] Static pages render. Services CTAs go to `/enquiry`.

#### 6.3 Careers — `/careers` and the public apply form `/register`
- [ ] `/careers` lists the published OPEN jobs (the 3 seeded ones plus yours) with company, location, type and salary.
  - Search, and **Clear**.
  - Unpublished and closed jobs must not appear.
- [ ] **Apply Now →** opens `/register` ("Apply for a Job"). ℹ It is not tied to the specific job.
- [ ] Fill in:
  - Required: First Name *, Last Name *, Email Address *, Phone Number *.
  - Optional: Nationality, Years of Experience, Key Skills, **Upload CV (PDF, DOC)**.
  - **Submit Application →**. ✅ "Registration submitted successfully!" and **Application Submitted!**, with **Submit Another**.
- ✅ Everywhere else: Admin → CV Registrations shows it as Pending, and the CV is in `uploads/`. After approval the portal password is **`AlKhadim@123`**.

#### 6.4 Talent pool — `/candidates`
- [ ] **Discover Top Talent**: only **public** candidates are shown (names and photos are blurred).
  - The category chips and search filter in the browser.
- [ ] A private candidate (e.g. approved as private in 4.19) must **not** appear.
- [ ] Click a card. ✅ Logged out: goes to `/company/register`. Logged in as a company: goes to `/company/dashboard`.
  - Cards do **not** open the candidate's profile page.

#### 6.5 Candidate profile and profile request — `/candidates/[id]`
- **Precondition:** there's no link to this page. Type `http://localhost:3000/candidates/<candidateId>` yourself, using the id from the admin candidate URL.
- [ ] Profile shows About, Skills & Expertise, Quick Facts, Education. Contact details are hidden. **Create Business Profile to View** goes to company registration.
- [ ] **Or request this profile instead** opens the request form:
  - Required: Your Name, Company, Email, Phone.
  - Optional: Position / Role Needed, Message.
  - **Send Request to Al Khadim Team**. ✅ **Request Sent!**, then **Done**.
  - Missing fields show "Please fill all required fields".
- ✅ Admin → Recruitment → **Profile Requests** shows it as NEW (4.24). No email is sent.
- [ ] An unknown id shows **Profile not found**.

#### 6.6 Enquiry — `/enquiry`
- [ ] **Hire the Best Talent**:
  - Required: Company Name *, Contact Person *, Email Address *, Phone Number *.
  - Optional: Designation, Service Required, Message / Requirements.
  - **Send Enquiry →**. ✅ "Enquiry submitted! We will contact you shortly." and **Enquiry Received!**
- ✅ Admin → CRM → **Enquiries** shows it as NEW (4.13).

#### 6.7 Contact — `/contact`
- [ ] Contact Information, Registered Office and Branches render.
- [ ] **Send Us a Message** form: fill it in and click **Send Message →**.
  - ⚠ Known issue: this form has **no submit handler or backend**. The page just reloads and nothing is stored. Confirm that and log it. Use `/enquiry` for business leads.

#### 6.8 Public AI widget
- [ ] A round button at the bottom-right on public pages only. It is hidden on `/admin`, `/candidate` and `/company`.
- [ ] Open it and send "hello". ✅ With no key: "The assistant is taking a break right now — …" (503 in Network).
  - Rapid-fire sending eventually shows "You've sent a lot of messages — please try again in a bit." (429).

---

## 7. Cross-panel end-to-end flows

Run each flow in one go, using separate browser profiles or windows for admin, candidate and company.

### 7.1 Candidate lifecycle
1. [ ] Public: `/candidate/register` (CV → details → OTP dev code → password), then **Application Submitted!**
2. [ ] Candidate login fails: "…not yet approved."
3. [ ] Admin → CV Registrations → **Approve & Make Public**. The candidate appears in Candidates, and on `/candidates` (talent pool).
4. [ ] Candidate logs in and updates the profile. The admin **history** tab shows "Candidate" edits.
5. [ ] Admin shares the profile with the approved company for a job (4.21). The candidate's **Shared With** shows "Shared".
6. [ ] The company opens the share. Candidate side: "Viewed by Company".
7. [ ] The company clicks **Request Interview**, then admin clicks **Schedule Now**.
   - The candidate's **My Applications** shows the job as Interview Scheduled.
   - The dashboard's **Upcoming Interviews** lists it.
   - Admin → Interviews and the Job → Applicants tab list it.
8. [ ] Admin → Interviews: edit it to COMPLETED with a rating. Admin → Job → Applicants: set the status to OFFERED, then JOINED. The candidate's **My Applications** status follows.
9. [ ] Reports → Placements / Pipeline reflect it.

### 7.2 Client lifecycle
1. [ ] Public `/enquiry`, then Admin → Enquiries → **Convert to Deal**. A client (Approved) and a Lead deal are created.
2. [ ] Deals: move it to Qualified, then Proposal Sent, then Won. The client Timeline shows the stage changes.
3. [ ] Client detail → **Portal Users** → **Invite Portal User**. Take the token from Prisma Studio, then **accept-invite**, then log in to the company portal.
4. [ ] Company **Post a Job**, then Admin **Publish**. It shows on `/careers`.
5. [ ] Create an **Invoice** for this client, then Mark Sent, then Mark Paid. The client's Invoices tab and KPIs and the Dashboard revenue update.

### 7.3 Share → company responds → interview scheduled
1. [ ] Admin shares with Delivery **Both** and ticks CV. The terminal logs `profile-shared-client`, and the share is SENT.
2. [ ] Company portal: Candidates → open → download the CV. Admin timeline: VIEWED, then DOWNLOADED.
3. [ ] Public link (`/company/view/<token>`) opened logged out: renders read-only.
4. [ ] Company clicks **Request Interview** with interviewer emails. Admin sees the amber banner.
5. [ ] Admin **Schedule Now** (Online + link).
   - The share becomes INTERVIEW_SCHEDULED.
   - The company sees the "Interview Scheduled" box.
   - The terminal logs the candidate, company and interviewer emails.
   - The interview is on the Interviews page.
6. [ ] Admin **Withdraw**. The company share shows "No Longer Available" and the public link errors.

### 7.4 Payroll month
1. [ ] 2+ ACTIVE employees. Attendance for one of them with 4 h overtime this month.
2. [ ] One leave request, approved.
3. [ ] Payroll: **Process Payroll** for this month. The employee with overtime has Gross > Basic.
4. [ ] **Approve**, then **Mark Paid** from the bank account. The ledger shows PAYROLL PAYMENT and the balance drops by Net Pay.
5. [ ] **Payslip** prints.
6. [ ] Reports → HR & Workforce (Payroll Trend) and Finance Overview (Payroll Expense) include it.

### 7.5 Invoice → payment → bank account balance
1. [ ] Note the bank account balance (B).
2. [ ] Create an INVOICE for 1,000 (no tax), then **Mark Sent**, then **Mark Paid**.
3. [ ] ⚠ **Check:** the account balance is still B. Invoice payments are not posted to accounts from the UI.
4. [ ] Record the receipt manually: Accounts → the account → **Record Transaction** → Deposit 1,000 with description "Payment for INV-…". The balance is now B + 1,000.
5. [ ] Create an expense of 300, then Approve, then Mark Paid from this account. The balance is B + 700.
6. [ ] Finance Overview: Revenue includes the invoice, and Cash Position matches the Accounts page total.
7. [ ] Reports → Financial Statements: P&L and Cash Flow are consistent.

---

## 8. Role checks

Access control is being tightened on the server so that each role reaches only its own modules. Test against the **intended** access below (from `START.md` → *Admin Roles*).

Expected results:
- **Allowed:** the page loads and create, edit and delete work.
- **Forbidden:** the action fails with a **red error toast** (typically "Insufficient permissions", HTTP 403) and **no data changes**. Refresh the page to confirm.
- A forbidden *page* may load but show empty data or an error toast. That's acceptable as long as no data leaks and no write succeeds.
- If a forbidden action fails **silently** (no toast, but a 403 in Network), log it as a UI bug. If it **succeeds**, log it as a security bug.

### 8.1 Create the test users
In Team → **Users** → **New User**, create one user per role, each with password `Test@1234`:

| Email | System Role |
|---|---|
| admin2@test.local | ADMIN |
| manager@test.local | MANAGER |
| recruiter@test.local | RECRUITER |
| hr@test.local | HR |
| accountant@test.local | ACCOUNTANT |
| viewer@test.local | VIEWER |

Log in as each in a private window. Log out between users (sidebar **Sign Out**).

### 8.2 Intended access matrix

| Module (sidebar) | SUPER_ADMIN | ADMIN | MANAGER | RECRUITER | HR | ACCOUNTANT | VIEWER |
|---|---|---|---|---|---|---|---|
| Dashboard | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | read |
| CRM (Deals, Clients, Follow-Ups, Enquiries) | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | read |
| Approve/Reject company registrations | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Recruitment/ATS: Candidates, Job Orders, Interviews | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | read |
| Recruitment/ATS: CV Registrations, Profile Requests, Profile Shares, Candidate Tracking | ✔ | ✔ | ✔ | ✔* | ✘ | ✘ | read |
| HRMS (Employees, Attendance, Leave) | ✔ | ✔ | ✘ | ✘ | ✔ | ✘ | read |
| Payroll | ✔ | ✔ | ✘ | ✘ | ✔ | ✔ | read |
| Finance: Invoices | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ | read |
| Finance: Overview, Expenses, Accounts, Budgets | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ | read |
| Reports | ✔ | ✔ | ✔ | ✘ | ✘ | ✔ | read |
| Outsourcing, Documents | ✔ | ✔ | ✘ | ✘ | ✔* | ✘ | read |
| Emails (all tabs) | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ (redirects to /admin) |
| Team → Users (create/edit/reset/disable) | ✔ | ✔ (not SUPER_ADMIN accounts) | ✘ | ✘ | ✘ | ✘ | ✘ |
| Team → Users (delete) | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Team → Roles & Perms (create/edit/delete) | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Site Editor | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Settings: Categories, Industries, templates, Email/SMTP | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Settings: AI Assistant ("system settings") | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Own profile / Change Password | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

- ✔* marks cells that START.md does not spell out: RECRUITER on the ATS sub-pages, and HR on Documents/Outsourcing. Confirm them with the developer implementing the access-control change, and record what you observe.
- "read" means the pages load and show data, but every create, edit and delete is refused.
- Two payroll actions are finer-grained. Processing and paying payroll are also limited to SUPER_ADMIN, ADMIN and ACCOUNTANT on the server, and **Approve** payroll to SUPER_ADMIN and ADMIN. Check the HR row against the final implementation.

### 8.3 Per-role test script
For each role, do the following and tick the boxes:
- [ ] **Allowed module, write:** create one record in an allowed module. ✅ Success toast.
  - MANAGER: add a Deal. RECRUITER: add an Interview. HR: mark Attendance. ACCOUNTANT: create an Expense.
- [ ] **Forbidden module, write:** try one create and one delete in a forbidden module. ✅ Red error toast, and nothing changed after a refresh.
  - MANAGER: add an Employee. RECRUITER: create an Invoice. HR: add a Client. ACCOUNTANT: add a Candidate.
- [ ] **Forbidden module, read:** open a forbidden page directly by URL. ✅ Either a redirect or an error/empty state. No other module's data is shown.
- [ ] **Admin-only actions:**
  - Approve Company (client detail).
  - Delete a Category.
  - Save Settings → Email.
  - Open `/admin/emails`.
  - ✅ All refused for MANAGER, RECRUITER, HR, ACCOUNTANT and VIEWER. `/admin/emails` redirects to `/admin`.
- [ ] **VIEWER:**
  - Every page loads read-only.
  - Try one write per module group (e.g. Quick Edit a candidate, move a deal, mark attendance, record a transaction, save the Site Editor, save General Settings).
  - ✅ Every write shows an error toast and changes nothing.
- [ ] **ADMIN:**
  - Everything works except SUPER_ADMIN-only items: Settings → AI Assistant (load and save refused), Roles create/edit/delete ("Insufficient permissions"), deleting users.
  - Creating or editing a SUPER_ADMIN account shows "Only Super Admin can manage Super Admin accounts".
- [ ] **Security spot-check (all roles, including logged out):**
  - `GET http://localhost:3000/api/site-config/ai` and `/api/site-config/smtp` must **not** return an API key or SMTP password.
  - A non-admin `PUT` to those keys must be refused.
  - At the time of writing these were exposed; log it if it's still the case.

---

## 9. Known issues found while reading the code (confirm, then log)

Line numbers are as of this writing. The backend is actively being changed, so re-check before filing.

| # | Area | Issue | Where |
|---|---|---|---|
| 1 | Public Contact | "Send Message →" form has no handler or API. Nothing is saved. | `src/app/contact/page.tsx:58` |
| 2 | Home jobs strip | Cards link to `/careers/<id>`, which doesn't exist (404). | `src/components/home/HomeJobs.tsx:73` |
| 3 | Careers | "Apply Now" goes to the generic `/register` form, so the application is not linked to the job. | `src/app/careers/page.tsx:130` |
| 4 | Invoices → Accounts | Mark Paid and the status dropdowns never send `accountId`, so invoice payments never reach a bank account. The backend supports it. | `src/app/admin/crm/invoices/[id]/page.tsx:56,104`; `src/server/controllers/invoices.controller.ts:273` |
| 5 | Security | `GET /api/site-config/:key` is public for any key, including `ai` (OpenAI key) and `smtp` (password). `PUT` is open to any staff role. | `src/server/controllers/siteConfig.controller.ts:157,167` |
| 6 | Invite and share links | No UI shows the company invite link or the public share link. With no SMTP they're only in the DB. | `ClientUser.inviteToken`, `ProfileShare.accessToken` |
| 7 | Client detail | **Edit Client** links to `/admin/crm?edit=<id>` (not handled). **+ Invoice** links to the list with `?client=` (ignored). | `src/app/admin/crm/clients/[id]/page.tsx:297,301` |
| 8 | Follow-Ups | The **All** pill sends `isCompleted=` and the backend treats it as false. | `src/app/admin/crm/follow-ups/page.tsx:38`; `src/server/controllers/followUps.controller.ts:40` |
| 9 | CV Registrations | Cancelling the reject prompt still rejects. | `src/app/admin/candidates/registrations/page.tsx:178` |
| 10 | Invoices | A % discount is stored as an amount and reloaded as a percent, so re-saving can change the total. | `src/app/admin/crm/invoices/_components/InvoiceBuilder.tsx:195` |
| 11 | Silent failures | No `onError` on: payroll Approve, leave approve/reject, employee delete, user delete (Settings). | `admin/payroll/page.tsx:44`, `admin/leave/page.tsx:48`, `admin/employees/page.tsx:47`, `admin/settings/page.tsx:137` |
| 12 | Header | Search box and bell are non-functional placeholders. | `src/components/admin/AdminHeader.tsx:82,88` |
| 13 | Logout | Sign Out never calls `POST /api/auth/logout`, so the refresh token is not revoked. | `src/components/admin/AdminSidebar.tsx:94` |
| 14 | Industry template | The table-column label input loses focus after the first keystroke. | `src/app/admin/settings/industries/[id]/template/page.tsx:274` |
| 15 | Site Editor | **Save All Changes** has no error handling. **Reset** doesn't discard unsaved edits. | `src/app/admin/site-editor/page.tsx:292,338` |
| 16 | Payroll | Re-processing a month turns APPROVED rows back into PROCESSED. | `src/server/controllers/payroll.controller.ts:85` |
| 17 | Portals | Candidate and company portals have no token refresh. Sessions break after 15 min (access token `expiresIn: '15m'`). | `src/lib/candidateAuth.ts`, `src/lib/clientAuth.ts`; `candidateAuth.controller.ts:39`, `clientAuth.controller.ts:17` |
| 18 | Talent pool | Cards never link to `/candidates/[id]`, so that page (and the profile-request form) can only be reached by typing the URL. | `src/app/candidates/page.tsx:176` |

---

## 10. Tick-off checklist

| Panel / flow | Checked | Notes |
|---|---|---|
| Setup: server, seed, Prisma Studio | ☐ | |
| Admin login / shell / logout | ☐ | |
| Dashboard | ☐ | |
| Settings: General + change password | ☐ | |
| Settings: Categories | ☐ | |
| Settings: Industries + tracking template | ☐ | |
| Settings: Email/SMTP | ☐ | |
| Settings: AI Assistant | ☐ | |
| Team: Users | ☐ | |
| Team: Roles & Perms | ☐ | |
| CRM: Clients (list, import/export) | ☐ | |
| CRM: Client detail (tags, tabs, portal users, approve/reject) | ☐ | |
| CRM: Deals board + detail | ☐ | |
| CRM: Follow-Ups | ☐ | |
| CRM: Enquiries + convert | ☐ | |
| Recruitment: Job Orders + detail + publish | ☐ | |
| Recruitment: Candidates list | ☐ | |
| Recruitment: Import from CV | ☐ | |
| Recruitment: Candidate detail (edit/history/docs) | ☐ | |
| Recruitment: CV Registrations | ☐ | |
| Recruitment: Interviews | ☐ | |
| Recruitment: Share Profile (single) | ☐ | |
| Recruitment: Profile Shares list/detail/schedule/withdraw | ☐ | |
| Recruitment: Bulk Share | ☐ | |
| Recruitment: Profile Requests | ☐ | |
| Recruitment: Candidate Tracking + document requests | ☐ | |
| HRMS: Employees | ☐ | |
| HRMS: Attendance | ☐ | |
| HRMS: Leave | ☐ | |
| Payroll | ☐ | |
| Outsourcing | ☐ | |
| Documents | ☐ | |
| Finance: Invoices / Proforma / Quotations | ☐ | |
| Finance: Accounts + transfer + ledger | ☐ | |
| Finance: Expenses + approve/pay/receipt | ☐ | |
| Finance: Budgets | ☐ | |
| Finance: Overview | ☐ | |
| Emails: Compose + schedule | ☐ | |
| Emails: Templates | ☐ | |
| Emails: Groups | ☐ | |
| Emails: Campaigns | ☐ | |
| Emails: History | ☐ | |
| Reports (8 sections + exports) | ☐ | |
| Site Editor | ☐ | |
| Admin AI drawer (not-configured error) | ☐ | |
| Candidate: register (CV, OTP dev code, password) | ☐ | |
| Candidate: login blocked until approval | ☐ | |
| Candidate: dashboard + document requests | ☐ | |
| Candidate: profile + change password | ☐ | |
| Candidate: My Applications | ☐ | |
| Candidate: Shared With | ☐ | |
| Candidate: My Tracking | ☐ | |
| Company: register (OTP) + pending state | ☐ | |
| Company: dashboard | ☐ | |
| Company: candidates + respond (shortlist/interview/reject) | ☐ | |
| Company: public view/[token] | ☐ | |
| Company: jobs request → admin publish | ☐ | |
| Company: team invite + accept-invite | ☐ | |
| Public: home (sections, jobs strip, CV block) | ☐ | |
| Public: about / services | ☐ | |
| Public: careers + /register apply | ☐ | |
| Public: talent pool + profile request | ☐ | |
| Public: enquiry | ☐ | |
| Public: contact form | ☐ | |
| Public: AI widget (not-configured message) | ☐ | |
| E2E 7.1 Candidate lifecycle | ☐ | |
| E2E 7.2 Client lifecycle | ☐ | |
| E2E 7.3 Share → respond → interview | ☐ | |
| E2E 7.4 Payroll month | ☐ | |
| E2E 7.5 Invoice → payment → balance | ☐ | |
| Roles: ADMIN | ☐ | |
| Roles: MANAGER | ☐ | |
| Roles: RECRUITER | ☐ | |
| Roles: HR | ☐ | |
| Roles: ACCOUNTANT | ☐ | |
| Roles: VIEWER | ☐ | |
| Security spot-check (site-config secrets) | ☐ | |
