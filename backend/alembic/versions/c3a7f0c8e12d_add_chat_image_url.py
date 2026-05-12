"""add chat image url

Revision ID: c3a7f0c8e12d
Revises: b9350e95910a
Create Date: 2026-05-12 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3a7f0c8e12d"
down_revision: Union[str, Sequence[str], None] = "b9350e95910a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("chat", sa.Column("image_url", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("chat", "image_url")
