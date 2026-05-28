from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from database import engine, Base
from routers import search


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="MediaVault", version="0.1.0", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(search.router)


@app.get("/")
async def homepage(request: Request):
    return templates.TemplateResponse("index.html", {
        "request":  request,
        "results":  [],
        "query":    "",
        "category": "anime",
        "error":    None,
    })