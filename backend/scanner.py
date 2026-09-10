import os
import re

SECRET_PATTERNS = {
    "API Key": r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?[^'\"\s]+['\"]?",
    "Password": r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?[^'\"\s]+['\"]?",
    "Secret Key": r"(?i)(secret[_-]?key|secretkey)\s*[:=]\s*['\"]?[^'\"\s]+['\"]?",
    "Token": r"(?i)(access[_-]?token|auth[_-]?token)\s*[:=]\s*['\"]?[^'\"\s]+['\"]?",
}


def scan_file(file_path):
    findings = []

    try:
        with open(
            file_path,
            "r",
            encoding="utf-8",
            errors="ignore"
        ) as file:
            content = file.read()

        for secret_type, pattern in SECRET_PATTERNS.items():

            matches = re.finditer(pattern, content)

            for match in matches:
                line_number = content[:match.start()].count("\n") + 1

                findings.append({
                    "type": secret_type,
                    "file": file_path,
                    "line": line_number,
                    "severity": "CRITICAL",
                    "confidence": "HIGH",
                    "message": f"Possible exposed {secret_type} detected"
                })

    except Exception:
        pass

    return findings


def scan_directory(directory):
    findings = []

    ignored_folders = {
        "node_modules",
        ".git",
        "__pycache__",
        "venv"
    }

    for root, dirs, files in os.walk(directory):

        # Ignore unnecessary folders
        dirs[:] = [
            d for d in dirs
            if d not in ignored_folders
        ]

        for filename in files:

            file_path = os.path.join(root, filename)

            # Skip binary/large files
            if os.path.getsize(file_path) > 5 * 1024 * 1024:
                continue

            findings.extend(scan_file(file_path))

    return findings