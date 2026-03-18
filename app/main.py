from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.registry import get_handler
import pydicom
import numpy as np
from PIL import Image
import io

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def home():
    index_path = Path("static/index.html")
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html не найден"}

def process_image(file_bytes, filename):

    if filename.lower().endswith(".dcm"):
        ds = pydicom.dcmread(io.BytesIO(file_bytes))

        img_array = ds.pixel_array.astype(float)

        img_array -= np.min(img_array)
        img_array /= np.max(img_array)
        img_array *= 255

        img_array = img_array.astype(np.uint8)

        if "PixelSpacing" in ds:
            spacing = tuple(map(float, ds.PixelSpacing))
        else:
            spacing = (None, None)

        return img_array, spacing

    else:
        img = Image.open(io.BytesIO(file_bytes)).convert("L")
        img_array = np.array(img)

        return img_array, (None, None)

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    scan_type: str = Form(...),
    age: int = Form(...),
    age_unit: str = Form(...)
):
    handler = get_handler(scan_type)

    if handler is None:
        return {"status": "error", "message": f"Handler для '{scan_type}' не найден"}

    file_bytes = await file.read()

    img_array, pixel_spacing = process_image(file_bytes, file.filename)

    age_index = 0 if age_unit == "months" else 1

    handler_result = handler.handle({
        "image": img_array,
        "pixel_spacing": pixel_spacing,
        "age": age,
        "age_unit": age_unit,
        "age_index": age_index
    })


    return {
        "status": "ok",
        "scan_type": scan_type,
        "pixel_spacing": pixel_spacing,
        "image_path": handler_result.get("image_path"),
        "json_path": handler_result.get("json_path"),
        "raw_points": handler_result.get("raw_points"),
        "analysis": handler_result.get("analysis")
    }