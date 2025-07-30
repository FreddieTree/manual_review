# Manual Review Platform for Biomedical Assertion Auditing

This is a Flask + Jinja2 based platform for double-blind human review of biomedical sentence-level assertions. It supports randomized task assignment, reviewer session control, assertion state logging, conflict arbitration, administrator dashboard, and contributor statistics.

## Project Structure
manual_review/
├── app.py
├── config.py
├── models.py
├── utils.py
├── task_manager.py
├── reviewer.py
├── admin_tools.py
├── requirements.txt
├── README.md
│
├── static/
│   ├── css/
│   ├── js/
│   └── images/
│
├── templates/
│   ├── base.html
│   ├── login.html
│   ├── review.html
│   ├── admin.html
│   ├── no_more_tasks.html
│   └── …
│
├── data/
│   ├── abstracts.jsonl
│   ├── review_logs.jsonl
│   └── …
## Features

- **Reviewer login**: by name and @bristol.ac.uk email, no email verification.
- **Random task assignment**: each abstract is assigned to two unique reviewers, enforced by locking and release after timeout.
- **Sentence-level assertion review**: each sentence's assertions are presented for accept/reject/uncertain review and new assertion creation (with strict original text match).
- **Fast keyboard navigation**: a/u/r shortcuts for review.
- **Submission control**: can only submit after all assertions are reviewed for the current abstract.
- **Atomic operations**: no data saved if the reviewer leaves before submission.
- **Admin dashboard**: overview of review status, reviewer ranking, arbitration queue, and CSV export for reports/payments.
- **Full audit logging**: all actions are recorded with user, timestamp, and operation details.
- **Comprehensive error handling and task integrity**.

## Installation

1. Clone the repository and change directory:

   ```bash
   git clone https://github.com/your-org/manual_review.git
   cd manual_review

2.	Install required dependencies:

   ```bash
   pip install -r requirements.txt

3.	(Optional) Configure environment variables in a .env file or modify config.py.

## Running the Server (Development)

```bash
python app.py

The application will be available at http://localhost:5000

For production, use Gunicorn:
```bash
gunicorn app:app --bind 0.0.0.0:8000

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

## Workflow
1.	Login: Reviewer enters name and @bristol.ac.uk email.
	2.	Assignment: System draws an unreviewed abstract, locks it, presents for review.
	3.	Review: Reviewer marks each assertion as accept/reject/uncertain or adds new assertion (with hard-match to original sentence).
	4.	Submission: All assertions must be reviewed; system saves operation log and unlocks the abstract.
	5.	Admin: Freddie logs in as admin, can view arbitration queue, global stats, reviewer rankings, and export logs/reports.

## Data & Log Export
	•	All logs and status can be exported as JSONL or CSV via admin dashboard.
	•	Payment calculation (per-abstract, per-passed-user-add, bonuses) is automatically included in export.

## Data Integrity
	•	All actions are atomic per-abstract (either fully saved or not at all).
	•	Abstracts are locked on assignment and released on timeout/non-submission.
	•	No operation can overwrite previous logs or violate reviewer separation.

## Development Tips
	•	Use venv for local development.
	•	For UI updates, modify templates/base.html and page-specific templates.
	•	For concurrency and cache, consider adding Redis if deploying for high simultaneous access.
	•	All critical logic should have unit tests (pytest or unittest recommended).

