def generate_recommendations(findings):
    recommendations = []

    for finding in findings:
        issue_type = finding.get("type", "")

        if issue_type == "API Key":
            recommendations.append({
                "issue": "Exposed API Key",
                "priority": "IMMEDIATE",
                "recommendation": (
                    "Remove the API key from source code, rotate the exposed "
                    "key, and store credentials using environment variables "
                    "or a secure secret manager."
                )
            })

        elif issue_type == "Password":
            recommendations.append({
                "issue": "Hard-coded Password",
                "priority": "IMMEDIATE",
                "recommendation": (
                    "Remove the password from source code and use environment "
                    "variables or a secure secret manager."
                )
            })

        elif issue_type == "Secret Key":
            recommendations.append({
                "issue": "Exposed Secret Key",
                "priority": "IMMEDIATE",
                "recommendation": (
                    "Remove the secret key from the repository and rotate "
                    "the affected credential."
                )
            })

        elif issue_type == "Token":
            recommendations.append({
                "issue": "Exposed Token",
                "priority": "IMMEDIATE",
                "recommendation": (
                    "Revoke and rotate the exposed token and store it "
                    "securely outside the source code."
                )
            })

    return recommendations