"""Email service — Resend integration with graceful fallback to console-log."""
import os
import asyncio
import logging

logger = logging.getLogger("lms.email")


def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


async def send_email(to: str, subject: str, html: str) -> dict:
    """Send a transactional email. If Resend is not configured, log to console.

    Always returns a dict with `{status, mocked}` so callers can be agnostic.
    """
    api_key = os.environ.get("RESEND_API_KEY", "")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    if not api_key:
        logger.info("[MOCK EMAIL] to=%s subject=%s", to, subject)
        logger.debug("[MOCK EMAIL BODY] %s", html[:300])
        return {"status": "mocked", "mocked": True}
    try:
        import resend
        resend.api_key = api_key
        params = {"from": sender, "to": [to], "subject": subject, "html": html}
        res = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "mocked": False, "id": res.get("id")}
    except Exception as e:
        logger.error("Resend failed: %s — falling back to mock", e)
        return {"status": "error", "mocked": True, "error": str(e)}


def _wrap(title: str, body_html: str, cta_label: str = "", cta_url: str = "") -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <tr><td align="center" style="padding:24px 0;">
          <a href="{cta_url}" style="background:#1e40af;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;">{cta_label}</a>
        </td></tr>"""
    return f"""<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#1e40af;padding:20px 24px;color:#fff;">
            <div style="font-weight:700;font-size:18px;letter-spacing:-0.02em;">LearnHub</div>
          </td></tr>
          <tr><td style="padding:28px 28px 4px 28px;">
            <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">{title}</h1>
          </td></tr>
          <tr><td style="padding:0 28px 24px 28px;color:#475569;font-size:14px;line-height:1.6;">
            {body_html}
          </td></tr>
          {cta_block}
          <tr><td style="padding:24px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;">
            © LearnHub · You're receiving this because you have an account at LearnHub.
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>"""


# ---------- Templates ----------
def welcome_email(first_name: str) -> tuple[str, str]:
    subject = "Welcome to LearnHub!"
    body = f"<p>Hi {first_name},</p><p>Welcome to LearnHub — your new home for hands-on, outcomes-driven learning.</p><p>Browse our catalog, enroll in your first course, and start building skills today.</p>"
    return subject, _wrap("Welcome to LearnHub", body, "Browse courses", os.environ.get("FRONTEND_URL", "") + "/courses")


def reset_password_email(reset_link: str) -> tuple[str, str]:
    subject = "Reset your LearnHub password"
    body = "<p>You requested to reset your password. Click the button below to choose a new password. This link expires in 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>"
    return subject, _wrap("Reset your password", body, "Reset password", reset_link)


def enrollment_email(first_name: str, course_title: str, course_url: str) -> tuple[str, str]:
    subject = f"You're enrolled in {course_title}"
    body = f"<p>Hi {first_name},</p><p>You just enrolled in <strong>{course_title}</strong>. Time to start learning!</p>"
    return subject, _wrap("Enrollment confirmed", body, "Start learning", course_url)


def certificate_email(first_name: str, course_title: str, cert_number: str, verify_url: str) -> tuple[str, str]:
    subject = f"Certificate earned — {course_title}"
    body = f"<p>Congratulations {first_name}!</p><p>You completed <strong>{course_title}</strong> and earned an official LearnHub certificate.</p><p style='font-family:monospace;background:#f1f5f9;padding:8px;border-radius:6px;'>Certificate ID: <strong>{cert_number}</strong></p>"
    return subject, _wrap("You earned a certificate 🎉", body, "Download & share", verify_url)
