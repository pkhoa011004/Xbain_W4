import boto3
import json
import logging
import os
import sqlite3
import urllib.request
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = "ap-southeast-1"
KB_ID = "IYSEFWWJNK"
DS_ID = "UMEWCMSTX9"
BUCKET = "khoa-ai-kb-aws"

MODEL_ARN = (
    "arn:aws:bedrock:ap-southeast-1:459983119471:"
    "inference-profile/apac.amazon.nova-lite-v1:0"
)

bedrock_agent = boto3.client("bedrock-agent", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-agent-runtime", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://d1zut01pldkee9.cloudfront.net",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Session-Id",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
}

SERVICES = [
    "PaymentGW",
    "OrderSvc",
    "AuthSvc",
    "NotificationSvc",
    "ReportingSvc",
    "FraudDetector",
]

SCOPE_KEYWORDS = [
    "geekbrain",
    "team",
    "owner",
    "lead",
    "responsible",
    "platform",
    "commerce",
    "security",
    "data",
    "service",
    "api",
    "rate limit",
    "deployment",
    "deploy",
    "change freeze",
    "policy",
    "architecture",
    "cost",
    "infrastructure",
    "q1",
    "march",
    "incident",
    "root cause",
    "postmortem",
    "review deadline",
    "sla",
    "availability",
    "latency",
    "p99",
    "error rate",
    "rpm",
    "metrics",
    "monitoring",
    "bedrock",
    "knowledge base",
    "kb",
    "csv",
    "sqlite",
]

FOLLOW_UP_KEYWORDS = [
    "which team",
    "who is responsible",
    "main cause",
    "cause",
    "why",
    "that service",
    "the service",
    "same service",
    "its",
    "their",
    "deadline",
    "overdue",
]

def success_response(data):
    data["timestamp"] = datetime.utcnow().isoformat()
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(data, ensure_ascii=False)
    }

def error_response(message, status=500):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "success": False,
            "error": str(message)
        }, ensure_ascii=False)
    }

def compact_sql(sql):
    return " ".join(sql.split())

def create_observability(session_id, original_question, routed_question, memory):
    observability = {
        "session_id": session_id,
        "question": original_question,
        "tool": None,
        "route_decision": None,
        "memory_loaded": memory,
        "database_queries": [],
        "metrics_endpoint": None,
        "rows": None,
        "final_answer": None
    }

    if routed_question != original_question:
        observability["rewritten_question"] = routed_question

    return observability

def record_database_observability(observability, sql, params, rows):
    if observability is None:
        return

    query = {
        "sql": compact_sql(sql),
        "params": list(params),
        "rows": len(rows),
        "preview": rows[:3]
    }
    observability["database_queries"].append(query)
    observability["sql"] = query["sql"]
    observability["sql_params"] = query["params"]
    observability["rows"] = query["rows"]

def attach_observability(data, observability, tool, route_decision):
    if observability is None:
        return data

    observability["tool"] = tool
    observability["route_decision"] = route_decision
    observability["final_answer"] = data.get("answer")

    citations = data.get("citations")
    if citations:
        observability["retrieved_source"] = citations[0]
        observability["retrieved_chunks"] = len(citations)
        observability["citations"] = citations

    data["observability"] = observability
    return data

def extract_bedrock_citations(response):
    sources = []
    for citation in response.get("citations", []):
        for reference in citation.get("retrievedReferences", []):
            location = reference.get("location", {})
            s3_uri = (
                location
                .get("s3Location", {})
                .get("uri")
            )
            if s3_uri:
                sources.append(s3_uri.rsplit("/", 1)[-1])

    return list(dict.fromkeys(sources))

def is_relevant_question(original_question, routed_question, memory):
    combined = f"{original_question} {routed_question}".lower()

    if extract_service(combined):
        return True

    if any(keyword in combined for keyword in SCOPE_KEYWORDS):
        return True

    has_memory = bool(memory.get("last_service"))
    if has_memory and any(keyword in combined for keyword in FOLLOW_UP_KEYWORDS):
        return True

    return False

