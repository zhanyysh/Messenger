"""add last_read_at to chat_participant

Revision ID: 9a1f7c0bd213
Revises: 2e3f9a1bc9d2
Create Date: 2026-03-27 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9a1f7c0bd213"
down_revision = "2e3f9a1bc9d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_participant",
        sa.Column("last_read_at", sa.DateTime(), nullable=True),
    )

    op.execute("UPDATE chat_participant SET last_read_at = joined_at")

    op.alter_column("chat_participant", "last_read_at", nullable=False)


def downgrade() -> None:
    op.drop_column("chat_participant", "last_read_at")
