def calculate_risk(findings):
    """
    Calculate overall security risk score dynamically.

    The score is based on the severity of the actual
    vulnerabilities detected in the uploaded project.

    0 findings:
        0/100 -> SAFE -> PASS

    CRITICAL:
        +70 points

    HIGH:
        +30 points

    MEDIUM:
        +15 points

    LOW:
        +5 points

    Maximum score:
        100
    """

    severity_points = {
        "CRITICAL": 70,
        "HIGH": 30,
        "MEDIUM": 15,
        "LOW": 5
    }

    # ---------------------------------------------------------
    # NO VULNERABILITIES
    # ---------------------------------------------------------

    if not findings:
        return {
            "risk_score": 0,
            "risk_level": "SAFE",
            "release_status": "PASS"
        }

    # ---------------------------------------------------------
    # CALCULATE SCORE FROM ACTUAL FINDINGS
    # ---------------------------------------------------------

    score = 0

    for finding in findings:

        severity = str(
            finding.get("severity", "LOW")
        ).upper()

        score += severity_points.get(
            severity,
            0
        )

    # ---------------------------------------------------------
    # KEEP SCORE BETWEEN 0 AND 100
    # ---------------------------------------------------------

    score = min(score, 100)

    # ---------------------------------------------------------
    # DETERMINE HIGHEST SEVERITY
    # ---------------------------------------------------------

    severities = []

    for finding in findings:

        severity = str(
            finding.get("severity", "LOW")
        ).upper()

        if severity in severity_points:
            severities.append(severity)

    severity_order = {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1
    }

    highest_severity = max(
        severities,
        key=lambda severity: severity_order.get(
            severity,
            0
        )
    )

    # ---------------------------------------------------------
    # RELEASE STATUS + RISK LEVEL
    # ---------------------------------------------------------

    if highest_severity == "CRITICAL":

        risk_level = "CRITICAL"
        release_status = "BLOCKED"

    elif highest_severity == "HIGH":

        risk_level = "HIGH"
        release_status = "BLOCKED"

    elif highest_severity == "MEDIUM":

        risk_level = "MEDIUM"
        release_status = "REVIEW REQUIRED"

    else:

        risk_level = "LOW"
        release_status = "APPROVED"

    # ---------------------------------------------------------
    # FINAL RESULT
    # ---------------------------------------------------------

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "release_status": release_status
    }