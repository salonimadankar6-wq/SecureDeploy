import { useState } from "react";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [scanMode, setScanMode] = useState("zip");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // -----------------------------------------
  // ZIP SCAN
  // -----------------------------------------

  const handleZipScan = async () => {
    if (!file) {
      alert("Please select a ZIP project first.");
      return;
    }

    setScanning(true);
    setResult(null);
    setCurrentSlide(2);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("https://securedeploy.onrender.com/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("ZIP scan failed");
      }

      const data = await response.json();

      if (data.status === "error") {
        alert(data.message);
        setCurrentSlide(1);
        return;
      }

      setResult(data);
      setCurrentSlide(3);
    } catch (error) {
      console.error(error);
      alert("Backend se connection nahi ho pa raha.");
      setCurrentSlide(1);
    } finally {
      setScanning(false);
    }
  };

  // -----------------------------------------
  // GITHUB SCAN
  // -----------------------------------------

  const handleGithubScan = async () => {
    if (!githubUrl.trim()) {
      alert("Please enter a GitHub repository URL.");
      return;
    }

    if (!githubUrl.startsWith("https://github.com/")) {
      alert("Please enter a valid GitHub repository URL.");
      return;
    }

    setScanning(true);
    setResult(null);
    setCurrentSlide(2);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/scan-github?repo_url=${encodeURIComponent(
          githubUrl.trim()
        )}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("GitHub scan failed");
      }

      const data = await response.json();

      if (data.status === "error") {
        alert(data.message);
        setCurrentSlide(1);
        return;
      }

      setResult(data);
      setCurrentSlide(3);
    } catch (error) {
      console.error(error);
      alert("GitHub repository scan nahi ho pa raha.");
      setCurrentSlide(1);
    } finally {
      setScanning(false);
    }
  };

  // -----------------------------------------
  // NEW SCAN
  // -----------------------------------------

  const handleNewScan = () => {
    setFile(null);
    setGithubUrl("");
    setResult(null);
    setScanning(false);
    setCurrentSlide(1);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // -----------------------------------------
  // COUNTS
  // -----------------------------------------

  const findings = result?.findings || [];

  const criticalCount = findings.filter(
    (item) => item.severity === "CRITICAL"
  ).length;

  const highCount = findings.filter(
    (item) => item.severity === "HIGH"
  ).length;

  const mediumCount = findings.filter(
    (item) => item.severity === "MEDIUM"
  ).length;

  const lowCount = findings.filter(
    (item) => item.severity === "LOW"
  ).length;

  return (
    <div className="app">

      {/* =====================================
          NAVBAR
      ====================================== */}

      <nav className="navbar">

        <div
          className="brand"
          onClick={() => {
            setCurrentSlide(1);
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
          style={{ cursor: "pointer" }}
        >
          <div className="brand-icon">🛡️</div>

          <div>
            <strong>DevSecOps</strong>
            <span>Risk Platform</span>
          </div>
        </div>

        <div className="nav-links">

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentSlide(1);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          >
            Home
          </a>

          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();

              setCurrentSlide(1);

              setTimeout(() => {
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  });
              }, 50);
            }}
          >
            How It Works
          </a>

          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();

              if (result) {
                setCurrentSlide(3);

                setTimeout(() => {
                  document
                    .getElementById("dashboard")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    });
                }, 50);
              } else {
                alert("Please scan a project first.");
              }
            }}
          >
            Dashboard
          </a>

        </div>

        <div className="status-pill">
          <span className="status-dot"></span>
          Security Engine Online
        </div>

      </nav>


      {/* =====================================
          SLIDE 1
          HOME + HOW IT WORKS
      ====================================== */}

      {currentSlide === 1 && (

        <main>

          {/* HERO */}

          <section className="hero">

            <div className="badge">
              🔐 Software Security Platform
            </div>

            <h1>
              Secure Your Software
              <br />
              <span>Before You Deploy.</span>
            </h1>

            <p className="hero-text">
              Scan your project for vulnerabilities, exposed secrets,
              insecure dependencies and configuration risks — all in one place.
            </p>

            <div className="trust-row">
              <span>✓ Secret Detection</span>
              <span>✓ Vulnerability Scanning</span>
              <span>✓ AI Risk Prioritization</span>
            </div>


            {/* SCANNER */}

            <div className="scanner-card">

              <div className="scanner-header">

                <div className="scanner-icon">
                  📁
                </div>

                <div>
                  <p className="eyebrow">
                    SECURITY SCANNER
                  </p>

                  <h2>
                    Scan Your Project
                  </h2>

                  <p>
                    Choose how you want to scan your project.
                  </p>
                </div>

              </div>


              {/* MODE BUTTONS */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "12px",
                  margin: "25px 0",
                  flexWrap: "wrap",
                }}
              >

                <button
                  type="button"
                  onClick={() => setScanMode("zip")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    border: "1px solid #39456b",
                    cursor: "pointer",
                    background:
                      scanMode === "zip"
                        ? "#6366f1"
                        : "#151b2e",
                    color: "white",
                    fontWeight: "600",
                  }}
                >
                  📁 Upload ZIP
                </button>


                <button
                  type="button"
                  onClick={() => setScanMode("github")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    border: "1px solid #39456b",
                    cursor: "pointer",
                    background:
                      scanMode === "github"
                        ? "#6366f1"
                        : "#151b2e",
                    color: "white",
                    fontWeight: "600",
                  }}
                >
                  🐙 GitHub
                </button>

              </div>


              {/* ZIP MODE */}

              {scanMode === "zip" && (

                <>

                  <label className="drop-zone">

                    <span className="upload-symbol">
                      ⬆
                    </span>

                    <strong>
                      Choose ZIP File
                    </strong>

                    <span>
                      Upload your project as a .zip file
                    </span>

                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) =>
                        setFile(e.target.files[0])
                      }
                      hidden
                    />

                  </label>


                  {file && (

                    <div className="file-chip">

                      <span>📦</span>

                      <div>
                        <strong>
                          {file.name}
                        </strong>

                        <small>
                          Ready to scan
                        </small>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFile(null)}
                      >
                        ×
                      </button>

                    </div>

                  )}


                  <button
                    className="scan-button"
                    onClick={handleZipScan}
                    disabled={scanning}
                  >

                    {scanning ? (
                      <>
                        <span className="spinner"></span>
                        Scanning...
                      </>
                    ) : (
                      "🚀 Scan Project"
                    )}

                  </button>

                </>

              )}


              {/* GITHUB MODE */}

              {scanMode === "github" && (

                <div
                  style={{
                    width: "100%",
                    maxWidth: "600px",
                    margin: "0 auto",
                  }}
                >

                  <input
                    type="text"
                    placeholder="https://github.com/user/repository"
                    value={githubUrl}
                    onChange={(e) =>
                      setGithubUrl(e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #39456b",
                      background: "#0d1324",
                      color: "white",
                      fontSize: "16px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />


                  <button
                    className="scan-button"
                    onClick={handleGithubScan}
                    disabled={scanning}
                    style={{
                      marginTop: "18px",
                    }}
                  >
                    {scanning
                      ? "🔍 Scanning GitHub..."
                      : "🐙 Scan GitHub Repository"}
                  </button>

                </div>

              )}


              {!scanning && (

                <p className="scanner-note">
                  Your project stays secure while the security engine analyzes it.
                </p>

              )}

            </div>

          </section>


          {/* =================================
              HOW IT WORKS
          ================================= */}

          <section
            className="how-it-works"
            id="how-it-works"
          >

            <div className="section-heading">

              <div>

                <p className="eyebrow">
                  HOW IT WORKS
                </p>

                <h2>
                  Secure Your Project in 4 Steps
                </h2>

                <p>
                  From source code to actionable security recommendations.
                </p>

              </div>

            </div>


            <div className="steps-grid">

              <div className="step-card">
                <span className="step-number">01</span>
                <div className="step-icon">📁</div>

                <h3>
                  Upload Project
                </h3>

                <p>
                  Upload your project ZIP or connect a GitHub repository.
                </p>
              </div>


              <div className="step-card">
                <span className="step-number">02</span>
                <div className="step-icon">🔍</div>

                <h3>
                  Security Scan
                </h3>

                <p>
                  Analyze your source code for security risks and exposed secrets.
                </p>
              </div>


              <div className="step-card">
                <span className="step-number">03</span>
                <div className="step-icon">⚡</div>

                <h3>
                  Risk Analysis
                </h3>

                <p>
                  Identify severity and prioritize the most important issues.
                </p>
              </div>


              <div className="step-card">
                <span className="step-number">04</span>
                <div className="step-icon">🤖</div>

                <h3>
                  AI Recommendations
                </h3>

                <p>
                  Get clear remediation guidance before deploying your software.
                </p>
              </div>

            </div>

          </section>


          {/* =================================
              FEATURES
          ================================= */}

          <section
            className="features"
            id="features"
          >

            <div className="feature-card">

              <span>🔍</span>

              <h3>
                Code Scanning
              </h3>

              <p>
                Identify risky patterns and security vulnerabilities.
              </p>

            </div>


            <div className="feature-card">

              <span>🔑</span>

              <h3>
                Secret Detection
              </h3>

              <p>
                Detect exposed API keys, passwords and sensitive tokens.
              </p>

            </div>


            <div className="feature-card">

              <span>📦</span>

              <h3>
                Dependency Risk
              </h3>

              <p>
                Surface third-party dependency and supply-chain risks.
              </p>

            </div>


            <div className="feature-card">

              <span>🤖</span>

              <h3>
                AI Risk Priority
              </h3>

              <p>
                Turn security findings into prioritized remediation actions.
              </p>

            </div>

          </section>

        </main>

      )}


      {/* =====================================
          SLIDE 2
          SCANNING
      ====================================== */}

      {currentSlide === 2 && (

        <main>

          <section className="scan-slide">

            <div className="scan-loading-card">

              <div className="scanner-icon">
                🔍
              </div>

              <p className="eyebrow">
                SECURITY ANALYSIS
              </p>

              <h1>
                Scanning Your Project
              </h1>

              <p>
                SecureDeploy is analyzing your project for vulnerabilities,
                exposed secrets, dependency risks and insecure configurations.
              </p>

              <div className="scan-loader">
                <span className="spinner"></span>
              </div>

              <strong>
                Security scan in progress...
              </strong>

              <small>
                Please wait while the security engine analyzes your project.
              </small>

            </div>

          </section>

        </main>

      )}


      {/* =====================================
          SLIDE 3
          OUTPUT
      ====================================== */}

      {currentSlide === 3 && result && (

        <main>

          <section
            className="results-section"
            id="dashboard"
          >

            {/* HEADER */}

            <div className="section-heading">

              <div>

                <p className="eyebrow">
                  SECURITY ANALYSIS
                </p>

                <h2>
                  Security Scan Completed
                </h2>

                <p>
                  <strong>Project:</strong>{" "}
                  {result.filename}
                </p>

                {result.source === "github" && (

                  <p>
                    <strong>Source:</strong> 🐙 GitHub
                  </p>

                )}

              </div>


              <button
                className="reset-button"
                onClick={handleNewScan}
              >
                ↻ New Scan
              </button>

            </div>


            {/* RISK OVERVIEW */}

            <div className="risk-overview">

              <div
                className={`risk-card ${
                  result.risk_level === "CRITICAL"
                    ? "critical"
                    : result.risk_level === "HIGH"
                    ? "high"
                    : "safe"
                }`}
              >

                <div className="risk-ring">

                  <strong>
                    {result.risk_score}
                  </strong>

                  <span>
                    /100
                  </span>

                </div>


                <div>

                  <p>
                    Overall Risk Score
                  </p>

                  <h3>
                    {result.risk_level}
                  </h3>

                  <span>
                    Security risk detected across the scanned project.
                  </span>

                </div>

              </div>


              <div className="release-card">

                <div className="release-icon">

                  {result.release_status === "BLOCKED"
                    ? "🚫"
                    : "✅"}

                </div>


                <div>

                  <p>
                    Release Status
                  </p>

                  <h3>
                    {result.release_status}
                  </h3>

                  <span>
                    Review the findings before deploying to production.
                  </span>

                </div>

              </div>

            </div>


            {/* ISSUE COUNTS */}

            <div className="severity-grid">

              <div className="severity-card">

                <span>
                  Total Issues
                </span>

                <strong>
                  {result.total_issues}
                </strong>

                <p>
                  Detected
                </p>

              </div>


              <div className="severity-card critical-card">

                <span>
                  Critical
                </span>

                <strong>
                  {criticalCount}
                </strong>

                <p>
                  Immediate action
                </p>

              </div>


              <div className="severity-card high-card">

                <span>
                  High
                </span>

                <strong>
                  {highCount}
                </strong>

                <p>
                  High priority
                </p>

              </div>


              <div className="severity-card medium-card">

                <span>
                  Medium
                </span>

                <strong>
                  {mediumCount}
                </strong>

                <p>
                  Needs review
                </p>

              </div>


              <div className="severity-card low-card">

                <span>
                  Low
                </span>

                <strong>
                  {lowCount}
                </strong>

                <p>
                  Low priority
                </p>

              </div>

            </div>


            {/* FINDINGS + RECOMMENDATIONS */}

            <div className="dashboard-grid">


              {/* SECURITY FINDINGS */}

              <div className="panel">

                <div className="panel-title">

                  <div>

                    <p className="eyebrow">
                      SECURITY ANALYSIS
                    </p>

                    <h3>
                      🔍 Security Findings
                    </h3>

                  </div>


                  <span className="count-badge">

                    {findings.length}{" "}

                    {findings.length === 1
                      ? "Finding"
                      : "Findings"}

                  </span>

                </div>


                {findings.length > 0 ? (

                  <div className="findings-list">

                    {findings.map((finding, index) => (

                      <div
  className="finding-card"
  key={index}
  onClick={() => setSelectedFinding(finding)}
>

                        <div className="finding-top">

                          <div className="finding-type">

                            <span className="finding-icon">
                              ⚠
                            </span>

                            <strong>
                              {finding.type}
                            </strong>

                          </div>


                          <span
                            className={`severity-badge ${(
                              finding.severity || "low"
                            ).toLowerCase()}`}
                          >
                            {finding.severity}
                          </span>

                        </div>


                        <p>
                          {finding.message}
                        </p>


                        <div className="finding-meta">

                          {finding.file && (

                            <span>
                              📄 {finding.file}
                            </span>

                          )}


                          {finding.line && (

                            <span>
                              Line {finding.line}
                            </span>

                          )}


                          {finding.confidence && (

                            <span>
                              Confidence:{" "}
                              {finding.confidence}
                            </span>

                          )}

                        </div>

                      </div>

                    ))}

                  </div>

                ) : (

                  <div className="empty-state compact">

                    <span>
                      ✅
                    </span>

                    <h3>
                      No security issues detected
                    </h3>

                    <p>
                      Your project passed the current security checks.
                    </p>

                  </div>

                )}

              </div>

{selectedFinding && (
  <div className="fix-details">
    <div className="fix-details-header">
      <div>
        <p className="eyebrow">REMEDIATION DETAILS</p>
        <h3>🔧 Where to Fix</h3>
      </div>

      <button
        className="close-fix"
        onClick={() => setSelectedFinding(null)}
      >
        ✕
      </button>
    </div>

    <div className="fix-content">
      <h4>
        {selectedFinding.type}
        <span className="severity-badge critical">
          {selectedFinding.severity}
        </span>
      </h4>

      <div className="fix-location">
        <strong>📍 Fix Location</strong>
        <p>
          {selectedFinding.file}
          {selectedFinding.line
            ? ` → Line ${selectedFinding.line}`
            : ""}
        </p>
      </div>

      <div className="fix-action">
        <strong>🛠 What to Fix</strong>
        <p>
          {selectedFinding.type === "API Key"
            ? "Remove the exposed API key from the source code, rotate the key, and store credentials securely using environment variables or a secret manager."
            : selectedFinding.type === "Password"
            ? "Remove the hard-coded password from the source code and use environment variables or a secure secret manager."
            : "Review this security finding and apply the recommended remediation before deployment."}
        </p>
      </div>
    </div>
  </div>
)}
              {/* AI RECOMMENDATIONS */}

              {result.recommendations &&
                result.recommendations.length > 0 && (

                  <div className="panel">

                    <div className="panel-title">

                      <div>

                        <p className="eyebrow">
                          REMEDIATION ENGINE
                        </p>

                        <h3>
                          🤖 AI Recommendations
                        </h3>

                      </div>


                      <span className="ai-badge">
                        AI Powered
                      </span>

                    </div>


                    <div className="recommendations-list">

                      {result.recommendations.map(
                        (item, index) => (

                          <div
                            className="recommendation-card"
                            key={index}
                          >

                            <div className="recommendation-heading">

                              <span className="rec-number">
                                {String(index + 1).padStart(
                                  2,
                                  "0"
                                )}
                              </span>


                              <div>

                                <h4>
                                  {item.issue}
                                </h4>


                                {item.priority && (

                                  <span className="priority">
                                    PRIORITY:{" "}
                                    {item.priority}
                                  </span>

                                )}

                              </div>

                            </div>


                            <p>
                              {item.recommendation}
                            </p>

                          </div>

                        )
                      )}

                    </div>

                  </div>

                )}

            </div>


            {/* SECURITY SUMMARY */}

            <div
              className="panel"
              style={{
                marginTop: "16px",
              }}
            >

              <div className="panel-title">

                <div>

                  <p className="eyebrow">
                    DEPLOYMENT DECISION
                  </p>

                  <h3>
                    🛡️ Security Summary
                  </h3>

                </div>


                <span className="count-badge">

                  {result.total_issues === 0
                    ? "Secure"
                    : "Action Required"}

                </span>

              </div>


              <p
                style={{
                  color: "#8c98ad",
                  fontSize: "13px",
                  lineHeight: "1.7",
                }}
              >

                {result.total_issues === 0
                  ? "No security issues were detected in the scanned project. The project is ready for the next stage of deployment."
                  : `The security engine detected ${
                      result.total_issues
                    } issue${
                      result.total_issues === 1
                        ? ""
                        : "s"
                    }. Review the critical and high-severity findings and apply the recommended remediation before deployment.`}

              </p>

            </div>

          </section>

        </main>

      )}


      {/* =====================================
          FOOTER
      ====================================== */}

      <footer>

        <span>
          DevSecOps Risk Platform
        </span>

        <span>
          Secure Before You Deploy
        </span>

      </footer>

    </div>
  );
}

export default App;