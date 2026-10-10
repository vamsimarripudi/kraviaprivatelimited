from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Index
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
    mfa_last_accepted_counter = Column(BigInteger, nullable=True)
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


class OfficePlayReviewerAccess(Base):
    """A time-bounded Google Play review identity with no Office role.

    The reviewer is an actual first-party identity so credential handling and
    session revocation remain auditable.  It deliberately has no
    ``OfficeAuthRole`` row: the only session capability it can receive is the
    native Authenticator activation capability.
    """

    __tablename__ = "office_play_reviewer_access"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False, unique=True)
    otp_code_hash = Column(String(512), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    disabled_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_office_play_reviewer_access_enabled_expires", "enabled", "expires_at"),
    )


class OfficeAuthSession(Base):
    __tablename__ = "office_auth_sessions_v2"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(String(64), nullable=False, unique=True)
    status = Column(String(24), nullable=False, default="ACTIVE")
    aal = Column(String(8), nullable=False, default="aal1")
    # A mobile email-verification session can authorize only Authenticator
    # activation. It must never be accepted as a general Office web session.
    purpose = Column(String(48), nullable=False, default="OFFICE")
    mfa_failed_attempts = Column(Integer, nullable=False, default=0)
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


class OfficeLoginDeviceApproval(Base):
    """A browser-device request held between TOTP and active Office access.

    The account-owner email token and original-browser proof are both stored
    only as hashes.  An approval link therefore changes request state, while
    the original browser must separately prove that it initiated the request
    before it can receive an active Office session.
    """

    __tablename__ = "office_login_device_approvals"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), ForeignKey("office_auth_sessions_v2.id", ondelete="CASCADE"), nullable=False, unique=True)
    device_token_hash = Column(String(64), nullable=False, unique=True)
    owner_action_token_hash = Column(String(64), nullable=False, unique=True)
    status = Column(String(32), nullable=False, default="PENDING")
    source_ip_address = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)
    device_label = Column(String(160), nullable=False)
    provider_message_id = Column(String(320), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    trusted_until = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    declined_at = Column(DateTime(timezone=True), nullable=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_login_device_approvals_user_status", "user_id", "status"),
        Index("ix_office_login_device_approvals_status_expires", "status", "expires_at"),
    )


class OfficeQrSigninApproval(Base):
    """A short-lived Authenticator approval for one existing browser session.

    The QR payload is deliberately not an Office bearer credential.  It carries
    only a single-use scan capability, while a separate browser proof remains
    in an HttpOnly cookie on the browser that started the password sign-in.
    A trusted mobile-device proof and a fresh on-device biometric check are
    required before this row can move to ``APPROVED``.
    """

    __tablename__ = "office_qr_signin_approvals"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), ForeignKey("office_auth_sessions_v2.id", ondelete="CASCADE"), nullable=False)
    browser_proof_hash = Column(String(64), nullable=False, unique=True)
    scan_token_hash = Column(String(64), nullable=False, unique=True)
    status = Column(String(24), nullable=False, default="PENDING")
    source_ip_address = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)
    browser_label = Column(String(160), nullable=False)
    scanned_by_device_id = Column(String(36), ForeignKey("office_login_device_approvals.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    scanned_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_qr_signin_approvals_user_status", "user_id", "status"),
        Index("ix_office_qr_signin_approvals_session_status", "session_id", "status"),
        Index("ix_office_qr_signin_approvals_status_expires", "status", "expires_at"),
    )


class OfficeAuthInvite(Base):
    __tablename__ = "office_auth_invites"

    id = Column(String(36), primary_key=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    email = Column(String(320), nullable=False)
    display_name = Column(String(160), nullable=True)
    job_title = Column(String(160), nullable=True)
    department = Column(String(64), nullable=True)
    roles_json = Column(Text, nullable=False, default="[]")
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


class OfficeAuthenticatorActivation(Base):
    """A one-time, administrator-approved claim for a new authenticator phone.

    The claim token is stored only as a hash. It is not an Office session and
    cannot access any company data; it merely lets the approved phone receive
    its new local TOTP seed exactly once.
    """

    __tablename__ = "office_authenticator_activations"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    # An activation capability is inseparable from the exact trusted phone
    # session that created it. A replacement, recovery, or removal of that
    # device must make its unused capability unusable as well.
    session_id = Column(String(36), ForeignKey("office_auth_sessions_v2.id", ondelete="CASCADE"), nullable=True)
    device_approval_id = Column(String(36), ForeignKey("office_login_device_approvals.id", ondelete="CASCADE"), nullable=True)
    claim_token_hash = Column(String(64), nullable=False, unique=True)
    status = Column(String(24), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_authenticator_activations_user_status", "user_id", "status"),
        Index("ix_office_authenticator_activations_session_status", "session_id", "status"),
        Index("ix_office_authenticator_activations_device_status", "device_approval_id", "status"),
        Index("ix_office_authenticator_activations_status_expires", "status", "expires_at"),
    )


class OfficeEmailOtpChallenge(Base):
    """A hashed, single-use email challenge for a KRAVIA mobile sign-in.

    Neither the six-digit code nor the high-entropy challenge token is retained
    in cleartext. Delivery states preserve the distinction between a confirmed
    provider rejection and an external outcome that could not be determined.
    """

    __tablename__ = "office_email_otp_challenges"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False)
    challenge_token_hash = Column(String(64), nullable=False, unique=True)
    code_hash = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default="PENDING")
    channel = Column(String(48), nullable=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    delivery_attempt_count = Column(Integer, nullable=False, default=0)
    provider_message_id = Column(String(320), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_email_otp_challenges_user_status", "user_id", "status"),
        Index("ix_office_email_otp_challenges_status_expires", "status", "expires_at"),
    )


class OfficePublicEmailDelivery(Base):
    """Idempotent public-form receipt delivery metadata.

    The sender never retains the requester's email address here. A keyed
    fingerprint is enough to detect an accidental event-id reuse while the
    public-form database remains the authoritative source for the request.
    """

    __tablename__ = "office_public_email_deliveries"

    event_id = Column(String(160), primary_key=True)
    reference = Column(String(64), nullable=False)
    form_kind = Column(String(32), nullable=False)
    delivery_kind = Column(String(32), nullable=False, default="ACKNOWLEDGEMENT")
    content_fingerprint = Column(String(64), nullable=True)
    recipient_fingerprint = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default="PENDING")
    provider_message_id = Column(String(320), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_office_public_email_deliveries_status_created", "status", "created_at"),
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
