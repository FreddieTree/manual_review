# **Manual Review Platform for Biomedical Assertion Auditing**

A high-integrity, extensible, and auditable platform for **double-review human curation of sentence-level biomedical assertions**. Designed for teams working with AI/NLP outputs (such as LLM-generated triples/assertions) in biomedical literature mining, this system ensures traceability, consensus, and quality control for structured knowledge creation.

## **Project Structure**

```
.
├── backend/                # Python Flask backend (API, logic, storage)
│   ├── app.py              # Main Flask app entrypoint
│   ├── config.py           # Global configuration (admin, secrets, timeouts, payments)
│   ├── wsgi.py             # WSGI entry for production (Gunicorn)
│   ├── domain/             # Domain objects and business logic
│   │   └── assertions.py
│   ├── models/             # Data models and IO
│   │   ├── abstracts.py
│   │   ├── logs.py
│   │   └── reviewers.py
│   ├── routes/             # All API endpoints (modular blueprints)
│   │   ├── admin.py
│   │   ├── arbitration.py
│   │   ├── auth.py
│   │   ├── export.py
│   │   ├── meta.py
│   │   ├── pricing.py
│   │   ├── reviewers.py
│   │   └── tasks.py
│   ├── schemas/            # Pydantic/data schemas (validation, serialization)
│   ├── services/           # Service layer (assignment, pricing, stats, arbitration)
│   │   ├── aggregation.py
│   │   ├── arbitration.py
│   │   ├── assignment.py
│   │   ├── audit.py
│   │   ├── pricing.py
│   │   ├── stats.py
│   │   └── vocab.py
│   ├── templates/          # Fallback/minimal Jinja2 HTML templates
│   └── utils/              # Helper functions/utilities
│       └── __init__.py
│
├── frontend/               # React SPA frontend (reviewer/admin UI)
│   ├── public/
│   ├── src/
│   │   ├── api/            # API client (axios/fetch)
│   │   ├── components/     # Modular React components
│   │   ├── hooks/          # React custom hooks
│   │   ├── pages/          # Page-level components
│   │   ├── styles/         # CSS/tailwind etc.
│   │   └── main.jsx        # Frontend entrypoint
│   ├── tests/              # Frontend tests (Jest/Vitest/MSW)
│   ├── package.json        # NPM package manifest
│   └── tailwind.config.mjs
│
├── data/                   # Data files & exports
│   ├── sentence_level_gpt4.1.jsonl      # Main input dataset (abstracts + assertions)
│   ├── review_logs.jsonl                # Full append-only review logs
│   ├── reviewers.json                   # Reviewer registry
│   └── exports/                         # Exported results (consensus, CSV, etc.)
│
├── tests/                  # Backend (Flask) pytest unit/integration tests
│   └── backend/
│
├── scripts/                # Utility scripts (e.g. CSS generator)
│
├── templates/              # Main HTML templates (SSR fallback/legacy)
├── requirements.txt        # Python backend dependencies
├── environment.yml         # Conda environment (optional)
├── .env / .env.example     # Environment variables for local/dev/prod
├── README.md
└── ... (misc. config & tools)
```

## **Features**

- **Institutional Reviewer Login**: Name + @bristol.ac.uk email (no password, no verification).
- **Strict Double-Review**: Every abstract assigned to two reviewers, with random draw, lock, and timeout handling.
- **Sentence-level Assertion Review**: Accept/reject/uncertain for every assertion; add new ones (strict text match enforced).
- **Fast Keyboard Navigation**: a/u/r shortcuts and keyboard-friendly workflow.
- **Atomic Operations**: Data saved *only* on full review submit. Leave early = no effect.
- **Admin Dashboard**: Review status overview, arbitration queue, reviewer leaderboard, log export, payment calculation.
- **Full Audit Logging**: All operations (including admin actions) are fully logged (user, timestamp, details).
- **Robust Error Handling**: Locks, concurrency, task assignment, and all user actions are fail-safe and auditable.
- **Modern UI**: Responsive, accessible React+Tailwind UI for both reviewers and admin.

## Installation

1. Clone the repository and change directory:

   ```bash
   git clone https://github.com/your-org/manual_review.git
   cd manual_review
   ```

2.	Backend (Flask):

   ```bash
    python -m venv .venv
	source .venv/bin/activate
	pip install -r requirements.txt
   ```

3.	Frontend (React):
	```bash
	cd frontend
	npm install
	npm run build     # or: npm run dev  (for local hot reload)
	cd ..
	```

## Running the Server (Development)

1.	Backend (development):

   ```bash
    python backend/app.py
	# or for prod: gunicorn backend.wsgi:app --bind 0.0.0.0:8000
   ```
   API will be at http://localhost:5000 by default.


2.	Frontend (dev mode):
	```bash
	cd frontend
	npm run dev
	```
	SPA will run on http://localhost:5173 by default.


## Core Modules
	•	app.py: Main Flask app, routes, session, and error handling.
	•	config.py: All project constants and settings (admin info, timeouts, etc).
	•	models.py: Data models (abstracts, assertions, logs, users), IO operations for JSONL/SQLite.
	•	utils.py: Helper functions (text matching, field validation, highlighter, logger, etc).
	•	task_manager.py: Task assignment, locking, timeout/release, concurrent access control.
	•	reviewer.py: Review logic, state machine for assertions, shortcut management.
	•	admin_tools.py: Administrator views, arbitration actions, report and log export.
	•	static/: CSS, JS, and image assets.
	•	templates/: Jinja2 HTML templates for all pages.
	•	data/: Stores all input abstracts, logs, and review results.

## **Core Workflow**

1. **Login**: Reviewer enters name + institutional email.
2. **Assignment**: Random abstract drawn & locked for review.
3. **Review**: Reviewer must act on every assertion (accept/reject/uncertain/add).
4. **Submit**: Only after all assertions handled can review be submitted.
5. **Admin**: Admin dashboard supports arbitration, stats, export, reviewer management.

---

## **Data Integrity & Export**

- **Atomicity**: All actions per abstract are all-or-nothing. Abstracts are locked/unlocked automatically.
- **Full audit logs**: Every operation (review, admin, arbitration) logged to append-only JSONL.
- **Export**: Review status, logs, and payment calculation are exportable as CSV/JSONL from admin dashboard.

---

## **Development & Testing**

- **Use virtualenv or conda** for backend development.
- **Frontend** is React + Tailwind, fully decoupled, with Jest/Vitest/MSW test coverage.
- **Backend tests** are written with pytest.
- **For production:** Recommend Gunicorn + Nginx for backend, and static server (or Flask itself) for frontend.
- **All critical logic** (task locking, arbitration, review state) should be covered by automated tests.