from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import os
import shutil
import zipfile
import tempfile
import re
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from scanner import scan_directory
from risk_engine import calculate_risk
from recommendation_engine import generate_recommendations


app = FastAPI(title="DevSecOps Risk Platform")


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://securedeploy-1.onrender.com",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# HOME
# ---------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "DevSecOps Risk Platform is running!",
        "status": "success"
    }


# ---------------------------------------------------------
# ZIP PROJECT SCAN
# ---------------------------------------------------------

@app.post("/scan")
async def scan_project(file: UploadFile = File(...)):

    try:
        os.makedirs("uploads", exist_ok=True)

        zip_path = os.path.join("uploads", file.filename)

        # Save uploaded ZIP
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract and scan
        with tempfile.TemporaryDirectory() as temp_dir:

            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)

            findings = scan_directory(temp_dir)

            risk = calculate_risk(findings)

            recommendations = generate_recommendations(findings)

        return {
            "message": "Security scan completed",
            "filename": file.filename,
            "status": "completed",
            "source": "zip",
            "total_issues": len(findings),
            "findings": findings,
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "release_status": risk["release_status"],
            "recommendations": recommendations
        }

    except zipfile.BadZipFile:

        return {
            "status": "error",
            "message": "Invalid ZIP file."
        }

    except Exception as error:

        return {
            "status": "error",
            "message": f"ZIP scan failed: {str(error)}"
        }


# ---------------------------------------------------------
# GITHUB REPOSITORY SCAN
# ---------------------------------------------------------

@app.post("/scan-github")
async def scan_github(repo_url: str):

    try:

        # -------------------------------------------------
        # Validate GitHub URL
        # -------------------------------------------------

        repo_url = repo_url.strip()

        match = re.match(
            r"^https://github\.com/([^/]+)/([^/]+)/?$",
            repo_url
        )

        if not match:
            return {
                "status": "error",
                "message": "Please enter a valid public GitHub repository URL."
            }

        owner = match.group(1)
        repo = match.group(2)

        # -------------------------------------------------
        # Get repository information
        # -------------------------------------------------

        api_url = f"https://api.github.com/repos/{owner}/{repo}"

        request = Request(
            api_url,
            headers={
                "User-Agent": "DevSecOps-Risk-Platform",
                "Accept": "application/vnd.github+json"
            }
        )

        with urlopen(request, timeout=20) as response:

            repo_data = response.read().decode("utf-8")

        import json

        repo_info = json.loads(repo_data)

        default_branch = repo_info.get(
            "default_branch",
            "main"
        )

        # -------------------------------------------------
        # Download repository ZIP
        # -------------------------------------------------

        github_zip_url = (
            f"https://github.com/{owner}/{repo}"
            f"/archive/refs/heads/{default_branch}.zip"
        )

        download_request = Request(
            github_zip_url,
            headers={
                "User-Agent": "DevSecOps-Risk-Platform"
            }
        )

        os.makedirs("uploads", exist_ok=True)

        zip_path = os.path.join(
            "uploads",
            f"{owner}_{repo}_github.zip"
        )

        with urlopen(
            download_request,
            timeout=60
        ) as response:

            with open(zip_path, "wb") as output:

                shutil.copyfileobj(
                    response,
                    output
                )

        # -------------------------------------------------
        # Extract and scan repository
        # -------------------------------------------------

        with tempfile.TemporaryDirectory() as temp_dir:

            with zipfile.ZipFile(
                zip_path,
                "r"
            ) as zip_ref:

                zip_ref.extractall(temp_dir)

            findings = scan_directory(temp_dir)

            risk = calculate_risk(findings)

            recommendations = generate_recommendations(
                findings
            )

        # -------------------------------------------------
        # Return result
        # -------------------------------------------------

        return {
            "message": "GitHub security scan completed",
            "filename": f"{owner}/{repo}",
            "status": "completed",
            "source": "github",
            "repository": repo_url,
            "branch": default_branch,
            "total_issues": len(findings),
            "findings": findings,
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "release_status": risk["release_status"],
            "recommendations": recommendations
        }

    except HTTPError as error:

        if error.code == 404:

            return {
                "status": "error",
                "message": "GitHub repository not found. Make sure it is public and the URL is correct."
            }

        return {
            "status": "error",
            "message": f"GitHub request failed: HTTP {error.code}"
        }

    except URLError:

        return {
            "status": "error",
            "message": "Could not connect to GitHub. Check your internet connection."
        }

    except zipfile.BadZipFile:

        return {
            "status": "error",
            "message": "GitHub repository download was not a valid ZIP file."
        }

    except Exception as error:

        return {
            "status": "error",
            "message": f"GitHub scan failed: {str(error)}"
        }