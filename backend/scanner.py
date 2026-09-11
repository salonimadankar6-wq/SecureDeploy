import os
import re

SECURITY_RULES = [
    {
        "type": "API Key",
        "severity": "CRITICAL",
        "confidence": "HIGH",
        "patterns": [
            r'''(?im)^[ \t]*(?:export[ \t]+)?(?:API[_-]?KEY|APIKEY)[ \t]*[:=][ \t]*(?!os\.getenv[ \t]*\()(?!os\.environ(?:\.get)?[ \t]*\()(?!process\.env\.)(?:"[^"\n]+"|'[^'\n]+'|[^\s#'"]+[^\n#]*)'''
        ],
        "message": "Possible exposed API key detected",
        "fix": "Store the API key in an environment variable instead of hard-coding it.",
    },
    {
        "type": "Password",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [
            r'''(?im)^[ \t]*(?:export[ \t]+)?(?:[A-Za-z0-9_]+_)?(?:PASSWORD|PASSWD|PWD)[ \t]*[:=][ \t]*(?!os\.getenv[ \t]*\()(?!os\.environ(?:\.get)?[ \t]*\()(?!process\.env\.)(?:"[^"\n]+"|'[^'\n]+'|[^\s#'"]+[^\n#]*)'''
        ],
        "message": "Possible hard-coded password detected",
        "fix": "Store the password in an environment variable or secure secret manager.",
    },
    {
        "type": "Secret Key",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [
            r'''(?im)^\s*(?:export\s+)?(?:SECRET[_-]?KEY|SECRETKEY)\s*[:=]\s*(?!["']?\s*$)(?!os\.getenv\s*\()(?!os\.environ(?:\.get)?\s*\()(?!process\.env\.)[^\s#]+'''
        ],
        "message": "Possible exposed secret key detected",
        "fix": "Move the secret key to an environment variable.",
    },
    {
        "type": "Access Token",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [
            r'''(?im)^\s*(?:export\s+)?(?:ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|ACCESSTOKEN|AUTHTOKEN)\s*[:=]\s*(?!["']?\s*$)(?!os\.getenv\s*\()(?!os\.environ(?:\.get)?\s*\()(?!process\.env\.)[^\s#]+'''
        ],
        "message": "Possible exposed access token detected",
        "fix": "Store access tokens securely using environment variables or a secret manager.",
    },
    {
        "type": "Private Key",
        "severity": "CRITICAL",
        "confidence": "HIGH",
        "patterns": [r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"],
        "message": "Private cryptographic key detected in source code",
        "fix": "Remove the private key from source control and store it securely.",
    },
    {
        "type": "Unsafe eval",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [r"(?m)\beval\s*\("],
        "message": "Unsafe eval() usage detected",
        "fix": "Avoid eval() and use a safe parser or explicit logic instead.",
    },
    {
        "type": "Shell Command Execution",
        "severity": "HIGH",
        "confidence": "MEDIUM",
        "patterns": [
            r"(?i)\bsubprocess\.(run|Popen|call|check_output)\s*\([^)]*shell\s*=\s*True",
            r"(?i)\bos\.system\s*\(",
        ],
        "message": "Potentially unsafe shell command execution detected",
        "fix": "Avoid shell execution with untrusted input. Prefer safe argument-based process execution.",
    },
    {
        "type": "Potential SQL Injection",
        "severity": "HIGH",
        "confidence": "MEDIUM",
        "patterns": [
            r'''(?i)(SELECT|INSERT|UPDATE|DELETE)\s+[^\n]*\+\s*[A-Za-z_][A-Za-z0-9_]*''',
            r'''(?i)(SELECT|INSERT|UPDATE|DELETE)\s+[^\n]*\{[A-Za-z_][A-Za-z0-9_]*\}''',
        ],
        "message": "Potential SQL injection pattern detected",
        "fix": "Use parameterized queries or prepared statements instead of string concatenation.",
    },
    {
        "type": "Debug Mode",
        "severity": "MEDIUM",
        "confidence": "HIGH",
        "patterns": [r"(?i)\bdebug\s*=\s*True\b", r"(?i)\bDEBUG\s*=\s*True\b"],
        "message": "Debug mode appears to be enabled",
        "fix": "Disable debug mode in production environments.",
    },
    {
        "type": "Insecure CORS",
        "severity": "MEDIUM",
        "confidence": "MEDIUM",
        "patterns": [r'''(?i)allow_origins\s*=\s*\[\s*['"]\*['"]\s*\]'''],
        "message": "CORS allows requests from any origin",
        "fix": "Restrict CORS to trusted application origins.",
    },
    {
        "type": "Insecure HTTP",
        "severity": "LOW",
        "confidence": "MEDIUM",
        "patterns": [r'''(?i)['"]http://(?!localhost\b|127\.0\.0\.1\b)'''],
        "message": "Insecure HTTP URL detected",
        "fix": "Use HTTPS for communication with external services.",
    },
    {
        "type": "Environment File Exposure",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [r"(?i)(^|[\\/])\.env$"],
        "filename_only": True,
        "message": "Environment file containing potentially sensitive configuration detected",
        "fix": "Do not commit .env files containing secrets to source control.",
    },
    {
        "type": "Credential File",
        "severity": "HIGH",
        "confidence": "HIGH",
        "patterns": [r"(?i)(credentials|credential|secrets|secret)\.(json|yml|yaml|txt|ini|cfg)$"],
        "filename_only": True,
        "message": "Potential credential file detected",
        "fix": "Remove credentials from source code and use a secure secret manager.",
    },
]

IGNORED_FOLDERS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "env", ".env", "dist", "build", ".next", "coverage"}
IGNORED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".mp3", ".mp4", ".avi", ".mov", ".pdf", ".zip", ".rar", ".7z", ".exe", ".dll", ".so", ".bin", ".pyc", ".class", ".woff", ".woff2", ".ttf", ".eot"}


