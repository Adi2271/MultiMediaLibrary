# MediaVault

Personal multi-media recommendation and tracking dashboard.

## Stack
- FastAPI + Uvicorn
- SQLite + SQLAlchemy (async)
- Jinja2 templates
- Vanilla HTML/CSS + minimal JS

## Setup

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
Search - localhost:8000 in your browser.
```
