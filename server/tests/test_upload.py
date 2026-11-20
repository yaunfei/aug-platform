"""上传端点测试。"""

from __future__ import annotations

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


async def test_upload_png_and_download(client, upload_dir):
    response = await client.post(
        "/api/upload", files={"file": ("logo.png", PNG, "image/png")}
    )
    assert response.status_code == 200, response.text
    url = response.json()["data"]["url"]
    assert url.startswith("/api/uploads/")
    name = url.rsplit("/", 1)[-1]
    assert (upload_dir / name).read_bytes() == PNG

    downloaded = await client.get(url)
    assert downloaded.status_code == 200
    assert downloaded.content == PNG


async def test_upload_pag(client, upload_dir):
    response = await client.post(
        "/api/upload", files={"file": ("design.pag", b"pag-bytes", "application/octet-stream")}
    )
    assert response.status_code == 200
    assert response.json()["data"]["filename"].endswith(".pag")


async def test_reject_bad_extension(client, upload_dir):
    response = await client.post(
        "/api/upload", files={"file": ("evil.gif", b"GIF89a", "image/gif")}
    )
    assert response.status_code == 400
    assert response.json()["errorCode"] == "VALIDATION_ERROR"


async def test_reject_bad_mime(client, upload_dir):
    response = await client.post(
        "/api/upload", files={"file": ("evil.png", b"data", "text/html")}
    )
    assert response.status_code == 400


async def test_reject_empty(client, upload_dir):
    response = await client.post(
        "/api/upload", files={"file": ("empty.png", b"", "image/png")}
    )
    assert response.status_code == 400


async def test_reject_oversize(client, upload_dir):
    big = b"0" * (5 * 1024 * 1024 + 1)
    response = await client.post(
        "/api/upload", files={"file": ("big.png", big, "image/png")}
    )
    assert response.status_code == 413
    assert response.json()["errorCode"] == "PAYLOAD_TOO_LARGE"


async def test_invalid_filename_download(client, upload_dir):
    response = await client.get("/api/uploads/not-a-valid-name.exe")
    assert response.status_code == 400
    response = await client.get("/api/uploads/" + "a" * 32 + ".png")
    assert response.status_code == 400
