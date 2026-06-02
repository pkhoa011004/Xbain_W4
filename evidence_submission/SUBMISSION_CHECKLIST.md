# Submission Checklist

## Already Captured And Usable

- [x] S3 knowledge documents uploaded
  - `screenshots/upload md.png`
- [x] Bedrock Knowledge Base setup
  - `screenshots/Setup KB.png`
- [x] Main Lambda architecture: Chatbot_Orchestrator
  - `screenshots/lambda chinh.png`
- [x] Tool Lambda architecture: monitoring-metrics-api
  - `screenshots/lambda phu.png`
- [x] L1 Evidence 1.1 frontend + dashboard screenshot
  - `screenshots/L1 Evidence 1.1 frontend screenshot.png`
- [x] L1 Evidence 1.2 frontend + dashboard screenshot
  - `screenshots/L1 Evidence 1.2 frontend screenshot.png`
- [x] L1 CloudWatch screenshot
  - `screenshots/L1 Evidence CloudWatch screenshot.png`
- [x] L2 CloudWatch screenshot
  - `screenshots/L2 Evidence CloudWatch screenshot.png`
- [x] L3 Cost Tool frontend + dashboard screenshot
  - `screenshots/L3 Cost Tool frontend screenshot.png`
- [x] L3 Cost Tool CloudWatch screenshot
  - `screenshots/L3 Cost Tool CloudWatch screenshot.png`
- [x] L3 Metrics Tool service architecture screenshot
  - `screenshots/lambda phu.png`
- [x] L4 Turn 1 memory save evidence
  - `screenshots/L4 CloudWatch memory loadsave screenshots.png`

## Retake Needed

- [ ] Retake L2 Evidence 2.1 frontend screenshot
  - Current image has correct answer but wrong badge: `L1 RESPONSE`.
  - After FE refresh, it should show `L2 RESPONSE`.
  - Replace: `screenshots/L2 Evidence 2.1 frontend screenshot.png`

- [ ] Retake L4 full 4-turn conversation screenshot
  - Current image only proves Turn 1 cost/memory save.
  - Must include follow-up questions:
    - `Which team is responsible?`
    - `Who is the engineering lead?`
    - `What deployment policy do they follow?`
  - Replace: `screenshots/L4 4-turn conversation screenshots.png`

- [ ] Retake L4 CloudWatch memory screenshot after full 4-turn conversation
  - Must show `MEMORY_LOAD` with `last_service=PaymentGW`.
  - Must show `REWRITTEN_QUESTION`.
  - Replace: `screenshots/L4 CloudWatch memory loadsave screenshots.png`

## Missing Evidence

- [ ] L2 Evidence 2.2 frontend screenshot
  - Question: `What deployment policy do they follow?`
  - Suggested file: `screenshots/L2 Evidence 2.2 frontend screenshot.png`

- [ ] L3 Incident Tool frontend/dashboard screenshot
  - Question: `What incidents affected AuthSvc?`
  - Suggested file: `screenshots/L3 Incident Tool frontend screenshot.png`

- [ ] L3 Incident Tool CloudWatch screenshot
  - Suggested file: `screenshots/L3 Incident Tool CloudWatch screenshot.png`

- [ ] L3 SLA Tool frontend/dashboard screenshot
  - Question: `What are the SLA targets for PaymentGW?`
  - Suggested file: `screenshots/L3 SLA Tool frontend screenshot.png`

- [ ] L3 SLA Tool CloudWatch screenshot
  - Suggested file: `screenshots/L3 SLA Tool CloudWatch screenshot.png`

- [ ] L3 Metrics Tool frontend/dashboard screenshot
  - Question: `What is PaymentGW current p99 latency?`
  - Suggested file: `screenshots/L3 Metrics Tool frontend screenshot.png`

- [ ] L3 Metrics Tool CloudWatch screenshot
  - Suggested file: `screenshots/L3 Metrics Tool CloudWatch screenshot.png`

- [ ] L3 Multi-Tool SLA frontend/dashboard screenshot
  - Question: `Is PaymentGW within its latency SLA?`
  - Suggested file: `screenshots/L3 Multi Tool SLA frontend screenshot.png`

- [ ] L3 Multi-Tool SLA CloudWatch screenshot
  - Suggested file: `screenshots/L3 Multi Tool SLA CloudWatch screenshot.png`

- [ ] Bonus A Observability Dashboard screenshot
  - Best question: `Is PaymentGW within its latency SLA?`
  - Must show SLA Tool + Metrics Tool.
  - Suggested file: `screenshots/Bonus A Observability Dashboard screenshot.png`

## Before Submitting

- [ ] Latest FE is rebuilt/deployed after the L2 badge fix.
- [ ] Latest Lambda is deployed with `observability`, memory, and scope guard code.
- [ ] `MONITORING_API_URL` is set in Lambda environment variables.
- [ ] Screenshots in `evidence.md` match actual file names.
- [ ] No invalid screenshot is presented as passing evidence.
