"""
ProspectX Background Worker
Celery tasks for async report generation and stats import.

Usage:
    celery -A celery_worker worker --loglevel=info
"""

import asyncio
import json
import logging
import os
import time

import asyncpg
from anthropic import Anthropic
from celery import Celery

# ============================================================
# CELERY CONFIG
# ============================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "prospectx",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=120,  # 2 minutes soft limit
    task_time_limit=180,       # 3 minutes hard limit
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
)

logger = logging.getLogger("prospectx.worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


# ============================================================
# HELPERS
# ============================================================

def _get_db_dsn() -> str:
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "prospectx")
    user = os.getenv("DB_USER", "postgres")
    pw = os.getenv("DB_PASSWORD", "")
    return f"postgresql://{user}:{pw}@{host}:{port}/{name}"


async def _get_connection() -> asyncpg.Connection:
    return await asyncpg.connect(_get_db_dsn())


def _row_to_dict(row):
    import uuid as _uuid
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, _uuid.UUID):
            d[k] = str(v)
    return d


# ============================================================
# TASK: Generate Report
# ============================================================

@celery_app.task(bind=True, name="generate_report")
def generate_report_task(self, report_id: str):
    """
    Background task to generate a scouting report.

    Flow:
    1. Fetch report record (includes player_id, template info)
    2. Fetch player + stats from DB
    3. Call Claude API with template prompt + data
    4. Save output back to report record
    """
    logger.info("Starting report generation: %s", report_id)
    return asyncio.get_event_loop().run_until_complete(
        _generate_report_async(self, report_id)
    )


