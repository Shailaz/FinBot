# FinBot — AI Loan Advisor

FinBot is a conversational loan-advisor demo built for the IIIT Guwahati FinTech AI project. A React chat interface collects a loan request, a FastAPI backend coordinates the conversation, and a deterministic rules engine evaluates eligibility. The demo uses a mock CRM and Groq's LLaMA 3.3 70B model for language tasks.

> **Demo only:** FinBot uses mock customer/KYC data and illustrative lending rules. It is not a real lender, credit decision, financial offer, or production KYC system.

## Features

- Natural-language collection of loan amount, tenure, purpose, and income.
- Phone and PAN format checks with lookup against a mock CRM.
- Deterministic loan eligibility rules and EMI calculation.
- Chat stages and application summary in the React UI.
- Sanction-letter text generation for approved applications (PDF generation is future work).
- FastAPI endpoints for chat, session lookup/reset, and health checks.

## Architecture

```text
Customer
   │
   ▼
React + Vite chat UI
   │  POST /chat
   ▼
FastAPI backend
   │
   ▼
Master Agent — owns conversation stages and routes work
   ├── Sales Agent          Groq extraction of loan details
   ├── Verification Agent   Groq-assisted extraction + mock CRM/PAN checks
   ├── Underwriting Agent   deterministic rules + Groq explanation wording
   └── Sanction Service     creates a text sanction letter for approved cases
          │
          ├── In-memory session store
          ├── Mock CRM (JSON-like Python records)
          └── Underwriting rules engine
```

The Master Agent manages the stages `greeting → sales → verification → underwriting → approved/rejected`. It orchestrates the workflow and does not make the financial decision. The underwriting rules engine makes that decision; the language model is used for extraction and explanation text, not approval logic. In the current code, sanction generation is a backend service rather than a separate LLM worker agent.

### Agent responsibilities

| Component | Responsibility |
| --- | --- |
| Master Agent | Maintains conversation state, routes messages, and coordinates workers. |
| Sales Agent | Extracts `loan_amount`, `tenure_months`, purpose, and monthly income from free text; understands common amount and duration phrasing. |
| Verification Agent | Collects and validates a 10-digit phone number and PAN (`ABCDE1234F` format), looks up the mock CRM record, and checks the PAN match. Loads CRM income, credit score, pre-approved limit, and salary-slip status into the session. |
| Underwriting Agent | Calls the deterministic rules engine and uses Groq only to phrase the result for the customer. |
| Sanction Service | Generates a `.txt` sanction-letter placeholder for approved applications. |

## Sample conversation

```text
User: I need a home renovation loan
Bot: Great! How much would you like to borrow and for how long?

User: 2 lakh for 24 months, my salary is 50000
Bot: Got it — ₹2,00,000 over 24 months. To verify your identity, please share your mobile number.

User: 9876543210
Bot: And your PAN card number?

User: ABCDE1234F
Bot: KYC verified, Rahul Sharma! Your loan is approved.
     Monthly EMI: about ₹9,982 at 18% p.a.
     Sanction letter is ready.
```

The CRM record for this demo phone supplies the underwriting income and other customer attributes. The sanction output is currently plain text saved under `/tmp/finbot_sanctions/`; PDF generation and a working download route are future improvements.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Axios, React Markdown, Lucide React |
| Backend/API | Python 3.11, FastAPI, Pydantic, Uvicorn |
| Language model | Groq API, `llama-3.3-70b-versatile` |
| Eligibility | Python deterministic rules engine; reducing-balance EMI formula |
| Demo customer data | Mock CRM records in Python |
| Session state | In-memory Python store (resets on process restart) |

## Underwriting rules

Configure thresholds in [`backend/rules/underwriting_rules.py`](backend/rules/underwriting_rules.py). Rules are evaluated in order; the first failing rule rejects the application.

| Setting | Default |
| --- | ---: |
| Minimum credit score | 700 |
| Maximum loan-to-monthly-income ratio | 36× |
| Maximum EMI-to-monthly-income ratio | 40% |
| Maximum loan amount | ₹20,00,000 |
| Minimum loan amount | ₹10,000 |
| Minimum tenure | 6 months |
| Maximum tenure | 60 months |
| Annual interest rate | 18% p.a. |
| Above-limit multiplier | 2× pre-approved limit; valid salary slip required above the pre-approved limit |

The engine checks loan bounds, tenure, credit score, pre-approved limit, loan-to-income ratio, and EMI affordability. It calculates EMI using the standard reducing-balance formula.

## Demo accounts

Use the phone and matching PAN when the chat asks for identity details. CRM values below are the values used by underwriting.

| Phone | PAN | Credit score | CRM monthly income | Demo outcome |
| --- | --- | ---: | ---: | --- |
| `9876543210` | `ABCDE1234F` | 750 | ₹60,000 | Likely approval, subject to requested loan terms and all rules |
| `9123456780` | `FGHIJ5678K` | 680 | ₹35,000 | Rejected: credit score below 700 |
| `9988776655` | `LMNOP9012Q` | 610 | ₹25,000 | Rejected: credit score below 700; salary slip is not verified |
| `8000000001` | `RSTUV3456W` | 720 | ₹45,000 | Likely approval, subject to requested loan terms and all rules |

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Groq API key from [Groq Console](https://console.groq.com/)

### Backend

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows PowerShell instead:
# .\venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

Add your key to `backend/.env`:

```env
GROQ_API_KEY=your_key_here
```

Start the API from the `backend` directory:

```bash
uvicorn main:app --reload --port 8000
```

The backend is at `http://localhost:8000`; interactive API docs are at `http://localhost:8000/docs`. Health check: `http://localhost:8000/health`.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The frontend uses the local Vite proxy to connect to the backend at `http://localhost:8000`.

> The repository does not currently include `backend/.env.example`; create `backend/.env` yourself with `GROQ_API_KEY=...` if the copy command cannot find the example file.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/chat` | Send `{ "session_id": "optional", "message": "..." }`; returns session ID, reply, stage, loan data, and optional sanction URL. |
| `GET` | `/session/{session_id}` | Read the in-memory session. |
| `DELETE` | `/session/{session_id}` | Reset/delete the session. |
| `GET` | `/health` | Basic health check. |

## Future scope

- Replace the mock CRM with real KYC, PAN, and credit-bureau integrations.
- Generate proper PDF sanction letters with `fpdf2` or another PDF library and provide a working download endpoint.
- Use Redis for session storage and horizontal scaling.
- Add WhatsApp/SMS support with Twilio.
- Add fraud and AML detection agents.
- Add multilingual support (Hindi, Tamil, and others).
- Add cross-sell agents for credit cards, insurance, and BNPL.
- Add Firebase Authentication for user identity management.

## License

MIT. See the [MIT License](https://opensource.org/license/mit) for terms. Add a `LICENSE` file to the repository to distribute the license text with the project.
