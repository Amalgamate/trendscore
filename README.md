# Zawadi Junior Academy - SMS (v1.0.0-WIP)

![Status](https://img.shields.io/badge/Status-Work--In--Progress-orange)
![Version](https://img.shields.io/badge/Version-1.0.0--Alpha-blue)
![Curriculum](https://img.shields.io/badge/Focus-CBC--Learning-green)

## 🌟 Mission & Vision
Trends CORE V1.0 is a modern School Management System specifically engineered to meet the dynamic needs of the **Competency Based Curriculum (CBC)**. This project is currently in active development, evolving to provide seamless digital tools for learning assessment, student progression tracking, and administrative excellence.

> [!IMPORTANT]
> This is an **active project** and is currently a **Work in Progress**. Features are being rapidly iterated to stay at the forefront of CBC learning requirements.

## First Time Login (Superadmin)
To ensure immediate access upon deployment, the system automatically creates/updates a Superadmin account during server startup.

- Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `server/.env` before first boot.
- Do not commit real credentials to git. Rotate credentials immediately if they were ever shared publicly.

> [!TIP]
> This setup is handled by the `ensureSuperAdmin` utility in the backend.

## �🚀 Key CBC Features (In Development)
- **Learning Area Management**: Dynamic tracking of CBC learning areas and strands.
- **Formative & Summative Assessments**: Specialized rubric-based grading systems tailored for CBC.
- **Learner Portfolios**: Comprehensive digital footprints of student progress and competencies.
- **Parent-Teacher Connectivity**: Real-time communication for shared learner support.

## 🌐 System Portals & Roadmap (WIP)
The Trends CORE V1.0 ecosystem is designed to provide tailored experiences for every stakeholder. The following portals are currently under active development:

### 🏢 Admin Portal (Active WIP)
The centralized command center for school owners and principals.
- **Status**: Core modules live (Learner management, Financials, HR).
- **In Focus**: Advanced analytics and automated reporting.

### 👨‍👩‍👧 Parent Portal (WIP)
A dedicated interface for parents to track their child's CBC journey.
- **Key Features**: Fee statement viewing, digital progress reports, and teacher communication.
- **Status**: Initial phase integration.

### 🎓 Student Portal (WIP)
An interactive space for learners to engage with their digital portfolios.
- **Key Features**: Assignment tracking, digital achievements, and learning resources.
- **Status**: Planning & Design.

### 📱 Mobile Applications (Future Horizon)
We are building cross-platform mobile apps (iOS & Android) to bring Trends CORE V1.0 to your fingertips.
- **Parent App**: Instant push notifications for attendance and performance.
- **Teacher App**: Quick classroom management and real-time attendance marking.
- **Status**: Concept & Architecture phase.

## 🧩 Core Modules Explained

### 1. Learner & Admission Management
Digitalizes the entire student lifecycle, from admission sequences and primary contact management to automated grade progression and stream assignment.

### 2. Academic & CBC Assessment Engine
The heart of the CBC transition. Provides rubric-based assessment tools (Opening, Mid-Term, End-Term) with automated competency tracking across specific strands and sub-strands.

### 3. Financial & Fee Management
A robust accounting module that handles fee structure creation, automated invoicing, and real-time payment reconciliation via Mpesa STK Push.

### 4. HR, Staff & Payroll
Manages comprehensive staff profiles, recruitment data, performance reviews, and automated payroll generation with tax deduction (NHIF/NSSF) support.

### 5. Multi-Channel Communication
A centralized hub for sending school-wide alerts, student performance reports, and fee reminders via SMS, Email, and WhatsApp.

### 6. Inventory, Assets & Library
Tracks school assets, library books (issue/return), and inventory stock levels with automated requisition workflows.

### 7. Attendance & Operations
Smart attendance tracking for both students and staff, featuring biometric integration readiness and automated absence alerts for parents.

### 8. Analytics & Dashboards
Data-driven insights for administrators, providing real-time visuals on school performance, financial health, and student census.

## ⚡ Automated Setup (The "Seed Buttons")
To save time during the initial school setup, the system features **"Seed Buttons"** in the Admin Configuration dashboard. These trigger specialized backend endpoints to instantly populate your school with standard data:

- **Seed Streams**: Populates standard CBC streams (e.g., North, South, East, West or A, B, C).
- **Seed Classes**: Generates default class structures for Grades 1 through 6.
- **Create Default Aggregations**: Sets up standard CBC weighting (e.g., 30% Formative / 70% Summative).
- **Bulk Setup**: Automatically initializes grading scales and performance levels across all learning areas.

---

## � Formative vs. Summative Assessments
Trends CORE V1.0 handles both assessment types as defined by CBC standards:

| Feature | Formative Assessment | Summative Assessment |
| :--- | :--- | :--- |
| **Purpose** | **Assessment FOR Learning**: Continuous tracking of strands and sub-strands during the term. | **Assessment OF Learning**: Evaluation of student mastery at specific milestones (e.g., End of Term). |
| **Frequency** | Ongoing / Daily / Weekly. | Occasional (Mid-term, End-term, Yearly). |
| **Focus** | Qualitative observations, rubrics (Exceeding, Meeting, etc.), and specific skill mastery. | Quantitative scores, percentages, and performance levels calculated against set marks. |
| **Reporting** | Feeds into the continuous progress log. | Determines final termly grades and overall position in class. |
| **Weighting** | Typically accounts for **30%** of the final term grade. | Typically accounts for **70%** of the final term grade. |

---

## �📝 CBC Assessment Workflow
The software follows a logical flow to ensure data integrity for CBC reporting:

1. **Step 1: Define Grading Scales**: Create your performance levels (e.g., Exceeding, Meeting, Approaching, Below Expectation) in the **Grading System** module.
2. **Step 2: Initialize Tests**: Design your Summative Tests for the term, defining learning areas and maximum scores.
3. **Step 3: Record Assessments**:
   - **Formative**: Record day-to-day strand-based observations.
   - **Summative**: Mark termly exams and specialized performance tasks.
4. **Step 4: Finalize & Summarize**: Use the **Setup Completion** tool to trigger final score aggregations.
5. **Step 5: Generate Report Cards**: Automatically produce comprehensive CBC Progress Reports with teacher comments and competency summaries.

---

## 🏗 Architecture (Monorepo)
This project is structured as a **Monorepo** to keep the entire ecosystem synchronized:
- `/` (Root): Shared configuration, Docker orchestration, and workspace-level scripts.
- `/server`: Node.js/Express API with Prisma ORM (The brain of the system).
- `/src` & `public`: The React.js frontend application (The user interface).

## 🛠 Tech Stack (Deep Dive)
- **Database Architecture**: PostgreSQL using **Prisma** for type-safe database queries.
- **Authentication**: JWT (JSON Web Tokens) with automated refreshToken rotation.
- **Real-time Engine**: **Socket.io** for instant notifications and CBC assessment updates.
- **Caching Layer**: Dual-strategy caching (Redis for production, in-memory for dev) via `redis-cache.service`.
- **Media Management**: **Cloudinary** for secure storage of student photos and documents.
- **Communication Stack**:
  - **Email**: **Resend** for automated system emails and transactional messaging.
  - **SMS**: Integrated with **Africa's Talking** for high-reliability mobile alerts.
  - **WhatsApp**: API-driven outreach for parent engagement and automated reports.
- **FinTech & Payments**:
  - **Mpesa Integration**: Secure fee payment processing via Safaricom's **Daraja API** (STK Push & C2B).
- **Security**: Helmet, CORS, and custom rate-limiting middleware.

## 📋 Prerequisites
Before you begin the installation, ensure you have the following credentials and environment setups ready:

### 1. Core Requirements
- **Node.js**: `v18.x` or higher.
- **npm**: `v9.x` or higher.
- **Docker**: Optional (for local Redis/Postgres testing).

### 2. External Services (Essential)
- **PostgreSQL Database**: `DATABASE_URL` and optional `DIRECT_URL`.
- **Cloudinary Account**: For media storage.
- **Resend API Key**: For email services.
- **Africa's Talking**: API Key and Username for SMS services.
- **Safaricom Daraja API**: Consumer Key, Secret, and Passkey for Mpesa payments.
- **Redis Instance**: (Upstash or local Docker) for the caching layer.

### 3. Environment Variables
You will need to create `.env` files in both the root and the `/server` directory based on the `.env.example` templates provided.

---

## 🚢 Deployment (CI/CD)

- **Push to `main`**: builds Docker images, then deploys **demo only** (see `.github/workflows/deploy-demo.yml`).
- **Production / pilot / individual schools**: run the **Promote Release** workflow manually with an image tag and target (see `.github/workflows/promote-release.yml`).
- **Instance registry**: `deploy/instances.manifest.json` — add each school stack (`tier`, `compose_project`, `env_file`).
- **Full guide**: [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)

Configure GitHub Environments `deploy-demo`, `deploy-pilot`, `deploy-production-school`, and `deploy-production-all` with required reviewers for production promotes.

---

## 👨‍💻 Detailed Installation

### Step 1: Clone and Root Setup
```bash
git clone https://github.com/Amalgamate/zawadijrn.git
cd zawadijrn
npm install
```

### Step 2: Backend Configuration
```bash
cd server
npm install
# Copy env and fill your secrets
cp .env.example .env
# Sync your database schema
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Step 3: Frontend Setup
```bash
# From the root directory
npm install
npm run dev
```

---
© 2026 Zawadi Junior Academy. Managed by Amalgamate.
