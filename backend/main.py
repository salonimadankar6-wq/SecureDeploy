from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import os
import shutil
import zipfile
import tempfile
import re
import json

from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from scanner import scan_directory
from risk_engine import calculate_risk
from recommendation_engine import generate_recommendations


# =========================================================
# ATTACH SOURCE CODE TO FINDINGS
# =========================================================

def attach_source_code(findings, temp_dir):

    for finding in findings:

        file_path = finding.get("file")

        if not file_path:
            continue

        try:

            if os.path.isabs(file_path):

                relative_path = os.path.relpath(
                    file_path,
                    temp_dir
                )

            else:

                relative_path = file_path

            if relative_path.startswith(".."):
                continue

            full_path = os.path.join(
                temp_dir,
                relative_path
            )

            if not os.path.isfile(full_path):
                continue

            with open(
                full_path,
                "r",
                encoding="utf-8",
                errors="replace"
            ) as code_file:

                finding["code"] = code_file.read()

            finding["display_file"] = os.path.basename(
                full_path
            )

            finding["relative_file"] = (
                relative_path.replace("\\", "/")
            )

        except Exception:
            continue

    return findings


# =========================================================
# SAFE ZIP EXTRACTION
# =========================================================

def safe_extract_zip(zip_ref, extract_path):

    for member in zip_ref.infolist():

        member_path = os.path.abspath(
            os.path.join(
                extract_path,
                member.filename
            )
        )

        extract_root = os.path.abspath(
            extract_path
        )

        if not member_path.startswith(
            extract_root + os.sep
        ) and member_path != extract_root:

            raise ValueError(
                "Unsafe ZIP file detected."
            )

    zip_ref.extractall(extract_path)


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="SecureDeploy Security Platform"
)


# =========================================================
# CORS
# =========================================================

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


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message": "SecureDeploy Security Platform is running!",
        "status": "success"
    }


# =========================================================
# ZIP PROJECT SCAN
# =========================================================

