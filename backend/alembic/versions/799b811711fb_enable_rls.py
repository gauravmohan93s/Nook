"""enable rls

Revision ID: 799b811711fb
Revises: 8d106fbde0bf
Create Date: 2026-01-21 12:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '799b811711fb'
down_revision = '8d106fbde0bf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE content_cache ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE saved_articles DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE usage_logs DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE content_cache DISABLE ROW LEVEL SECURITY;")