def is_text_file(file_path):
    if os.path.splitext(file_path)[1].lower() in IGNORED_EXTENSIONS:
        return False
    try:
        with open(file_path, "rb") as file:
            sample = file.read(2048)
        return b"\x00" not in sample
    except Exception:
        return False


def get_relative_file(file_path, root_directory):
    try:
        return os.path.relpath(file_path, root_directory).replace("\\", "/")
    except Exception:
        return os.path.basename(file_path)


def scan_file(file_path, root_directory=None):
    findings = []
    if not is_text_file(file_path):
        return findings

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
            content = file.read()
    except Exception:
        return findings

    lines = content.splitlines()
    display_file = os.path.basename(file_path)
    relative_file = get_relative_file(file_path, root_directory or os.path.dirname(file_path))

    for rule in SECURITY_RULES:
        if rule.get("filename_only"):
            if any(re.search(pattern, display_file) for pattern in rule["patterns"]):
                findings.append({
                    "type": rule["type"], "file": file_path, "relative_file": relative_file,
                    "display_file": display_file, "line": 1, "severity": rule["severity"],
                    "confidence": rule["confidence"], "message": rule["message"], "fix": rule["fix"]
                })
            continue

        for pattern in rule["patterns"]:
            try:
                matches = re.finditer(pattern, content)
            except re.error:
                continue
            for match in matches:
                line_number = content[:match.start()].count("\n") + 1
                matched_line = lines[line_number - 1] if 0 <= line_number - 1 < len(lines) else ""
                stripped = matched_line.strip()
                if stripped.startswith("#") or stripped.startswith("//"):
                    continue
                findings.append({
                    "type": rule["type"], "file": file_path, "relative_file": relative_file,
                    "display_file": display_file, "line": line_number, "severity": rule["severity"],
                    "confidence": rule["confidence"], "message": rule["message"], "fix": rule["fix"]
                })

    return findings


def scan_directory(directory):
    findings = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in IGNORED_FOLDERS]
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                if os.path.getsize(file_path) > 5 * 1024 * 1024:
                    continue
            except OSError:
                continue
            findings.extend(scan_file(file_path, directory))

    unique = []
    seen = set()
    for finding in findings:
        key = (finding["type"], finding["relative_file"], finding["line"], finding["message"])
        if key not in seen:
            seen.add(key)
            unique.append(finding)
    return unique
