def calculate_risk(findings):
    """
    Calculate overall security risk score.
    Higher score = higher risk.
    """

    severity_points = {
        "CRITICAL": 40,
        "HIGH": 25,
        "MEDIUM": 15,
        "LOW": 5
    }

    score = 0

    for finding in findings:
        severity = finding.get("severity", "LOW")
        score += severity_points.get(severity, 0)

    # Keep score between 0 and 100
    score = min(score, 100)

    if score >= 70:
        risk_level = "CRITICAL"
        release_status = "BLOCKED"

    elif score >= 40:
        risk_level = "HIGH"
        release_status = "REVIEW REQUIRED"

    elif score >= 20:
        risk_level = "MEDIUM"
        release_status = "WARNING"

    else:
        risk_level = "LOW"
        release_status = "APPROVED"

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "release_status": release_status
    }