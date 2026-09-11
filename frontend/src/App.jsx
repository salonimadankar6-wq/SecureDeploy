import { useEffect, useState } from "react";
import JSZip from "jszip";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [updatedZipFile, setUpdatedZipFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [scanMode, setScanMode] = useState("zip");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [codeEditor, setCodeEditor] = useState(false);
  const [findingFilter, setFindingFilter] = useState("ALL");
    const [savedCode, setSavedCode] = useState({});

  useEffect(() => {
    const storedCode = localStorage.getItem("securedeploy_saved_code");

    if (storedCode) {
      try {
        setSavedCode(JSON.parse(storedCode));
      } catch (error) {
        console.error("Saved code load failed:", error);
      }
    }
  }, []);

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
      const response = await fetch("https://securedeploy-api.onrender.com/scan", {
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
        `https://securedeploy-api.onrender.com/scan-github?repo_url=${encodeURIComponent(
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
    setUpdatedZipFile(null);
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
  // SAVE PASSED SCAN TO DESKTOP
  // -----------------------------------------

  const savePassedScanToDesktop = async () => {
    if (!result) {
      alert("⚠️ Please scan the project first.");
      return;
    }

    const passed =
      result.release_status === "APPROVED" ||
      result.release_status === "PASS" ||
      result.risk_level === "SAFE" ||
      Number(result.total_issues || 0) === 0 ||
      Number(result.findings?.length || 0) === 0;

    if (!passed) {
      alert("⚠️ Scan is not passed yet. Fix all security issues and re-scan first.");
      return;
    }

    const projectZip = updatedZipFile || file;
    if (!projectZip) {
      alert("⚠️ Project ZIP is not available. Please upload the ZIP again.");
      return;
    }

    const fileName = "SecureDeploy_Passed_Project.zip";

    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          startIn: "desktop",
          types: [
            {
              description: "ZIP Project",
              accept: { "application/zip": [".zip"] },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(await projectZip.arrayBuffer());
        await writable.close();
        alert("✅ Scanned project saved successfully to Desktop!");
      } else {
        const blobUrl = URL.createObjectURL(projectZip);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        alert("✅ Scanned project downloaded. Please check your browser's Downloads folder.");
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Desktop save failed:", error);
      alert("❌ Could not save the scanned project.");
    }
  };

  const getFindingKey = (finding = selectedFinding) => {
    if (!finding) return null;
    return (
      finding.relative_file ||
      finding.display_file ||
      finding.file?.split(/[\\/]/).pop()
    );
  };

  const syncFindingsForFile = (finding, code) => {
    const key = getFindingKey(finding);
    if (!key) return;

    setResult((previous) => {
      if (!previous?.findings) return previous;
      return {
        ...previous,
        findings: previous.findings.map((item) =>
          getFindingKey(item) === key ? { ...item, code } : item
        ),
      };
    });
  };

  const saveCurrentCode = async () => {
    if (!selectedFinding) return false;
    const key = getFindingKey();
    const code = selectedFinding.code || "";
    if (!key) {
      alert("⚠️ File name not found.");
      return false;
    }
    const updatedCode = { ...savedCode, [key]: code };
    setSavedCode(updatedCode);
    localStorage.setItem("securedeploy_saved_code", JSON.stringify(updatedCode));
    return true;
  };

  const updateZipWithFix = async (codeToSave = null, finding = selectedFinding) => {
    if (!finding) {
      setFixMessage("No finding selected.");
      return null;
    }

    const sourceZip = updatedZipFile || file;
    if (!sourceZip) {
      setFixMessage("Original ZIP file not found.");
      return null;
    }

    try {
      const zip = await JSZip.loadAsync(sourceZip);
      const fileName = finding.display_file || finding.file?.split(/[\\/]/).pop();
      if (!fileName) {
        setFixMessage("File name not found.");
        return null;
      }

      const normalizedFileName = fileName.replace(/\\/g, "/").replace(/^\/+/, "");
      const relativePath = finding.relative_file
        ?.replace(/\\/g, "/")
        .replace(/^\/+/, "");

      let targetPath = null;
      if (relativePath && zip.file(relativePath)) targetPath = relativePath;

      if (!targetPath) {
        for (const path of Object.keys(zip.files)) {
          const normalizedPath = path.replace(/\\/g, "/");
          if (
            normalizedPath === normalizedFileName ||
            normalizedPath.endsWith("/" + normalizedFileName)
          ) {
            targetPath = path;
            break;
          }
        }
      }

      if (!targetPath) {
        setFixMessage(`${fileName} not found inside ZIP.`);
        return null;
      }

      const updatedCode = codeToSave !== null ? codeToSave : (finding.code || "");
      zip.file(targetPath, updatedCode);

      const updatedZip = await zip.generateAsync({ type: "blob" });
      const updatedFile = new File(
        [updatedZip],
        sourceZip.name || "SecureDeploy_Fixed_Project.zip",
        { type: "application/zip" }
      );

      setFile(updatedFile);
      setUpdatedZipFile(updatedFile);
      return updatedFile;
    } catch (error) {
      console.error("ZIP update failed:", error);
      setFixMessage("Could not update the ZIP file.");
      return null;
    }
  };

  // Always read the latest version of the selected file from the current ZIP.
  // This prevents fixing one finding from accidentally using stale editor content
  // and overwriting other findings in the same project.
  const readLatestFindingCode = async (finding) => {
    const sourceZip = updatedZipFile || file;
    if (!sourceZip || !finding) return null;

    try {
      const zip = await JSZip.loadAsync(sourceZip);
      const relativePath = finding.relative_file
        ?.replace(/\\/g, "/")
        .replace(/^\/+/, "");
      const fileName = (
        finding.display_file ||
        finding.file?.split(/[\\/]/).pop() ||
        ""
      ).replace(/\\/g, "/").replace(/^\/+/, "");

      let targetPath = relativePath && zip.file(relativePath) ? relativePath : null;

      if (!targetPath) {
        for (const path of Object.keys(zip.files)) {
          const normalized = path.replace(/\\/g, "/");
          if (
            normalized === fileName ||
            normalized.endsWith("/" + fileName)
          ) {
            targetPath = path;
            break;
          }
        }
      }

      if (!targetPath) return null;
      return await zip.file(targetPath).async("text");
    } catch (error) {
      console.error("Could not read latest finding file:", error);
      return null;
    }
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
const visibleFindings =
  findingFilter === "ALL"
    ? findings
    : findings.filter(
        (item) => item.severity === findingFilter
      );
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
                      onChange={(e) => {
                        const nextFile = e.target.files[0] || null;
                        setFile(nextFile);
                        setUpdatedZipFile(null);
                        setResult(null);
                        setSelectedFinding(null);
                      }}
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
                onClick={() => {
  setFindingFilter("ALL");
  setSelectedFinding(null);
  document
    .querySelector(".findings-list")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}}
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


              <div
  className="release-card"
  onClick={() => {
    if (result.release_status === "BLOCKED") {
      setFindingFilter("CRITICAL");
      setSelectedFinding(null);
    } else {
      setFindingFilter("ALL");
      setSelectedFinding(null);
    }

    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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

              <div
  className={`severity-card ${
    findingFilter === "ALL" ? "active-filter" : ""
  }`}
  onClick={() => {
    setFindingFilter("ALL");
    setSelectedFinding(null);
    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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


              <div
  className={`severity-card critical-card ${
    findingFilter === "CRITICAL" ? "active-filter" : ""
  }`}
  onClick={() => {
    setFindingFilter("CRITICAL");
    setSelectedFinding(null);
    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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


              <div
  className={`severity-card high-card ${
    findingFilter === "HIGH" ? "active-filter" : ""
  }`}
  onClick={() => {
    setFindingFilter("HIGH");
    setSelectedFinding(null);
    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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


              <div
  className={`severity-card medium-card ${
    findingFilter === "MEDIUM" ? "active-filter" : ""
  }`}
  onClick={() => {
    setFindingFilter("MEDIUM");
    setSelectedFinding(null);
    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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


              <div
  className={`severity-card low-card ${
    findingFilter === "LOW" ? "active-filter" : ""
  }`}
  onClick={() => {
    setFindingFilter("LOW");
    setSelectedFinding(null);
    document
      .querySelector(".findings-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
>

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


            {/* PASSED SCAN DOWNLOAD */}
            {(result.release_status === "APPROVED" ||
              result.release_status === "PASS" ||
              result.risk_level === "SAFE" ||
              Number(result.total_issues || 0) === 0 ||
              Number(result.findings?.length || 0) === 0) &&
              file && (
                <div
                  style={{
                    margin: "24px 0",
                    padding: "20px",
                    borderRadius: "16px",
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "18px" }}>
                      ✅ Security Scan Passed
                    </strong>
                    <span style={{ opacity: 0.8 }}>
                      Your latest scanned project ZIP is ready to save.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={savePassedScanToDesktop}
                    style={{
                      padding: "13px 20px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      background: "#22c55e",
                      color: "white",
                      fontWeight: "700",
                      fontSize: "15px",
                    }}
                  >
                    💾 Save Scanned File to Desktop
                  </button>
                </div>
              )}

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

                    {visibleFindings.length}{" "}
{visibleFindings.length === 1
  ? "Finding"
  : "Findings"}

                  </span>

                </div>


                {visibleFindings.length > 0 ? (
                  <div className="findings-list">

                    {visibleFindings.map((finding, index) => (

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
        <span className={`severity-badge ${(selectedFinding.severity || "LOW").toLowerCase()}`}>
          {selectedFinding.severity}
        </span>
      </h4>

      <div className="fix-location">
        <strong>📍 Fix Location</strong>
        <p>
          {selectedFinding.file?.split(/[\\/]/).pop()}
          {selectedFinding.line
            ? ` → Line ${selectedFinding.line}`
            : ""}
        </p>
      </div>
      <button
        className="fix-code-button"
        onClick={() => {
          const key = getFindingKey(selectedFinding);
          setSelectedFinding({
            ...selectedFinding,
            code: savedCode[key] ?? selectedFinding.code ?? "",
          });
          setCodeEditor(true);
        }}
      >
        🛠️ Fix Code
      </button>

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
{/* CODE EDITOR */}

{codeEditor && selectedFinding && (
  <div className="code-editor-overlay">
    <div className="code-editor-modal">
      <div className="code-editor-header">
        <div>
          <p className="eyebrow">SECURE CODE EDITOR</p>
          <h3>💻 Fix Vulnerability</h3>
          <p className="editor-file">
            📄 {selectedFinding.display_file || selectedFinding.file?.split(/[\\/]/).pop()}
            {selectedFinding.line ? ` → Line ${selectedFinding.line}` : ""}
          </p>
        </div>
        <button className="close-fix" onClick={() => setCodeEditor(false)}>✕</button>
      </div>

      <div className="code-editor-body">
        <textarea
          className="code-textarea"
          value={selectedFinding.code ?? savedCode[getFindingKey(selectedFinding)] ?? ""}
          onChange={(event) =>
            setSelectedFinding({ ...selectedFinding, code: event.target.value })
          }
          spellCheck="false"
        />
      </div>

      <div className="code-editor-footer">
        <span>⚠️ Vulnerable line: {selectedFinding.line || "Not specified"}</span>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="auto-fix-button"
            onClick={async () => {
              if (!selectedFinding) return;

              const latestCode = await readLatestFindingCode(selectedFinding);
              const originalCode = latestCode ?? selectedFinding.code ?? "";
              const fileName = String(
                selectedFinding.display_file ||
                selectedFinding.relative_file ||
                selectedFinding.file ||
                ""
              );
              const lowerFileName = fileName.toLowerCase();
              const issueType = String(selectedFinding.type || "")
                .trim()
                .toLowerCase();
              const lineNumber = Math.max(1, Number(selectedFinding.line || 1));
              const isPython = /\.py$/i.test(lowerFileName);
              const isEnvFile = /(?:^|[\\/])(?:\.env|[^\\/]*\.env)$/i.test(lowerFileName);

              const addPythonOsImport = (code) => {
                if (
                  isPython &&
                  !/^\s*import\s+os\b/m.test(code) &&
                  !/^\s*from\s+os\b/m.test(code)
                ) {
                  return `import os\n${code}`;
                }
                return code;
              };

              const removeVulnerableLine = (code, number) => {
                const lines = code.split(/\r?\n/);
                const index = number - 1;
                if (index < 0 || index >= lines.length) return code;
                lines.splice(index, 1);
                return lines.join("\n");
              };

              const commentLine = (code, number) => {
                const lines = code.split(/\r?\n/);
                const index = number - 1;
                if (index < 0 || index >= lines.length) return code;
                if (!lines[index].trim()) return code;
                const prefix = isPython || isEnvFile || /\.(ya?ml|ini|cfg|conf|sh|txt)$/i.test(lowerFileName)
                  ? "# "
                  : "// ";
                if (!lines[index].trim().startsWith(prefix.trim())) {
                  lines[index] = lines[index].replace(/^(\s*)/, `$1${prefix}`);
                }
                return lines.join("\n");
              };

              let fixedCode = originalCode;

              // IMPORTANT: every automatic fix changes ONLY the selected finding's file.
              if (issueType === "api key") {
                if (isEnvFile) {
                  // Remove the secret line completely so the scanner cannot flag an empty assignment.
                  fixedCode = removeVulnerableLine(originalCode, lineNumber);
                } else {
                  fixedCode = originalCode.replace(
                    /^(\s*(?:export\s+)?(?:API[_-]?KEY|APIKEY)\s*[:=]\s*).*$/gim,
                    '$1os.getenv("API_KEY")'
                  );
                  fixedCode = addPythonOsImport(fixedCode);
                }
              } else if (issueType === "password") {
                if (isEnvFile) {
                  // config.env/.env: delete the password line completely.
                  fixedCode = removeVulnerableLine(originalCode, lineNumber);
                } else {
                  fixedCode = originalCode.replace(
                    /^(\s*(?:export\s+)?(?:[A-Za-z0-9_]+_)?(?:PASSWORD|PASSWD|PWD)\s*[:=]\s*).*$/gim,
                    '$1os.getenv("PASSWORD")'
                  );
                  fixedCode = addPythonOsImport(fixedCode);
                }
              } else if (issueType === "secret key") {
                if (isEnvFile) {
                  fixedCode = removeVulnerableLine(originalCode, lineNumber);
                } else {
                  fixedCode = originalCode.replace(
                    /^(\s*(?:export\s+)?(?:SECRET[_-]?KEY|SECRETKEY)\s*[:=]\s*).*$/gim,
                    '$1os.getenv("SECRET_KEY")'
                  );
                  fixedCode = addPythonOsImport(fixedCode);
                }
              } else if (issueType === "access token" || issueType === "token") {
                if (isEnvFile) {
                  fixedCode = removeVulnerableLine(originalCode, lineNumber);
                } else {
                  fixedCode = originalCode.replace(
                    /^(\s*(?:export\s+)?(?:ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|ACCESSTOKEN|AUTHTOKEN)\s*[:=]\s*).*$/gim,
                    '$1os.getenv("ACCESS_TOKEN")'
                  );
                  fixedCode = addPythonOsImport(fixedCode);
                }
              } else if (issueType === "potential sql injection") {
                const lines = originalCode.split(/\r?\n/);
                const index = lineNumber - 1;
                if (index >= 0 && index < lines.length) {
                  const vulnerableLine = lines[index];
                  const match = vulnerableLine.match(
                    /^(\s*)([A-Za-z_]\w*)\s*=\s*(["'])(.*?)\3\s*\+\s*([A-Za-z_]\w*)\s*$/
                  );
                  if (match) {
                    const [, indentation, variable, quote, queryText, inputVariable] = match;
                    lines[index] = `${indentation}${variable} = ${quote}${queryText} ?${quote}`;
                    lines.splice(index + 1, 0, `${indentation}params = (${inputVariable},)`);
                    fixedCode = lines.join("\n");
                  } else {
                    fixedCode = commentLine(originalCode, lineNumber);
                  }
                }
              } else if (issueType === "unsafe eval") {
                fixedCode = commentLine(originalCode, lineNumber);
              } else if (issueType === "shell command execution") {
                fixedCode = commentLine(originalCode, lineNumber);
              } else if (issueType === "debug mode") {
                fixedCode = originalCode.replace(/\b(debug|DEBUG)\s*=\s*True\b/g, "$1 = False");
              } else if (issueType === "insecure cors") {
                fixedCode = originalCode.replace(
                  /allow_origins\s*=\s*\[\s*["']\*["']\s*\]/gi,
                  'allow_origins = ["http://localhost:5173"]'
                );
              } else if (issueType === "insecure http") {
                fixedCode = originalCode.replace(
                  /http:\/\/(?!localhost\b|127\.0\.0\.1\b)/gi,
                  "https://"
                );
              } else if (issueType === "private key") {
                fixedCode = originalCode.replace(
                  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----\s*/g,
                  ""
                );
              } else if (issueType === "environment file exposure" || issueType === "credential file") {
                fixedCode = "";
              } else {
                fixedCode = commentLine(originalCode, lineNumber);
              }

              if (fixedCode === originalCode) {
                setFixMessage(`⚠️ Automatic fix could not change ${selectedFinding.type}. Please edit the code manually.`);
                return;
              }

              const updatedFinding = { ...selectedFinding, code: fixedCode };
              setSelectedFinding(updatedFinding);

              // Keep other findings in the SAME FILE pointed at the latest file content.
              // This preserves earlier fixes without removing or hiding any finding.
              syncFindingsForFile(selectedFinding, fixedCode);

              // Store ONLY this finding's edited file. Do not copy its code to other files.
              const key = getFindingKey(selectedFinding);
              if (key) {
                const updatedSavedCode = { ...savedCode, [key]: fixedCode };
                setSavedCode(updatedSavedCode);
                localStorage.setItem("securedeploy_saved_code", JSON.stringify(updatedSavedCode));
              }

              const updatedFile = await updateZipWithFix(fixedCode, updatedFinding);
              if (updatedFile) {
                setFixMessage(
                  `✅ ${selectedFinding.type} fixed successfully. Only ${selectedFinding.display_file || selectedFinding.file?.split(/[\\/]/).pop()} was changed. Now click Re-scan.`
                );
              }
            }}
          >
            ✨ Fix Automatically
          </button>

          <button
            className="save-fix-button"
            onClick={async () => {
              const codeToSave = selectedFinding.code || "";
              const saved = await saveCurrentCode();
              if (!saved) return;
              const updatedFile = await updateZipWithFix(codeToSave, selectedFinding);
              if (updatedFile) {
                alert("✅ Fix saved permanently in the current project ZIP!");
              }
            }}
          >
            💾 Save Fix
          </button>

          <button
            className="rescan-button"
            onClick={async () => {
              if (!file) {
                alert("⚠️ ZIP file not found.");
                return;
              }
              // Auto Fix already writes the latest content into updatedZipFile.
              // Re-scan that ZIP directly instead of writing selectedFinding.code again.
              const updatedFile = updatedZipFile || file;

              if (!updatedFile) {
                alert("⚠️ Updated project ZIP not found.");
                return;
              }

              setCodeEditor(false);
              setScanning(true);
              setCurrentSlide(2);

              try {
                const formData = new FormData();
                formData.append("file", updatedFile);
                const response = await fetch("https://securedeploy-api.onrender.com/scan", {
                  method: "POST",
                  body: formData,
                });
                if (!response.ok) throw new Error("Re-scan request failed");
                const data = await response.json();
                if (data.status === "error") {
                  alert("❌ Re-scan failed: " + data.message);
                  setCurrentSlide(3);
                  return;
                }
                setResult(data);
                setSelectedFinding(null);
                setFindingFilter("ALL");
                setCurrentSlide(3);
                alert(
                  data.total_issues === 0
                    ? "✅ Re-scan complete! No vulnerabilities found."
                    : `⚠️ Re-scan complete! ${data.total_issues} issue(s) found.`
                );
              } catch (error) {
                console.error(error);
                setCurrentSlide(3);
                alert("❌ Re-scan failed. Please try again.");
              } finally {
                setScanning(false);
              }
            }}
          >
            🔄 Re-scan
          </button>
        </div>
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
  onClick={() => {
    if (findings[index]) {
      setSelectedFinding(findings[index]);
      document
        .querySelector(".findings-list")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }}
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


















































