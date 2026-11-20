"""上传端点：png/jpg/jpeg/webp + .pag，≤5MB。"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

from ..config import settings
from ..responses import AppError, ErrorCode, ok

router = APIRouter(tags=["upload"])

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_SUFFIXES = IMAGE_SUFFIXES | {".pag"}
IMAGE_MIME = {"image/png", "image/jpeg", "image/webp"}
FILENAME_RE = re.compile(r"^[0-9a-f]{32}\.(png|jpg|jpeg|webp|pag)$")
MAX_FILE_BYTES = 5 * 1024 * 1024


def uploads_dir() -> Path:
    path = Path(settings.uploads_path) if hasattr(settings, "uploads_path") else Path("uploads")
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    original = file.filename or ""
    suffix = Path(original).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise AppError(ErrorCode.VALIDATION_ERROR, "仅支持 png/jpg/jpeg/webp/pag 文件")
    if suffix in IMAGE_SUFFIXES and file.content_type not in IMAGE_MIME:
        raise AppError(ErrorCode.VALIDATION_ERROR, "文件 MIME 类型不在白名单内")
    content = await file.read()
    if not content:
        raise AppError(ErrorCode.VALIDATION_ERROR, "文件不能为空")
    if len(content) > MAX_FILE_BYTES:
        raise AppError(ErrorCode.PAYLOAD_TOO_LARGE, "文件不能超过 5MB")
    name = f"{uuid.uuid4().hex}{suffix}"
    (uploads_dir() / name).write_bytes(content)
    return ok({"url": f"/api/uploads/{name}", "filename": name, "size": len(content)})


@router.get("/api/uploads/{filename}")
async def read_upload(filename: str):
    if not FILENAME_RE.match(filename):
        raise AppError(ErrorCode.VALIDATION_ERROR, "非法文件名")
    path = uploads_dir() / filename
    if not path.exists():
        raise AppError(ErrorCode.VALIDATION_ERROR, "文件不存在")
    return FileResponse(path)