def out_of_scope_response(session_id, original_question, routed_question, memory):
    observability = create_observability(
        session_id,
        original_question,
        routed_question,
        memory
    )
    answer = (
        "I can only answer questions related to GeekBrain services, teams, "
        "policies, costs, incidents, SLA, metrics, Bedrock KB, or the current "
        "conversation context."
    )

    return success_response(attach_observability({
        "success": False,
        "session_id": session_id,
        "answer": answer,
        "error": "Out of scope question",
        "citations": []
    }, observability, "Scope Guard", "Question was outside the GeekBrain W4 assistant scope, so no KB or tool call was made."))

def normalize_service(service):
    normalized = service.replace(" ", "").lower()
    for candidate in SERVICES:
        if candidate.lower() == normalized:
            return candidate
    return service

def extract_service(question):
    normalized = question.replace(" ", "").lower()
    for service in SERVICES:
        if service.lower() in normalized:
            return service
    return None

def get_db_path():
    configured_path = os.environ.get("SQLITE_PATH") or os.environ.get("DB_PATH")
    candidates = [
        configured_path,
        "geekbrain.db",
        "/var/task/geekbrain.db",
        "/tmp/geekbrain.db"
    ]

    for path in candidates:
        if path and os.path.exists(path):
            return path

    return configured_path or "geekbrain.db"

def get_memory_db_path():
    return os.environ.get(
        "MEMORY_DB_PATH",
        "/tmp/conversation_memory.db"
    )

