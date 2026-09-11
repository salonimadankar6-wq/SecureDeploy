def generate_recommendations(findings):
    """
    Generate actionable security recommendations
    based on the actual vulnerabilities detected.
    """

    recommendations = []

    recommendation_map = {

        "API Key": {
            "issue": "Exposed API Key",
            "priority": "IMMEDIATE",
            "recommendation": (
                "Remove the API key from source code, rotate the exposed "
                "key, and store it using environment variables or a "
                "secure secret manager."
            )
        },

        "Password": {
            "issue": "Hard-coded Password",
            "priority": "IMMEDIATE",
            "recommendation": (
                "Remove the password from source code and use environment "
                "variables or a secure secret manager."
            )
        },

        "Secret Key": {
            "issue": "Exposed Secret Key",
            "priority": "IMMEDIATE",
            "recommendation": (
                "Remove the secret key from the repository and rotate "
                "the affected credential."
            )
        },

        "Access Token": {
            "issue": "Exposed Access Token",
            "priority": "IMMEDIATE",
            "recommendation": (
                "Revoke and rotate the exposed token and store it "
                "securely outside the source code."
            )
        },

        "Private Key": {
            "issue": "Private Key Exposure",
            "priority": "IMMEDIATE",
            "recommendation": (
                "Remove the private key from source control, rotate or "
                "replace the affected key, and store it in a secure "
                "key-management system."
            )
        },

        "Unsafe eval": {
            "issue": "Unsafe eval() Usage",
            "priority": "HIGH",
            "recommendation": (
                "Avoid eval() when processing dynamic or untrusted input. "
                "Use a safe parser or explicit application logic instead."
            )
        },

        "Shell Command Execution": {
            "issue": "Unsafe Shell Command Execution",
            "priority": "HIGH",
            "recommendation": (
                "Avoid executing shell commands with untrusted input. "
                "Prefer safe argument-based process execution and validate "
                "all external input."
            )
        },

        "Potential SQL Injection": {
            "issue": "Potential SQL Injection",
            "priority": "HIGH",
            "recommendation": (
                "Use parameterized queries or prepared statements instead "
                "of constructing SQL queries using string concatenation."
            )
        },

        "Debug Mode": {
            "issue": "Debug Mode Enabled",
            "priority": "MEDIUM",
            "recommendation": (
                "Disable debug mode in production environments because "
                "debug information can expose sensitive application details."
            )
        },

        "Insecure CORS": {
            "issue": "Insecure CORS Configuration",
            "priority": "MEDIUM",
            "recommendation": (
                "Restrict CORS to trusted application origins instead of "
                "allowing requests from every origin."
            )
        },

        "Insecure HTTP": {
            "issue": "Insecure HTTP Connection",
            "priority": "LOW",
            "recommendation": (
                "Use HTTPS instead of HTTP when communicating with external "
                "services to protect data in transit."
            )
        },

        "Environment File Exposure": {
            "issue": "Environment File Exposure",
            "priority": "HIGH",
            "recommendation": (
                "Do not commit .env files containing secrets to source "
                "control. Add sensitive environment files to .gitignore "
                "and use secure environment configuration."
            )
        },

        "Credential File": {
            "issue": "Credential File Exposure",
            "priority": "HIGH",
            "recommendation": (
                "Remove credentials from the repository and store them "
                "using environment variables or a secure secret manager."
            )
        }
    }

    # =====================================================
    # GENERATE RECOMMENDATIONS FOR ACTUAL FINDINGS
    # =====================================================

    seen = set()

    for finding in findings:

        issue_type = finding.get(
            "type",
            ""
        )

        # Avoid duplicate recommendation cards
        if issue_type in seen:
            continue

        seen.add(issue_type)

        recommendation = recommendation_map.get(
            issue_type
        )

        # -------------------------------------------------
        # Known security issue
        # -------------------------------------------------

        if recommendation:

            recommendations.append({
                "issue": recommendation["issue"],
                "priority": recommendation["priority"],
                "recommendation": recommendation["recommendation"]
            })

        # -------------------------------------------------
        # Unknown issue type
        # -------------------------------------------------

        else:

            severity = str(
                finding.get(
                    "severity",
                    "LOW"
                )
            ).upper()

            priority_map = {
                "CRITICAL": "IMMEDIATE",
                "HIGH": "HIGH",
                "MEDIUM": "MEDIUM",
                "LOW": "LOW"
            }

            recommendations.append({
                "issue": issue_type or "Security Issue",
                "priority": priority_map.get(
                    severity,
                    "REVIEW"
                ),
                "recommendation": finding.get(
                    "fix",
                    "Review this finding and apply the recommended security fix."
                )
            })

    return recommendations