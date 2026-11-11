# Privacy Policy — ExaminerAI

**Last Updated:** September 7, 2026

ExaminerAI ("we", "our", or "the application") is a native desktop application designed to assist educators, tutors, and academic administrators in converting physical and digital exam papers into editable question databases.

---

## 1. Document Processing & Local-First Privacy

- **No Remote Document Storage:** Uploaded exam papers (PDFs, images, scanned tests) are stored exclusively on your local workstation. We do not host, store, or archive your test papers on our servers.
- **Direct-to-Provider Transmission:** When performing AI question extraction, document text and image slices are transmitted directly from your device to the AI API endpoint configured in your settings (e.g., Groq, OpenRouter, or your local Ollama server).
- **No Model Training:** We do not use, sell, or retain your exam documents or student question papers to train machine learning models.

---

## 2. API Key Management & Bring-Your-Own-Key (BYOK)

- ExaminerAI operates on a Bring-Your-Own-Key model.
- Your third-party API credentials (`GROQ_API_KEY`, `OPENROUTER_API_KEY`) are stored locally on your machine.
- We never receive, transmit, or log your personal API keys on any centralized server.

---

## 3. Educational Compliance (FERPA & COPPA)

ExaminerAI is designed to help educational institutions comply with student privacy laws:
- **Redaction Guidance:** Educators are strongly encouraged to redact student names, identification numbers, and personal remarks from test answer sheets prior to AI digitization.
- **No Student PII Collection:** The software neither requires nor solicits student personal identifying information (PII).

---

## 4. Local Storage & Cache

The application stores settings locally on your machine via Tauri's local application data directory:
- Extraction preferences (e.g., default mark distributions, multiple-choice format)
- UI theme settings (dark / light mode)
- Temporary PDF page cache (automatically purged upon document close)

---

## 5. Contact

For security questions, licensing, or privacy inquiries, contact `creatormanager27@gmail.com` or consult the repository maintainer (`https://github.com/onlykushalll`).