def ensure_memory_table(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_memory (
            session_id TEXT NOT NULL,
            memory_key TEXT NOT NULL,
            memory_value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (session_id, memory_key)
        )
        """
    )

def save_memory(session_id, key, value):
    if not session_id or value is None:
        return

    conn = sqlite3.connect(get_memory_db_path())
    try:
        ensure_memory_table(conn)
        conn.execute(
            """
            INSERT OR REPLACE INTO conversation_memory
            (
                session_id,
                memory_key,
                memory_value,
                updated_at
            )
            VALUES
            (?, ?, ?, datetime('now'))
            """,
            (
                session_id,
                key,
                str(value)
            )
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(f"MEMORY_SAVE session={session_id} {key}={value}")

def load_memory(session_id):
    if not session_id:
        return {}

    conn = sqlite3.connect(get_memory_db_path())
    try:
        ensure_memory_table(conn)
        rows = conn.execute(
            """
            SELECT memory_key,
                   memory_value
            FROM conversation_memory
            WHERE session_id = ?
            """,
            (session_id,)
        ).fetchall()
    finally:
        conn.close()

    memory = {
        row[0]: row[1]
        for row in rows
    }
    logger.info(f"MEMORY_LOAD session={session_id} memory={memory}")
    return memory

def init_memory_store():
    conn = sqlite3.connect(get_memory_db_path())
    try:
        ensure_memory_table(conn)
        conn.commit()
    finally:
        conn.close()

    logger.info(f"MEMORY_TABLE_READY path={get_memory_db_path()}")

def get_session_id(body, event):
    headers = event.get("headers") or {}
    normalized_headers = {
        str(key).lower(): value
        for key, value in headers.items()
    }
    query = event.get("queryStringParameters") or {}

    explicit_session = (
        body.get("session_id")
        or body.get("sessionId")
        or query.get("session_id")
        or query.get("sessionId")
        or normalized_headers.get("x-session-id")
    )
    if explicit_session:
        return str(explicit_session)

    cookies = event.get("cookies") or []
    for cookie in cookies:
        if cookie.startswith("session_id="):
            return cookie.split("=", 1)[1]

    http_context = event.get("requestContext", {}).get("http", {})
    source_ip = http_context.get("sourceIp")
    user_agent = http_context.get("userAgent")
    if source_ip or user_agent:
        return f"{source_ip or 'unknown-ip'}::{user_agent or 'unknown-agent'}"

    return "default-session"

def rewrite_question_with_memory(question, memory):
    if extract_service(question):
        return question

    service = memory.get("last_service")
    if not service:
        return question

    q = question.lower()
    month = memory.get("last_month", "March 2026")
    incident = memory.get("last_incident", "")

    if "which team" in q or "team responsible" in q or "their team" in q:
        return f"Which team owns {service} and is responsible for {service}?"

    if "main cause" in q or "cause" in q or "why" in q or "spike" in q or "increase" in q:
        return f"What was the main cause of the cost increase for {service} in {month}?"

    if "review deadline" in q or "deadline" in q or "overdue" in q:
        if incident:
            return f"For {service} incident {incident}, what review deadline was mentioned and is it overdue as of 2026-06-01?"
        return f"For the {month} {service} postmortem, what review deadline was mentioned and is it overdue as of 2026-06-01?"

    rewritten = question
    for phrase in [
        "that service",
        "the service",
        "its",
        "their",
        "same service"
    ]:
        rewritten = rewritten.replace(phrase, service)
        rewritten = rewritten.replace(phrase.title(), service)

    if rewritten != question:
        return rewritten

    return f"{question} Context: the previous service was {service}."

def database_query_tool(sql, params=(), observability=None):
    logger.info(f"DATABASE_QUERY={sql} PARAMS={params}")

    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = [
            dict(row)
            for row in cursor.fetchall()
        ]
    finally:
        conn.close()

    logger.info(f"DATABASE_ROWS={len(rows)}")
    record_database_observability(observability, sql, params, rows)
    return rows

def metrics_tool(service, observability=None):
    base_url = os.environ[
        "MONITORING_API_URL"
    ].rstrip("/")

    service = normalize_service(service)
    url = f"{base_url}/metrics/{service}"
    logger.info(f"METRICS_TOOL_URL={url}")
    if observability is not None:
        observability["metrics_endpoint"] = url

    with urllib.request.urlopen(
        url,
        timeout=float(os.environ.get("METRICS_TIMEOUT", "5"))
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )

def metric_latency(metrics):
    if "latency" in metrics:
        return float(metrics["latency"])
    return float(metrics["latency_ms"]["p99"])

def metric_error_rate(metrics):
    if "error_rate" in metrics:
        return float(metrics["error_rate"])
    return float(metrics["error_rate_percent"])

def metric_rpm(metrics):
    if "rpm" in metrics:
        return int(metrics["rpm"])
    return int(metrics["requests_per_minute"])

def get_q1_cost(service, observability=None):
    service = normalize_service(service)
    rows = database_query_tool(
        """
        SELECT SUM(total_cost) AS total
        FROM monthly_costs
        WHERE service = ?
        AND month IN ('2026-01', '2026-02', '2026-03')
        """,
        (service,),
        observability
    )
    return round(float(rows[0]["total"] or 0), 2)

def get_incidents(service, observability=None):
    service = normalize_service(service)
    return database_query_tool(
        """
        SELECT incident_id, service, date, severity, duration_minutes, root_cause, resolution
        FROM incidents
        WHERE service = ?
        ORDER BY date
        """,
        (service,),
        observability
    )

def get_sla(service, observability=None):
    service = normalize_service(service)
    return database_query_tool(
        """
        SELECT service, metric, target, measurement_window
        FROM sla_targets
        WHERE service = ?
        ORDER BY metric
        """,
        (service,),
        observability
    )

def get_average_latency(service, observability=None):
    service = normalize_service(service)
    rows = database_query_tool(
        """
        SELECT AVG(latency_p99_ms) AS average_latency
        FROM daily_metrics
        WHERE service = ?
        """,
        (service,),
        observability
    )
    if not rows or rows[0]["average_latency"] is None:
        return None
    return round(float(rows[0]["average_latency"]), 2)

def get_sla_target(service, metric, observability=None):
    service = normalize_service(service)
    rows = database_query_tool(
        """
        SELECT target
        FROM sla_targets
        WHERE service = ?
        AND metric = ?
        """,
        (service, metric),
        observability
    )
    if not rows:
        return None
    return float(rows[0]["target"])

def get_q1_total_all_services(observability=None):
    rows = database_query_tool(
        """
        SELECT SUM(total_cost) AS total
        FROM monthly_costs
        WHERE month IN ('2026-01', '2026-02', '2026-03')
        """,
        (),
        observability
    )
    return round(float(rows[0]["total"] or 0), 2)

def get_highest_march_cost(observability=None):
    rows = database_query_tool(
        """
        SELECT service, total_cost
        FROM monthly_costs
        WHERE month = '2026-03'
        ORDER BY total_cost DESC
        LIMIT 1
        """,
        (),
        observability
    )
    return rows[0] if rows else None

def lambda_handler(event, context):
    init_memory_store()

    if event.get("rawPath") == "/health":
        return success_response({
            "status": "healthy",
            "service": "bedrock-kb-api"
        })

    try:
        method = (
            event.get("requestContext", {})
            .get("http", {})
            .get("method")
        )

        if method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": CORS_HEADERS,
                "body": ""
            }
    except Exception:
        pass

    try:
        if (
            "Records" in event
            and event["Records"][0].get("eventSource") == "aws:s3"
        ):
            logger.info("STARTING KNOWLEDGE BASE INGESTION")

            response = bedrock_agent.start_ingestion_job(
                knowledgeBaseId=KB_ID,
                dataSourceId=DS_ID
            )

            return success_response({
                "success": True,
                "jobId": response["ingestionJob"]["ingestionJobId"]
            })

    except Exception as e:
        logger.exception("BEDROCK INGESTION ERROR")
        return error_response(e)

    try:
        body = event.get("body", event)

        if isinstance(body, str):
            body = json.loads(body)

        question = body.get("question", "").strip()

        if not question:
            return error_response(
                "Missing field: question",
                400
            )

        logger.info(f"QUESTION={question}")

        session_id = get_session_id(body, event)
        memory = load_memory(session_id)
        original_question = question
        question = rewrite_question_with_memory(
            question,
            memory
        )

        if question != original_question:
            logger.info(f"REWRITTEN_QUESTION={question}")

        observability = create_observability(
            session_id,
            original_question,
            question,
            memory
        )

        if not is_relevant_question(original_question, question, memory):
            logger.info("USING SCOPE GUARD")
            return out_of_scope_response(
                session_id,
                original_question,
                question,
                memory
            )

        q = question.lower()

        service = extract_service(question)

        if "cost" in q and "q1" in q:
            logger.info("USING COST TOOL")

            if service:
                total = get_q1_cost(service, observability)
                save_memory(session_id, "last_service", service)

                answer = f"{service} total Q1 2026 cost is ${total:,.0f}"
                return success_response(attach_observability({
                    "success": True,
                    "session_id": session_id,
                    "tool_used": "Database Query Tool",
                    "service": service,
                    "answer": answer,
                    "citations": ["monthly_costs table"]
                }, observability, "Database Query Tool", "Cost question routed to SQLite monthly_costs table."))

            total = get_q1_total_all_services(observability)
            answer = f"GeekBrain total infrastructure cost across all services in Q1 2026 is ${total:,.0f}"

            return success_response(attach_observability({
                "success": True,
                "session_id": session_id,
                "tool_used": "Database Query Tool",
                "answer": answer,
                "citations": ["monthly_costs table"]
            }, observability, "Database Query Tool", "Cost question routed to SQLite monthly_costs table."))

        if "highest" in q and "cost" in q and "march" in q:
            logger.info("USING COST TOOL")
            row = get_highest_march_cost(observability)
            save_memory(session_id, "last_service", row["service"])
            save_memory(session_id, "last_month", "March 2026")
            if row["service"] == "PaymentGW":
                save_memory(session_id, "last_incident", "INC-005")

            answer = f"{row['service']} had the highest total cost in March 2026 at ${row['total_cost']:,.0f}"
            return success_response(attach_observability({
                "success": True,
                "session_id": session_id,
                "tool_used": "Database Query Tool",
                "answer": answer,
                "data": row,
                "citations": ["monthly_costs table"]
            }, observability, "Database Query Tool", "Highest March cost routed to SQLite monthly_costs table."))

        if "incident" in q or "incidents" in q or "root cause" in q:
            if service:
                logger.info("USING INCIDENT TOOL")
                incidents = get_incidents(service, observability)
                save_memory(session_id, "last_service", service)
                if incidents:
                    save_memory(session_id, "last_incident", incidents[-1]["incident_id"])

                answer = f"Found {len(incidents)} incidents for {service}"
                return success_response(attach_observability({
                    "success": True,
                    "session_id": session_id,
                    "tool_used": "Database Query Tool",
                    "service": service,
                    "answer": answer,
                    "data": incidents,
                    "citations": ["incidents table"]
                }, observability, "Incident Tool", "Incident question routed to SQLite incidents table."))

        if "sla" in q or "target" in q or "availability" in q:
            if service:
                logger.info("USING SLA TOOL")
                save_memory(session_id, "last_service", service)

                if "within" in q or "current" in q or "latency" in q or "error rate" in q:
                    logger.info("USING METRICS TOOL")
                    metrics = metrics_tool(service, observability)

                    if "error" in q:
                        target = get_sla_target(service, "error_rate_percent", observability)
                        current = metric_error_rate(metrics)
                        unit = "%"
                        metric_name = "error rate"
                    else:
                        target = get_sla_target(service, "latency_p99_ms", observability)
                        current = metric_latency(metrics)
                        unit = " ms"
                        metric_name = "p99 latency"

                    within = current <= target

                    answer = (
                        f"{service} is {'within' if within else 'outside'} SLA. "
                        f"Current {metric_name}: {current:g}{unit}. "
                        f"Target {metric_name}: {target:g}{unit}."
                    )
                    return success_response(attach_observability({
                        "success": True,
                        "session_id": session_id,
                        "tool_used": "Database Query Tool + Service Metrics Tool",
                        "service": service,
                        "answer": answer,
                        "current": current,
                        "target": target,
                        "metrics": metrics,
                        "citations": [
                            "sla_targets table",
                            "Monitoring API"
                        ]
                    }, observability, "SLA Tool + Metrics Tool", "SLA question routed to SQLite target lookup and Monitoring API current metrics."))

                sla = get_sla(service, observability)

                answer = f"Found {len(sla)} SLA targets for {service}"
                return success_response(attach_observability({
                    "success": True,
                    "session_id": session_id,
                    "tool_used": "Database Query Tool",
                    "service": service,
                    "answer": answer,
                    "data": sla,
                    "citations": ["sla_targets table"]
                }, observability, "SLA Tool", "SLA question routed to SQLite sla_targets table."))

        if "latency" in q or "p99" in q or "error rate" in q:
            if service:
                logger.info("USING METRICS TOOL")
                save_memory(session_id, "last_service", service)
                metrics = metrics_tool(service, observability)

                if "average" in q or "q1" in q:
                    logger.info("USING DATABASE QUERY TOOL")
                    avg = get_average_latency(service, observability)

                    answer = (
                        f"{service} current p99 latency is {metric_latency(metrics):g} ms. "
                        f"Average historical p99 latency is {avg} ms."
                    )
                    return success_response(attach_observability({
                        "success": True,
                        "session_id": session_id,
                        "tool_used": "Database Query Tool + Service Metrics Tool",
                        "service": service,
                        "answer": answer,
                        "current_metrics": metrics,
                        "average_latency_ms": avg,
                        "citations": [
                            "daily_metrics table",
                            "Monitoring API"
                        ]
                    }, observability, "Metrics Tool + Database Query Tool", "Latency question routed to Monitoring API and SQLite daily_metrics table."))

                if "error" in q:
                    answer = f"{service} current error rate is {metric_error_rate(metrics):g}%."
                else:
                    answer = f"{service} current p99 latency is {metric_latency(metrics):g} ms."

                return success_response(attach_observability({
                    "success": True,
                    "session_id": session_id,
                    "tool_used": "Service Metrics Tool",
                    "service": service,
                    "answer": answer,
                    "metrics": metrics,
                    "citations": ["Monitoring API"]
                }, observability, "Metrics Tool", "Current metrics question routed to Monitoring API."))

        logger.info("USING BEDROCK KNOWLEDGE BASE")

        response = bedrock_runtime.retrieve_and_generate(
            input={
                "text": question
            },
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": KB_ID,
                    "modelArn": MODEL_ARN,
                    "retrievalConfiguration": {
                        "vectorSearchConfiguration": {
                            "numberOfResults": 10
                        }
                    }
                }
            }
        )

        answer = response.get("output", {}).get("text", "")
        citations = extract_bedrock_citations(response)
        if service:
            save_memory(session_id, "last_service", service)

        return success_response(attach_observability({
            "success": True,
            "session_id": session_id,
            "original_question": original_question,
            "question": question,
            "answer": answer,
            "source": "Amazon Bedrock Knowledge Base",
            "citations": citations
        }, observability, "Bedrock Knowledge Base", "L1/L2 question routed to Bedrock Knowledge Base retrieval."))

    except Exception as e:
        logger.exception("LAMBDA ERROR")
        return error_response(e)
