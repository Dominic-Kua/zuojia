#!/usr/bin/env python3
import sys
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import logging

app = FastAPI()
logger = logging.getLogger("ä½å®¶-helper")
logging.basicConfig(level=logging.INFO)

class SnapshotRequest(BaseModel):
    message: str = "autosnapshot"
    path: str = ""

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/snapshot")
async def snapshot(req: SnapshotRequest):
    repo_path = req.path or os.getcwd()
    # Create a local snapshot (git commit) — lightweight: stage all and commit
    try:
        subprocess.check_call(["git", "add", "-A"], cwd=repo_path)
        subprocess.check_call(["git", "commit", "-m", req.message], cwd=repo_path)
        return {"status": "committed", "message": req.message}
    except subprocess.CalledProcessError as e:
        logger.exception("git snapshot failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export")
async def export(req: dict):
    # Placeholder: orchestrate pandoc export; expect keys: repo_path, output_path, metadata
    repo_path = req.get("repo_path", os.getcwd())
    output = req.get("output", "export.pdf")
    # This is a noop stub for now — real implementation will collect chapters and call pandoc
    try:
        # Example: run pandoc --version to confirm availability
        subprocess.check_call(["pandoc", "--version"])  
        return {"status": "ok", "output": output}
    except Exception as e:
        logger.exception("export failed")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Allow optional port argument
    import uvicorn
    port = 5178
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    uvicorn.run(app, host="127.0.0.1", port=port)