@app.post("/scan")
async def scan_project(
    file: UploadFile = File(...)
):

    try:

        # -------------------------------------------------
        # Validate file
        # -------------------------------------------------

        if not file.filename:

            return {
                "status": "error",
                "message": "No file selected."
            }

        if not file.filename.lower().endswith(".zip"):

            return {
                "status": "error",
                "message": "Please upload a ZIP file."
            }

        # -------------------------------------------------
        # Create upload directory
        # -------------------------------------------------

        os.makedirs(
            "uploads",
            exist_ok=True
        )

        safe_filename = os.path.basename(
            file.filename
        )

        zip_path = os.path.join(
            "uploads",
            safe_filename
        )

        # -------------------------------------------------
        # Save uploaded ZIP
        # -------------------------------------------------

        with open(
            zip_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

        # -------------------------------------------------
        # Extract and scan
        # -------------------------------------------------

        with tempfile.TemporaryDirectory() as temp_dir:

            with zipfile.ZipFile(
                zip_path,
                "r"
            ) as zip_ref:

                safe_extract_zip(
                    zip_ref,
                    temp_dir
                )

            # ---------------------------------------------
            # SECURITY SCAN
            # ---------------------------------------------

            findings = scan_directory(
                temp_dir
            )

            # ---------------------------------------------
            # ATTACH ACTUAL SOURCE CODE
            # ---------------------------------------------

            findings = attach_source_code(
                findings,
                temp_dir
            )

            # ---------------------------------------------
            # CALCULATE DYNAMIC RISK
            # ---------------------------------------------

            risk = calculate_risk(
                findings
            )

            # ---------------------------------------------
            # GENERATE RECOMMENDATIONS
            # ---------------------------------------------

            recommendations = generate_recommendations(
                findings
            )

        # -------------------------------------------------
        # RETURN RESULT
        # -------------------------------------------------

        return {

            "message":
                "Security scan completed",

            "filename":
                safe_filename,

            "status":
                "completed",

            "source":
                "zip",

            "total_issues":
                len(findings),

            "findings":
                findings,

            "risk_score":
                risk["risk_score"],

            "risk_level":
                risk["risk_level"],

            "release_status":
                risk["release_status"],

            "recommendations":
                recommendations
        }

    except zipfile.BadZipFile:

        return {
            "status": "error",
            "message": "Invalid ZIP file."
        }

    except ValueError as error:

        return {
            "status": "error",
            "message": str(error)
        }

    except Exception as error:

        return {
            "status": "error",
            "message":
                f"ZIP scan failed: {str(error)}"
        }


# =========================================================
# GITHUB REPOSITORY SCAN
# =========================================================

@app.post("/scan-github")
async def scan_github(
    repo_url: str
):

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
                "message":
                    "Please enter a valid public GitHub repository URL."
            }

        owner = match.group(1)
        repo = match.group(2)

        # -------------------------------------------------
        # Get repository information
        # -------------------------------------------------

        api_url = (
            f"https://api.github.com/repos/"
            f"{owner}/{repo}"
        )

        request = Request(

            api_url,

            headers={
                "User-Agent":
                    "SecureDeploy",
                "Accept":
                    "application/vnd.github+json"
            }
        )

        with urlopen(
            request,
            timeout=20
        ) as response:

            repo_data = response.read().decode(
                "utf-8"
            )

        repo_info = json.loads(
            repo_data
        )

        default_branch = repo_info.get(
            "default_branch",
            "main"
        )

        # -------------------------------------------------
        # Download repository ZIP
        # -------------------------------------------------

        github_zip_url = (
            f"https://github.com/"
            f"{owner}/{repo}"
            f"/archive/refs/heads/"
            f"{default_branch}.zip"
        )

        download_request = Request(

            github_zip_url,

            headers={
                "User-Agent":
                    "SecureDeploy"
            }
        )

        os.makedirs(
            "uploads",
            exist_ok=True
        )

        zip_path = os.path.join(
            "uploads",
            f"{owner}_{repo}_github.zip"
        )

        with urlopen(
            download_request,
            timeout=60
        ) as response:

            with open(
                zip_path,
                "wb"
            ) as output:

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

                safe_extract_zip(
                    zip_ref,
                    temp_dir
                )

            # ---------------------------------------------
            # SECURITY SCAN
            # ---------------------------------------------

            findings = scan_directory(
                temp_dir
            )

            # ---------------------------------------------
            # ATTACH SOURCE CODE
            # ---------------------------------------------

            findings = attach_source_code(
                findings,
                temp_dir
            )

            # ---------------------------------------------
            # DYNAMIC RISK
            # ---------------------------------------------

            risk = calculate_risk(
                findings
            )

            # ---------------------------------------------
            # RECOMMENDATIONS
            # ---------------------------------------------

            recommendations = (
                generate_recommendations(
                    findings
                )
            )

        # -------------------------------------------------
        # RETURN GITHUB RESULT
        # -------------------------------------------------

        return {

            "message":
                "GitHub security scan completed",

            "filename":
                f"{owner}/{repo}",

            "status":
                "completed",

            "source":
                "github",

            "repository":
                repo_url,

            "branch":
                default_branch,

            "total_issues":
                len(findings),

            "findings":
                findings,

            "risk_score":
                risk["risk_score"],

            "risk_level":
                risk["risk_level"],

            "release_status":
                risk["release_status"],

            "recommendations":
                recommendations
        }

    except HTTPError as error:

        if error.code == 404:

            return {
                "status": "error",
                "message":
                    "GitHub repository not found. "
                    "Make sure it is public and the URL is correct."
            }

        return {
            "status": "error",
            "message":
                f"GitHub request failed: HTTP {error.code}"
        }

    except URLError:

        return {
            "status": "error",
            "message":
                "Could not connect to GitHub. "
                "Check your internet connection."
        }

    except zipfile.BadZipFile:

        return {
            "status": "error",
            "message":
                "GitHub repository download was not a valid ZIP file."
        }

    except ValueError as error:

        return {
            "status": "error",
            "message": str(error)
        }

    except Exception as error:

        return {
            "status": "error",
            "message":
                f"GitHub scan failed: {str(error)}"
        }