"""drop email add user_code

Revision ID: 7125f2112706
Revises: fe56fa70289e
Create Date: 2026-11-17 14:28:50.100695

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '7125f2112706'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add user_code as a nullable column first
    op.add_column(
        'user',
        sa.Column(
            'user_code', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True
        ),
    )
    # 2. Backfill existing rows with a placeholder derived from the id
    #    (the id column itself is never touched)
    op.execute(
        'UPDATE "user" SET user_code = \'u_\' || left(id::text, 8) '
        'WHERE user_code IS NULL'
    )
    # 3. Make it non-nullable and back it with a unique index
    op.alter_column(
        'user',
        'user_code',
        existing_type=sqlmodel.sql.sqltypes.AutoString(length=50),
        nullable=False,
    )
    op.create_index(op.f('ix_user_user_code'), 'user', ['user_code'], unique=True)
    # 4. Drop the legacy email index and column
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_column('user', 'email')


def downgrade():
    # The old email values are lost; restored rows keep email NULL,
    # so the column comes back nullable and the unique index is dropped.
    op.add_column(
        'user',
        sa.Column(
            'email', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
        ),
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.drop_index(op.f('ix_user_user_code'), table_name='user')
    op.drop_column('user', 'user_code')
