# W4 Evidence

Project: GeekBrain AI Ops Assistant

Architecture:

```text
CloudFront/S3 FE -> API Gateway -> Chatbot_Orchestrator Lambda
-> Bedrock KB + SQLite Tools + Monitoring API + Memory
```

Why this design:

```text
I use Bedrock Knowledge Base for L1/L2 because it is best for document Q&A.
I use SQLite/CSV and Monitoring API tools for L3 because structured data should be queried directly.
I use session memory for L4 so follow-up questions can reuse the previous service context.
```

## 0. Setup / Architecture

### 0.1 S3 Knowledge Documents

![S3 Knowledge Documents](screenshots/upload%20md.png)

Evidence:

```text
S3 bucket contains Markdown KB documents used by Bedrock KB.
```

### 0.2 Bedrock Knowledge Base

![Bedrock Knowledge Base Setup](screenshots/Setup%20KB.png)

Evidence:

```text
Knowledge Base: khoa-ai-kb
KB ID: IYSEFWWJNK
Status: Available
Data source: S3
```

### 0.3 Main Lambda

![Main Lambda Chatbot Orchestrator](screenshots/lambda%20chinh.png)

Evidence:

```text
Chatbot_Orchestrator handles API Gateway requests, S3 trigger, Bedrock KB, SQLite tools, metrics tool, memory.
```

### 0.4 Metrics Tool Lambda

![Metrics Tool Lambda](screenshots/lambda%20phu.png)

Evidence:

```text
monitoring-metrics-api provides current service metrics for L3 multi-tool questions.
```

## L1 - Foundation Retrieval

### Evidence 1.1

Status: Valid.

Question:

```text
Who is the Team Platform lead?
```

Result:

```text
Alex Chen is the Team Platform lead.
```

![L1 Team Platform Lead Frontend](screenshots/L1%20Evidence%201.1%20frontend%20screenshot.png)

![L1 CloudWatch](screenshots/L1%20Evidence%20CloudWatch%20screenshot.png)

CloudWatch:

```text
USING BEDROCK KNOWLEDGE BASE
```

### Evidence 1.2

Status: Valid.

Question:

```text
What is PaymentGW API rate limit?
```

Result:

```text
1,000 requests per minute per merchant API key.
```

![L1 PaymentGW API Rate Limit Frontend](screenshots/L1%20Evidence%201.2%20frontend%20screenshot.png)

![L1 CloudWatch](screenshots/L1%20Evidence%20CloudWatch%20screenshot.png)

CloudWatch:

```text
USING BEDROCK KNOWLEDGE BASE
```

## L2 - Knowledge Base Retrieval

### Evidence 2.1

Status: CloudWatch valid. Frontend screenshot should be retaken because current badge shows L1.

Question:

```text
Can Team Commerce deploy on Friday night?
```

Result:

```text
No. Deployment freeze is Friday 18:00 to Monday 08:00, except approved P1 hotfixes.
```

![L2 Friday Deployment Frontend](screenshots/L2%20Evidence%202.1%20frontend%20screenshot.png)

![L2 CloudWatch](screenshots/L2%20Evidence%20CloudWatch%20screenshot.png)

CloudWatch:

```text
USING BEDROCK KNOWLEDGE BASE
```

### Evidence 2.2

Status: Missing frontend screenshot.

Question:

```text
What deployment policy do they follow?
```

Needed:

```text
screenshots/L2 Evidence 2.2 frontend screenshot.png
```

## L3 - Retrieval + Tools

### Evidence 3.1 - Cost Tool

Status: Valid.

Question:

```text
Which service had the highest infrastructure cost in March 2026?
```

Result:

```text
PaymentGW had the highest total cost in March 2026 at $7,500.
```

![L3 Cost Tool Frontend Dashboard](screenshots/L3%20Cost%20Tool%20frontend%20screenshot.png)

![L3 Cost Tool CloudWatch](screenshots/L3%20Cost%20Tool%20CloudWatch%20screenshot.png)

Dashboard:

```text
Tool: Database Query Tool
SQL: SELECT service, total_cost FROM monthly_costs WHERE month = '2026-03' ORDER BY total_cost DESC LIMIT 1
Rows: 1
```

CloudWatch:

```text
USING COST TOOL
DATABASE_QUERY=...
DATABASE_ROWS=1
MEMORY_SAVE last_service=PaymentGW
```

### Evidence 3.2 - Incident Tool

Status: Missing screenshot.

Question:

```text
What incidents affected AuthSvc?
```

Expected CloudWatch:

```text
USING INCIDENT TOOL
DATABASE_QUERY=... FROM incidents
```

### Evidence 3.3 - SLA Tool

Status: Missing screenshot.

Question:

```text
What are the SLA targets for PaymentGW?
```

Expected CloudWatch:

```text
USING SLA TOOL
DATABASE_QUERY=... FROM sla_targets
```

### Evidence 3.4 - Metrics Tool

Status: Metrics Lambda screenshot exists. Frontend/CloudWatch call missing.

Question:

```text
What is PaymentGW current p99 latency?
```

Expected CloudWatch:

```text
USING METRICS TOOL
METRICS_TOOL_URL=...
```

### Evidence 3.5 - Multi-Tool SLA Check

Status: Missing screenshot.

Question:

```text
Is PaymentGW within its latency SLA?
```

Expected CloudWatch:

```text
USING SLA TOOL
USING METRICS TOOL
DATABASE_QUERY=...
METRICS_TOOL_URL=...
```

## L4 - Memory

Status: Current screenshots only prove Turn 1 memory save. Full 4-turn flow needs retake.

![L4 Current Conversation Screenshot](screenshots/L4%204-turn%20conversation%20screenshots.png)

![L4 CloudWatch Memory Save](screenshots/L4%20CloudWatch%20memory%20loadsave%20screenshots.png)

Current proof:

```text
MEMORY_SAVE last_service=PaymentGW
MEMORY_SAVE last_month=March 2026
MEMORY_SAVE last_incident=INC-005
```

Retake flow:

```text
1. Which service had the highest infrastructure cost in March 2026?
2. Which team is responsible?
3. Who is the engineering lead?
4. What deployment policy do they follow?
```

Expected CloudWatch:

```text
MEMORY_LOAD last_service=PaymentGW
REWRITTEN_QUESTION=...
USING BEDROCK KNOWLEDGE BASE
```

## Bonus A - Observability Dashboard

Status: Partially captured in L3 Cost screenshot.

![Bonus A Current Dashboard Evidence](screenshots/L3%20Cost%20Tool%20frontend%20screenshot.png)

Shows:

```text
Question -> Tool -> SQL -> Rows -> Retrieved Data -> Final Answer
```

Better screenshot to capture:

```text
Question: Is PaymentGW within its latency SLA?
File: screenshots/Bonus A Observability Dashboard screenshot.png
```
