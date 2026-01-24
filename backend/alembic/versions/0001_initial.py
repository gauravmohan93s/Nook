"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-01-19
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"])

    op.create_table(
        "saved_articles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_saved_articles_id", "saved_articles", ["id"])

    op.create_table(
        "usage_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.String(), nullable=True),
        sa.Column("count", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_usage_logs_id", "usage_logs", ["id"])

    op.create_table(
        "content_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("license", sa.String(), nullable=True),
        sa.Column("content_html", sa.String(), nullable=True),
        sa.Column("content_text", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_content_cache_id", "content_cache", ["id"])
    op.create_index(
        "ix_content_cache_url_source",
        "content_cache",
        ["url", "source"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_content_cache_url_source", table_name="content_cache")
    op.drop_index("ix_content_cache_id", table_name="content_cache")
    op.drop_table("content_cache")

    op.drop_index("ix_usage_logs_id", table_name="usage_logs")
    op.drop_table("usage_logs")

    op.drop_index("ix_saved_articles_id", table_name="saved_articles")
    op.drop_table("saved_articles")

    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
