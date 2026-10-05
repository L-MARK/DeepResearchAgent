"""增加冻结的 Session 快照和精选 Memory 目标。

Revision ID: 20260823_0002
Revises: 20260815_0001
"""

from alembic import op
import sqlalchemy as sa

revision = "20260823_0002"
down_revision = "20260815_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 初始迁移会创建 ``Base.metadata``，因此全新安装可能已经包含当前模型新增的字段。
    # 保持本迁移具有条件判断，使其同时适用于旧数据库和全新数据库。
    inspector = sa.inspect(op.get_bind())
    session_columns = {item["name"] for item in inspector.get_columns("sessions")}
    memory_columns = {item["name"] for item in inspector.get_columns("memories")}
    for column in (
        sa.Column("memory_snapshot_json", sa.Text(), nullable=True),
        sa.Column("memory_snapshot_version", sa.Integer(), nullable=True),
        sa.Column("memory_snapshot_created_at", sa.String(length=40), nullable=True),
    ):
        if column.name not in session_columns:
            op.add_column("sessions", column)
    for column in (
        sa.Column("target", sa.String(length=32), nullable=True),
        sa.Column("archived_at", sa.String(length=40), nullable=True),
    ):
        if column.name not in memory_columns:
            op.add_column("memories", column)
    op.execute("UPDATE memories SET target = scope WHERE scope IN ('user', 'project')")
    op.execute("UPDATE memories SET status = 'archived' WHERE status = 'expired'")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    memory_columns = {item["name"] for item in inspector.get_columns("memories")}
    session_columns = {item["name"] for item in inspector.get_columns("sessions")}
    with op.batch_alter_table("memories") as batch:
        for name in ("archived_at", "target"):
            if name in memory_columns:
                batch.drop_column(name)
    with op.batch_alter_table("sessions") as batch:
        for name in ("memory_snapshot_created_at", "memory_snapshot_version", "memory_snapshot_json"):
            if name in session_columns:
                batch.drop_column(name)
