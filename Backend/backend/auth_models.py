from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.sql import func

from .database import Base


class OfficeAuthUser(Base):
    __tablename__ = "office_auth_users"

    id = Column(String(36), primary_key=True)
    email = Column(String(320), nullable=False, unique=True)
    display_name = Column(String(160), nullable=False)
    password_hash = Column(String(512), nullable=False)
    status = Column(String(24), nullable=False, default="ACTIVE")
    founder_slot = Column(String(32), nullable=True, unique=True)
    mfa_secret_ciphertext = Column(Text, nullable=True)
    mfa_verified_at = Column(DateTime(timezone=True), nullable=True)
    failed_login_count = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_office_auth_users_status", "status"),
    )


class OfficeAuthRole(Base):
    __tablename__ = "office_auth_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(64), nullable=False)
    granted_by = Column(String(36), nullable=True)
    grant_reason = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "role", name="uq_office_auth_role_user_role"),
        Index("ix_office_auth_roles_user", "user_id"),
    )


class OfficeAuthSession(Base):
    __tablename__ = "office_auth_sessions_v2"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(String(64), nullable=False, unique=True)
    status = Column(String(24), nullable=False, default="ACTIVE")
    aal = Column(String(8), nullable=False, default="aal1")
    ip_address = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_auth_sessions_v2_user_status", "user_id", "status"),
        Index("ix_office_auth_sessions_v2_expires", "expires_at"),
    )


class OfficeAuthInvite(Base):
    __tablename__ = "office_auth_invites"

    id = Column(String(36), primary_key=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    email = Column(String(320), nullable=False)
    display_name = Column(String(160), nullable=True)
    job_title = Column(String(160), nullable=True)
    department = Column(String(64), nullable=True)
    role = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default="PENDING")
    created_by = Column(String(36), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_by = Column(String(36), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_auth_invites_email_status", "email", "status"),
        Index("ix_office_auth_invites_expires", "expires_at"),
    )


class OfficeAuthEvent(Base):
    __tablename__ = "office_auth_events_v2"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=True)
    session_id = Column(String(36), nullable=True)
    event_type = Column(String(80), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_office_auth_events_v2_user_created", "user_id", "created_at"),
        Index("ix_office_auth_events_v2_session_created", "session_id", "created_at"),
    )