async def _generate_report_async(task, report_id: str):
    conn = await _get_connection()
    start_time = time.perf_counter()

    try:
        # Update status to processing
        await conn.execute(
            "UPDATE reports SET status = 'processing' WHERE id = $1",
            report_id,
        )

        # Fetch report
        report = await conn.fetchrow("SELECT * FROM reports WHERE id = $1", report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")

        # Fetch template
        template = await conn.fetchrow(
            "SELECT * FROM report_templates WHERE id = $1",
            report["template_id"],
        )
        if not template:
            raise ValueError(f"Template not found for report {report_id}")

        # Fetch player
        player = await conn.fetchrow(
            "SELECT * FROM players WHERE id = $1",
            report["player_id"],
        )
        if not player:
            raise ValueError(f"Player not found for report {report_id}")

        # Fetch stats
        stats = await conn.fetch(
            "SELECT * FROM player_stats WHERE player_id = $1 ORDER BY created_at DESC",
            report["player_id"],
        )

        goalie_stats = []
        if dict(player).get("position") == "G":
            goalie_stats = await conn.fetch(
                "SELECT * FROM goalie_stats WHERE player_id = $1 ORDER BY created_at DESC",
                report["player_id"],
            )

        # Build input
        input_data = {
            "player": _row_to_dict(player),
            "stats": [_row_to_dict(s) for s in stats],
            "goalie_stats": [_row_to_dict(s) for s in goalie_stats],
        }

        for key in ["org_id", "created_at", "updated_at"]:
            input_data["player"].pop(key, None)

        # Update task progress
        task.update_state(state="PROGRESS", meta={"step": "calling_llm", "progress": 50})

        # Call Claude
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        client = Anthropic(api_key=api_key)
        system_prompt = template["prompt_text"]
        user_prompt = (
            "Here is the structured input for this player:\n\n"
            + json.dumps(input_data, indent=2, default=str)
        )

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        output_text = message.content[0].text
        generation_ms = int((time.perf_counter() - start_time) * 1000)
        total_tokens = message.usage.input_tokens + message.usage.output_tokens

        player_name = f"{player['first_name']} {player['last_name']}"
        title = f"{template['template_name']} — {player_name}"

        # Save results
        await conn.execute(
            """
            UPDATE reports SET
                status = 'complete',
                title = $1,
                output_text = $2,
                input_data = $3,
                generated_at = NOW(),
                llm_model = 'claude-sonnet-4-20250514',
                llm_tokens = $4,
                generation_time_ms = $5
            WHERE id = $6
            """,
            title,
            output_text,
            json.dumps(input_data, default=str),
            total_tokens,
            generation_ms,
            report_id,
        )

        logger.info(
            "Report complete: %s (%s) in %d ms, %d tokens",
            title,
            report_id,
            generation_ms,
            total_tokens,
        )

        return {
            "report_id": report_id,
            "status": "complete",
            "title": title,
            "generation_time_ms": generation_ms,
            "tokens": total_tokens,
        }

    except Exception as e:
        logger.error("Report generation failed: %s — %s", report_id, str(e))
        await conn.execute(
            "UPDATE reports SET status = 'failed', error_message = $1 WHERE id = $2",
            str(e),
            report_id,
        )
        raise

    finally:
        await conn.close()


# ============================================================
# TASK: Import Stats from CSV
# ============================================================

@celery_app.task(bind=True, name="import_stats")
def import_stats_task(self, job_id: str, csv_content: str, season: str, org_id: str):
    """
    Background task to process a CSV stats import.
    """
    logger.info("Starting stats import: job %s", job_id)
    return asyncio.get_event_loop().run_until_complete(
        _import_stats_async(self, job_id, csv_content, season, org_id)
    )


async def _import_stats_async(task, job_id: str, csv_content: str, season: str, org_id: str):
    import csv as _csv
    import io as _io

    conn = await _get_connection()

    try:
        await conn.execute(
            "UPDATE ingest_jobs SET status = 'processing' WHERE id = $1", job_id
        )

        reader = _csv.DictReader(_io.StringIO(csv_content))
        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            try:
                first = row.get("first_name", "").strip()
                last = row.get("last_name", "").strip()

                if not first or not last:
                    errors.append({"row": row_num, "error": "Missing name"})
                    skipped += 1
                    continue

                player = await conn.fetchrow(
                    "SELECT id FROM players WHERE org_id = $1 "
                    "AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3)",
                    org_id, first, last,
                )

                if not player:
                    errors.append({"row": row_num, "error": f"Player not found: {first} {last}"})
                    skipped += 1
                    continue

                def _int(val, default=0):
                    try:
                        return int(val.strip()) if val and val.strip() else default
                    except (ValueError, AttributeError):
                        return default

                gp = _int(row.get("gp", "0"))
                g = _int(row.get("g", "0"))
                a = _int(row.get("a", "0"))
                p = _int(row.get("p", ""), g + a)

                await conn.execute(
                    """
                    INSERT INTO player_stats (
                        player_id, season, stat_type, gp, g, a, p,
                        plus_minus, pim, shots, sog
                    ) VALUES ($1, $2, 'season', $3, $4, $5, $6, $7, $8, $9, $10)
                    """,
                    player["id"], season, gp, g, a, p,
                    _int(row.get("plus_minus", "0")),
                    _int(row.get("pim", "0")),
                    _int(row.get("shots", "0")),
                    _int(row.get("sog", "0")),
                )
                imported += 1

                # Update progress every 50 rows
                if imported % 50 == 0:
                    task.update_state(
                        state="PROGRESS",
                        meta={"imported": imported, "skipped": skipped},
                    )

            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})
                skipped += 1

        result = {"imported": imported, "skipped": skipped, "errors": errors[:50]}

        await conn.execute(
            "UPDATE ingest_jobs SET status = 'complete', result_data = $1 WHERE id = $2",
            json.dumps(result),
            job_id,
        )

        logger.info("Stats import complete: %d imported, %d skipped (job %s)", imported, skipped, job_id)
        return result

    except Exception as e:
        logger.error("Stats import failed: job %s — %s", job_id, str(e))
        await conn.execute(
            "UPDATE ingest_jobs SET status = 'failed', error_message = $1 WHERE id = $2",
            str(e), job_id,
        )
        raise

    finally:
        await conn.close()
