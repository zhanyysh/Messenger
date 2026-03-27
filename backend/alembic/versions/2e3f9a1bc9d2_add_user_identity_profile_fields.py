"""Add user identity and profile fields

Revision ID: 2e3f9a1bc9d2
Revises: 7482838cac3f
Create Date: 2026-03-27 20:05:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2e3f9a1bc9d2"
down_revision: Union[str, Sequence[str], None] = "7482838cac3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("user", sa.Column("username", sa.String(), nullable=True))
    op.add_column("user", sa.Column("bio", sa.String(), nullable=True))
    op.add_column("user", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("user", sa.Column("last_seen", sa.DateTime(), nullable=True))

    op.create_index(op.f("ix_user_username"), "user", ["username"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_user_username"), table_name="user")

    op.drop_column("user", "last_seen")
    op.drop_column("user", "avatar_url")
    op.drop_column("user", "bio")
    op.drop_column("user", "username")
