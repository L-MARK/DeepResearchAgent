"""移除已退役的图信息源及其持久化运行历史。

The application is now Web-only. This migration intentionally removes only
rows belonging to runs whose frozen source was the retired source; Web runs,
sessions, and unrelated learning records remain intact.

Revision ID: 20260921_0004
Revises: 20260828_0003
"""

from alembic import op


revision = "20260921_0004"
down_revision = "20260828_0003"
branch_labels = None
depends_on = None


def _delete(bind, statement: str) -> None:
    bind.exec_driver_sql(statement)


def upgrade() -> None:
    bind = op.get_bind()
    _delete(
        bind,
        "CREATE TEMP TABLE IF NOT EXISTS _retired_source_runs AS "
        "SELECT run_id, trigger_message_id FROM runs WHERE source_mode = 'graphrag'",
    )
    _delete(
        bind,
        "CREATE TEMP TABLE IF NOT EXISTS _retired_source_candidates AS "
        "SELECT candidate_id FROM skill_candidates WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "CREATE TEMP TABLE IF NOT EXISTS _retired_source_reviews AS "
        "SELECT review_id FROM learning_review_jobs WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs) OR candidate_id IN "
        "(SELECT candidate_id FROM _retired_source_candidates)",
    )
    _delete(
        bind,
        "CREATE TEMP TABLE IF NOT EXISTS _retired_source_skill_versions AS "
        "SELECT skill_version_id FROM skill_versions WHERE EXISTS ("
        "SELECT 1 FROM _retired_source_runs r WHERE "
        "instr(skill_versions.source_run_ids_json, '\"' || r.run_id || '\"') > 0)",
    )

    # 先删除最深层的子记录。临时表可以在父表记录逐步删除时保持目标集合稳定。
    _delete(
        bind,
        "DELETE FROM skill_read_marks WHERE review_id IN "
        "(SELECT review_id FROM _retired_source_reviews) OR skill_version_id IN "
        "(SELECT skill_version_id FROM _retired_source_skill_versions)",
    )
    _delete(
        bind,
        "DELETE FROM skill_deployments WHERE skill_version_id IN "
        "(SELECT skill_version_id FROM _retired_source_skill_versions)",
    )
    _delete(
        bind,
        "DELETE FROM eval_runs WHERE candidate_id IN "
        "(SELECT candidate_id FROM _retired_source_candidates)",
    )
    _delete(
        bind,
        "DELETE FROM learning_review_jobs WHERE review_id IN "
        "(SELECT review_id FROM _retired_source_reviews)",
    )
    _delete(
        bind,
        "DELETE FROM skill_candidates WHERE candidate_id IN "
        "(SELECT candidate_id FROM _retired_source_candidates)",
    )
    _delete(
        bind,
        "DELETE FROM skill_versions WHERE skill_version_id IN "
        "(SELECT skill_version_id FROM _retired_source_skill_versions)",
    )
    _delete(
        bind,
        "DELETE FROM tool_calls WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM evidence WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM contract_checks WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM checkpoints WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM run_events WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM tasks WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM plans WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM artifacts WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    # runs.trigger_message_id 指向 messages，因此先删除 runs，
    # 再删除与这些 Run 关联的消息。
    _delete(
        bind,
        "DELETE FROM runs WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs)",
    )
    _delete(
        bind,
        "DELETE FROM messages WHERE run_id IN "
        "(SELECT run_id FROM _retired_source_runs) OR message_id IN "
        "(SELECT trigger_message_id FROM _retired_source_runs)",
    )
    _delete(bind, "DROP TABLE _retired_source_skill_versions")
    _delete(bind, "DROP TABLE _retired_source_reviews")
    _delete(bind, "DROP TABLE _retired_source_candidates")
    _delete(bind, "DROP TABLE _retired_source_runs")


def downgrade() -> None:
    # 被删除的历史 Run 没有备份就无法恢复。
    pass
