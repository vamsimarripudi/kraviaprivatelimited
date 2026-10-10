# Google Play reviewer access

Google Play may require a reviewer to sign in without access to a real
employee mailbox. The review identity is a deliberately isolated
first-party Authenticator account:

- it has no Office role and cannot start an Office browser session;
- it may only obtain an `AUTHENTICATOR_ACTIVATION` mobile session;
- it uses a reusable six-digit Play review code instead of email delivery;
- it is time-bounded, revocable, and audited; and
- it must never be an employee, founder, administrator, or shared mailbox.

## Production setup

1. Deploy the migration before the API code:

   ```bash
   cd Backend
   alembic upgrade head
   ```

2. In Railway's protected service variables, set these temporary values. Do
   not commit them, put them in Expo, or paste them into a Play Store listing:

   ```text
   KRAVIA_PLAY_REVIEWER_EMAIL=play-review@kraviaprivatelimited.com
   KRAVIA_PLAY_REVIEWER_PASSWORD=<unique 20+ character password>
   KRAVIA_PLAY_REVIEWER_OTP=<six digit reusable code>
   KRAVIA_PLAY_REVIEWER_EXPIRES_AT=<ISO-8601 date with timezone, within 365 days>
   ```

3. From the Railway API service shell, run:

   ```bash
   python scripts/manage_play_reviewer.py provision --confirm
   python scripts/manage_play_reviewer.py status
   ```

   The command prints only account state and expiry, never the password or
   review code. Re-provisioning rotates the password/code, revokes old
   sessions/devices, and clears the previous local factor.

4. In Play Console, provide the email, password, and six-digit review code in
   **App access**. Reviewer instructions should say:

   > Open KRAVIA Authenticator. Enter the supplied reviewer email and password,
   > then enter the reusable six-digit review code. No employee mailbox,
   > device-approval email, or Office account is required. The account is
   > limited to Authenticator review and cannot access KRAVIA Office data.

## After Play review

Immediately revoke the account, then remove the protected Railway variables:

```bash
python scripts/manage_play_reviewer.py disable --confirm
```

If Google requests a new review, use fresh password and code values and run
`provision --confirm` again. Do not reactivate a former employee identity.
