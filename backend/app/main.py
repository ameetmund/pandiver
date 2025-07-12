from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import pdfplumber
import io
import pandas as pd
import openpyxl
import json

app = FastAPI()

# CORS setup
origins = [
    "http://localhost:3000",  # Next.js default
    "http://127.0.0.1:3000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_text_blocks(pdf_bytes):
    results = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            blocks = []
            for char in page.extract_words(x_tolerance=1, y_tolerance=1):
                block = {
                    "text": char["text"],
                    "x0": char["x0"],
                    "y0": char["top"],
                    "x1": char["x1"],
                    "y1": char["bottom"]
                }
                blocks.append(block)
            results.append({
                "page": page_num,
                "blocks": blocks
            })
    return results

@app.post("/extract")
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")
    pdf_bytes = await file.read()
    try:
        blocks = extract_text_blocks(pdf_bytes)
        return JSONResponse(content={"pages": blocks})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export")
async def export_table(request: Request):
    data = await request.json()
    df = pd.DataFrame(data.get("table", []))
    fmt = data.get("format", "xlsx")
    output = io.BytesIO()
    if fmt == "csv":
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=table.csv"})
    else:
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=table.xlsx"})
