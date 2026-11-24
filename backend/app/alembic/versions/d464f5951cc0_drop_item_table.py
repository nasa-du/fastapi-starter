"""drop item table

Revision ID: d464f5951cc0
Revises: 7125f2112706
Create Date: 2026-11-24 17:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'd464f5951cc0'
down_revision = '7125f2112706'
branch_labels = None
depends_on = None


def upgrade():
    # The Item feature was removed from the application (SPEC-item-removal.md).
    # Dropping the table permanently deletes every remaining Item row.
    op.drop_table('item')


def downgrade():
    # Rebuild the empty `item` table with the exact structure it had at
    # revision 7125f2112706, the last revision where the table existed:
    # UUID primary key, non-null owner_id foreign key to user.id with
    # ON DELETE CASCADE, VARCHAR(255) title (not null), VARCHAR(255)
    # description (nullable), timezone-aware created_at (nullable).
    #
    # This restores STRUCTURE ONLY. upgrade() permanently deleted every Item
    # row and this downgrade cannot and does not restore any of that data.
    op.create_table(
        'item',
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['owner_id'],
            ['user.id'],
            ondelete='CASCADE',
            name='item_owner_id_fkey',
        ),
        sa.PrimaryKeyConstraint('id', name='item_pkey'),
    )
