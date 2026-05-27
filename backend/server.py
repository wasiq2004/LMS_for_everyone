"""Main FastAPI server for the LMS."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File, Header
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import jwt

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    serialize_user, get_current_user, require_roles, get_optional_user,
    get_jwt_secret, JWT_ALGORITHM,
    MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES,
)
from db_utils import serialize_doc, slugify, safe_object_id
import socketio
from models import (
    RegisterIn, LoginIn, ForgotPasswordIn, ResetPasswordIn,
    CategoryIn, CourseIn, CourseUpdate,
    SectionIn, LessonIn, ProgressIn, ReviewIn,
    UserRoleUpdate, ProfileUpdate,
    QuizIn, QuizSubmitIn, DiscussionIn, AnnouncementIn, SettingIn,
    AssignmentIn, SubmissionTextIn, GradeIn,
)
from email_service import send_email, welcome_email, reset_password_email, enrollment_email, certificate_email
from storage import init_storage, put_object, get_object, make_path
from socket_io import sio, push_notification

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- APP ----------
app = FastAPI(title="LearnHub LMS API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("lms")


# ---------- Rate limiter ----------
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


def _client_id(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_id, default_limits=["120/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"success": False, "detail": exc.detail})
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"success": False, "detail": "Internal server error"})




async def create_notification(user_id, ntype: str, title: str, message: str, link: str = "") -> dict:
    """Persist a notification and push it over Socket.IO."""
    doc = {
        "user_id": user_id if isinstance(user_id, ObjectId) else ObjectId(user_id),
        "type": ntype,
        "title": title,
        "message": message,
        "link": link,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.notifications.insert_one(doc)
    doc["_id"] = res.inserted_id
    payload = serialize_doc(doc)
    await push_notification(str(doc["user_id"]), payload)
    return payload


# ===========================================================
# AUTH ROUTES
# ===========================================================
@api.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "role": payload.role,
        "avatar": "",
        "bio": "",
        "is_active": True,
        "is_verified": True,  # email verification mocked
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(user_doc)
    user_doc["_id"] = res.inserted_id
    user_out = serialize_user(user_doc)

    # Welcome email (async, no-op if Resend not configured)
    try:
        subj, html = welcome_email(payload.first_name)
        await send_email(email, subj, html)
    except Exception as e:
        logger.warning("welcome email failed: %s", e)

    access = create_access_token(user_out["id"], email, payload.role)
    refresh = create_refresh_token(user_out["id"])
    set_auth_cookies(response, access, refresh)
    return {"success": True, "data": user_out, "access_token": access}


def _as_utc(dt):
    """Make a datetime tz-aware (assume UTC if naive). Returns None for None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower()
    # Behind k8s/ingress, request.client.host is the pod IP and varies per request.
    # Prefer X-Forwarded-For (leftmost = originating client). For brute-force lockout
    # we fall back to email-only to ensure protection regardless of proxy setup.
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    identifier = email  # email-only ensures consistent counting across ingress hops

    # Lockout check
    attempt_record = await db.login_attempts.find_one({"identifier": identifier})
    if attempt_record and attempt_record.get("count", 0) >= MAX_FAILED_ATTEMPTS:
        locked_until = _as_utc(attempt_record.get("locked_until"))
        if locked_until and locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")

    # success → clear attempts
    await db.login_attempts.delete_one({"identifier": identifier})

    user_out = serialize_user(user)
    access = create_access_token(user_out["id"], email, user["role"])
    refresh = create_refresh_token(user_out["id"])
    set_auth_cookies(response, access, refresh)
    return {"success": True, "data": user_out, "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"success": True, "message": "Logged out"}


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_out = serialize_user(user)
        access = create_access_token(user_out["id"], user_out["email"], user_out["role"])
        new_refresh = create_refresh_token(user_out["id"])
        set_auth_cookies(response, access, new_refresh)
        return {"success": True, "access_token": access}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"success": True, "data": user}


@api.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: ForgotPasswordIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    # Always return success to avoid leaking emails
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "user_id": user["_id"],
            "token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
            "created_at": datetime.now(timezone.utc),
        })
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        reset_link = f"{frontend_url}/reset-password/{token}"
        logger.info(f"[MOCK EMAIL] Password reset link for {payload.email}: {reset_link}")
        try:
            subj, html = reset_password_email(reset_link)
            await send_email(payload.email, subj, html)
        except Exception as e:
            logger.warning("reset email failed: %s", e)
    return {"success": True, "message": "If that email exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    record = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    expires = _as_utc(record.get("expires_at"))
    if expires is None or expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one(
        {"_id": record["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    await db.password_reset_tokens.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    return {"success": True, "message": "Password updated"}


# ===========================================================
# CATEGORIES
# ===========================================================
@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({"is_active": True}).to_list(100)
    if not docs:
        return {"success": True, "data": []}
    # Aggregate published-course counts in a single query
    pipeline = [
        {"$match": {"status": "PUBLISHED"}},
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}},
    ]
    counts = {doc["_id"]: doc["count"] async for doc in db.courses.aggregate(pipeline)}
    out = []
    for c in docs:
        d = serialize_doc(c)
        d["course_count"] = counts.get(c["_id"], 0)
        out.append(d)
    return {"success": True, "data": out}


@api.post("/categories")
async def create_category(payload: CategoryIn, user=Depends(require_roles(["ADMIN"]))):
    doc = {
        "name": payload.name,
        "slug": payload.slug or slugify(payload.name),
        "description": payload.description,
        "icon": payload.icon,
        "color": payload.color,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.categories.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user=Depends(require_roles(["ADMIN"]))):
    await db.categories.delete_one({"_id": safe_object_id(cat_id)})
    return {"success": True}


# ===========================================================
# COURSES
# ===========================================================
async def _enrich_course(c: dict) -> dict:
    out = serialize_doc(c)
    ed = await db.users.find_one({"_id": c["educator_id"]}) if c.get("educator_id") else None
    if ed:
        out["educator"] = {
            "id": str(ed["_id"]),
            "first_name": ed.get("first_name", ""),
            "last_name": ed.get("last_name", ""),
            "avatar": ed.get("avatar", ""),
            "bio": ed.get("bio", ""),
        }
    if c.get("category_id"):
        cat = await db.categories.find_one({"_id": c["category_id"]})
        if cat:
            out["category"] = {"id": str(cat["_id"]), "name": cat["name"], "slug": cat["slug"], "color": cat.get("color")}
    return out


@api.get("/courses")
async def list_courses(
    category: Optional[str] = None,
    level: Optional[str] = None,
    is_free: Optional[bool] = None,
    search: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 12,
):
    query = {"status": "PUBLISHED"}
    if category:
        cat = await db.categories.find_one({"slug": category})
        if not cat and ObjectId.is_valid(category):
            cat = await db.categories.find_one({"_id": ObjectId(category)})
        if cat:
            query["category_id"] = cat["_id"]
    if level:
        query["level"] = level
    if is_free is not None:
        query["is_free"] = is_free
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"short_description": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]
    sort_map = {
        "newest": [("created_at", -1)],
        "popular": [("total_enrollments", -1)],
        "rating": [("average_rating", -1)],
        "price_asc": [("price", 1)],
        "price_desc": [("price", -1)],
    }
    sort_by = sort_map.get(sort, sort_map["newest"])
    total = await db.courses.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.courses.find(query).sort(sort_by).skip(skip).limit(limit)
    courses = []
    async for c in cursor:
        courses.append(await _enrich_course(c))
    return {
        "success": True,
        "data": courses,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
    }


@api.get("/courses/my-courses")
async def my_courses(user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    query = {} if user["role"] == "ADMIN" else {"educator_id": safe_object_id(user["id"])}
    cursor = db.courses.find(query).sort([("created_at", -1)])
    out = []
    async for c in cursor:
        out.append(await _enrich_course(c))
    return {"success": True, "data": out}


@api.get("/courses/{slug}")
async def get_course_by_slug(slug: str, user=Depends(get_optional_user)):
    course = await db.courses.find_one({"slug": slug})
    if not course and ObjectId.is_valid(slug):
        course = await db.courses.find_one({"_id": ObjectId(slug)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_out = await _enrich_course(course)

    # sections & lessons
    sections = []
    async for s in db.sections.find({"course_id": course["_id"]}).sort([("order", 1)]):
        section_out = serialize_doc(s)
        lessons = []
        async for l in db.lessons.find({"section_id": s["_id"]}).sort([("order", 1)]):
            lesson_out = serialize_doc(l)
            lessons.append(lesson_out)
        section_out["lessons"] = lessons
        sections.append(section_out)
    course_out["sections"] = sections

    # reviews — bulk fetch users to avoid N+1
    review_docs = await db.reviews.find({"course_id": course["_id"]}).sort([("created_at", -1)]).limit(20).to_list(20)
    reviews = []
    if review_docs:
        review_user_ids = list({r["user_id"] for r in review_docs})
        review_users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": review_user_ids}})}
        for r in review_docs:
            r_out = serialize_doc(r)
            u = review_users.get(r["user_id"])
            if u:
                r_out["user"] = {
                    "first_name": u.get("first_name"), "last_name": u.get("last_name"),
                    "avatar": u.get("avatar", ""),
                }
            reviews.append(r_out)
    course_out["reviews"] = reviews

    # enrollment status for current user
    course_out["is_enrolled"] = False
    if user:
        enr = await db.enrollments.find_one({"user_id": safe_object_id(user["id"]), "course_id": course["_id"]})
        if enr:
            course_out["is_enrolled"] = True
            course_out["enrollment"] = serialize_doc(enr)

    return {"success": True, "data": course_out}


@api.post("/courses")
async def create_course(payload: CourseIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    now = datetime.now(timezone.utc)
    slug = slugify(payload.title) + "-" + secrets.token_hex(3)
    doc = {
        "title": payload.title,
        "slug": slug,
        "short_description": payload.short_description,
        "description": payload.description,
        "thumbnail": payload.thumbnail or "https://images.unsplash.com/photo-1515879218367-8466d910aaa4",
        "preview_video_url": payload.preview_video_url,
        "price": payload.price,
        "is_free": payload.is_free,
        "level": payload.level,
        "language": payload.language,
        "status": "DRAFT",
        "educator_id": safe_object_id(user["id"]),
        "category_id": safe_object_id(payload.category_id) if payload.category_id else None,
        "tags": payload.tags,
        "requirements": payload.requirements,
        "outcomes": payload.outcomes,
        "estimated_duration": payload.estimated_duration,
        "total_enrollments": 0,
        "total_ratings": 0,
        "average_rating": 0,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.courses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": await _enrich_course(doc)}


@api.patch("/courses/{course_id}")
async def update_course(course_id: str, payload: CourseUpdate, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    oid = safe_object_id(course_id)
    course = await db.courses.find_one({"_id": oid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user["role"] != "ADMIN" and str(course["educator_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Not your course")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "category_id" in updates and updates["category_id"]:
        updates["category_id"] = safe_object_id(updates["category_id"])
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.courses.update_one({"_id": oid}, {"$set": updates})
    course = await db.courses.find_one({"_id": oid})
    return {"success": True, "data": await _enrich_course(course)}


@api.delete("/courses/{course_id}")
async def delete_course(course_id: str, user=Depends(require_roles(["ADMIN", "EDUCATOR"]))):
    oid = safe_object_id(course_id)
    course = await db.courses.find_one({"_id": oid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user["role"] != "ADMIN" and str(course["educator_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Not your course")
    await db.courses.delete_one({"_id": oid})
    await db.sections.delete_many({"course_id": oid})
    await db.lessons.delete_many({"course_id": oid})
    return {"success": True}


@api.patch("/courses/{course_id}/publish")
async def publish_course(course_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    oid = safe_object_id(course_id)
    course = await db.courses.find_one({"_id": oid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user["role"] != "ADMIN" and str(course["educator_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    new_status = "DRAFT" if course["status"] == "PUBLISHED" else "PUBLISHED"
    await db.courses.update_one({"_id": oid}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "data": {"status": new_status}}


# ===========================================================
# SECTIONS & LESSONS (nested under courses)
# ===========================================================
@api.post("/courses/{course_id}/sections")
async def create_section(course_id: str, payload: SectionIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    oid = safe_object_id(course_id)
    course = await db.courses.find_one({"_id": oid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user["role"] != "ADMIN" and str(course["educator_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        "course_id": oid,
        "title": payload.title,
        "description": payload.description,
        "order": payload.order,
        "is_published": True,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.sections.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/sections/{section_id}")
async def delete_section(section_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    oid = safe_object_id(section_id)
    await db.sections.delete_one({"_id": oid})
    await db.lessons.delete_many({"section_id": oid})
    return {"success": True}


@api.post("/sections/{section_id}/lessons")
async def create_lesson(section_id: str, payload: LessonIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    sid = safe_object_id(section_id)
    section = await db.sections.find_one({"_id": sid})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    doc = {
        "section_id": sid,
        "course_id": section["course_id"],
        "title": payload.title,
        "description": payload.description,
        "order": payload.order,
        "type": payload.type,
        "video_url": payload.video_url,
        "video_provider": payload.video_provider,
        "duration": payload.duration,
        "content": payload.content,
        "is_free": payload.is_free,
        "is_published": True,
        "resources": [],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.lessons.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    await db.lessons.delete_one({"_id": safe_object_id(lesson_id)})
    return {"success": True}


# ===========================================================
# ENROLLMENTS
# ===========================================================
@api.post("/enrollments")
async def enroll(body: dict, user=Depends(get_current_user)):
    course_id = body.get("course_id")
    if not course_id:
        raise HTTPException(status_code=400, detail="course_id required")
    oid = safe_object_id(course_id)
    course = await db.courses.find_one({"_id": oid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    user_oid = safe_object_id(user["id"])
    existing = await db.enrollments.find_one({"user_id": user_oid, "course_id": oid})
    if existing:
        return {"success": True, "data": serialize_doc(existing), "message": "Already enrolled"}
    doc = {
        "user_id": user_oid,
        "course_id": oid,
        "enrolled_at": datetime.now(timezone.utc),
        "status": "ACTIVE",
        "progress": 0.0,
        "last_accessed_at": datetime.now(timezone.utc),
        "completed_lesson_ids": [],
    }
    res = await db.enrollments.insert_one(doc)
    await db.courses.update_one({"_id": oid}, {"$inc": {"total_enrollments": 1}})
    doc["_id"] = res.inserted_id

    # Notification + email (live push via socket if connected)
    try:
        frontend_url = os.environ.get("FRONTEND_URL", "")
        course_url = f"{frontend_url}/learn/{course.get('slug', '')}"
        await create_notification(user_oid, "ENROLLMENT", f"Enrolled in {course['title']}", "You're all set — start learning anytime.", f"/learn/{course.get('slug', '')}")
        subj, html = enrollment_email(user.get("first_name", "there"), course["title"], course_url)
        await send_email(user["email"], subj, html)
    except Exception as e:
        logger.warning("enrollment side-effects failed: %s", e)

    return {"success": True, "data": serialize_doc(doc)}


@api.get("/enrollments/my")
async def my_enrollments(user=Depends(get_current_user)):
    user_oid = safe_object_id(user["id"])
    cursor = db.enrollments.find({"user_id": user_oid}).sort([("last_accessed_at", -1)])
    out = []
    async for e in cursor:
        course = await db.courses.find_one({"_id": e["course_id"]})
        if course:
            e_out = serialize_doc(e)
            e_out["course"] = await _enrich_course(course)
            out.append(e_out)
    return {"success": True, "data": out}


@api.patch("/enrollments/{enrollment_id}/progress")
async def update_progress(enrollment_id: str, payload: ProgressIn, user=Depends(get_current_user)):
    eid = safe_object_id(enrollment_id)
    enr = await db.enrollments.find_one({"_id": eid})
    if not enr or str(enr["user_id"]) != user["id"]:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    completed = list(enr.get("completed_lesson_ids", []))
    lid = safe_object_id(payload.lesson_id)
    if payload.is_completed and lid not in completed:
        completed.append(lid)
    elif not payload.is_completed and lid in completed:
        completed.remove(lid)
    total_lessons = await db.lessons.count_documents({"course_id": enr["course_id"]})
    progress = (len(completed) / total_lessons * 100) if total_lessons else 0
    status = "COMPLETED" if progress >= 100 else "ACTIVE"
    completed_at = datetime.now(timezone.utc) if status == "COMPLETED" else enr.get("completed_at")
    await db.enrollments.update_one(
        {"_id": eid},
        {"$set": {
            "completed_lesson_ids": completed,
            "progress": progress,
            "status": status,
            "completed_at": completed_at,
            "last_accessed_at": datetime.now(timezone.utc),
        }},
    )
    enr = await db.enrollments.find_one({"_id": eid})

    # Auto-issue certificate on completion
    if status == "COMPLETED":
        u = await db.users.find_one({"_id": enr["user_id"]})
        course = await db.courses.find_one({"_id": enr["course_id"]})
        if u and course:
            cert = await _ensure_certificate(enr, u, course)
            await create_notification(
                enr["user_id"], "CERTIFICATE",
                "Certificate earned!",
                f"You completed {course['title']}",
                "/dashboard/certificates",
            )
            try:
                frontend_url = os.environ.get("FRONTEND_URL", "")
                verify_url = f"{frontend_url}/certificate/verify?cert={cert.get('certificate_number','')}"
                subj, html = certificate_email(u.get("first_name", "there"), course["title"], cert.get("certificate_number", ""), verify_url)
                await send_email(u["email"], subj, html)
            except Exception as e:
                logger.warning("certificate email failed: %s", e)
    return {"success": True, "data": serialize_doc(enr)}


# ===========================================================
# REVIEWS
# ===========================================================
@api.post("/reviews")
async def create_review(payload: ReviewIn, user=Depends(get_current_user)):
    course_oid = safe_object_id(payload.course_id)
    user_oid = safe_object_id(user["id"])
    enr = await db.enrollments.find_one({"user_id": user_oid, "course_id": course_oid})
    if not enr:
        raise HTTPException(status_code=403, detail="You must be enrolled to review")
    existing = await db.reviews.find_one({"user_id": user_oid, "course_id": course_oid})
    now = datetime.now(timezone.utc)
    if existing:
        await db.reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": payload.rating, "comment": payload.comment, "updated_at": now}},
        )
        rev = await db.reviews.find_one({"_id": existing["_id"]})
    else:
        res = await db.reviews.insert_one({
            "course_id": course_oid,
            "user_id": user_oid,
            "rating": payload.rating,
            "comment": payload.comment,
            "is_published": True,
            "created_at": now,
        })
        rev = await db.reviews.find_one({"_id": res.inserted_id})
    # Recompute average
    cursor = db.reviews.find({"course_id": course_oid})
    ratings = [r["rating"] async for r in cursor]
    avg = sum(ratings) / len(ratings) if ratings else 0
    await db.courses.update_one(
        {"_id": course_oid},
        {"$set": {"average_rating": avg, "total_ratings": len(ratings)}},
    )
    return {"success": True, "data": serialize_doc(rev)}


# ===========================================================
# USERS / PROFILE
# ===========================================================
@api.get("/users/instructor/{user_id}")
async def get_instructor(user_id: str):
    oid = safe_object_id(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u or u.get("role") != "EDUCATOR":
        raise HTTPException(status_code=404, detail="Instructor not found")
    user_out = serialize_user(u)
    cursor = db.courses.find({"educator_id": oid, "status": "PUBLISHED"})
    courses = []
    async for c in cursor:
        courses.append(await _enrich_course(c))
    user_out["courses"] = courses
    return {"success": True, "data": user_out}


@api.patch("/users/me")
async def update_me(payload: ProfileUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.users.update_one({"_id": safe_object_id(user["id"])}, {"$set": updates})
    u = await db.users.find_one({"_id": safe_object_id(user["id"])})
    return {"success": True, "data": serialize_user(u)}


# ===========================================================
# ADMIN
# ===========================================================
@api.get("/admin/dashboard")
async def admin_dashboard(user=Depends(require_roles(["ADMIN"]))):
    total_users = await db.users.count_documents({})
    total_students = await db.users.count_documents({"role": "STUDENT"})
    total_educators = await db.users.count_documents({"role": "EDUCATOR"})
    total_courses = await db.courses.count_documents({})
    published_courses = await db.courses.count_documents({"status": "PUBLISHED"})
    total_enrollments = await db.enrollments.count_documents({})

    # Top courses
    top = []
    async for c in db.courses.find({"status": "PUBLISHED"}).sort([("total_enrollments", -1)]).limit(5):
        top.append(await _enrich_course(c))

    # User growth (last 6 months mock by buckets of created_at)
    return {
        "success": True,
        "data": {
            "total_users": total_users,
            "total_students": total_students,
            "total_educators": total_educators,
            "total_courses": total_courses,
            "published_courses": published_courses,
            "total_enrollments": total_enrollments,
            "revenue_estimate": total_enrollments * 25,
            "top_courses": top,
        },
    }


@api.get("/admin/users")
async def admin_users(
    user=Depends(require_roles(["ADMIN"])),
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, limit: int = 25,
):
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
        ]
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.users.find(query).sort([("created_at", -1)]).skip(skip).limit(limit)
    out = []
    async for u in cursor:
        out.append(serialize_user(u))
    return {"success": True, "data": out, "pagination": {"page": page, "limit": limit, "total": total}}


@api.patch("/admin/users/{user_id}/role")
async def admin_change_role(user_id: str, payload: UserRoleUpdate, user=Depends(require_roles(["ADMIN"]))):
    await db.users.update_one({"_id": safe_object_id(user_id)}, {"$set": {"role": payload.role}})
    u = await db.users.find_one({"_id": safe_object_id(user_id)})
    return {"success": True, "data": serialize_user(u)}


@api.patch("/admin/users/{user_id}/toggle-active")
async def admin_toggle_active(user_id: str, user=Depends(require_roles(["ADMIN"]))):
    u = await db.users.find_one({"_id": safe_object_id(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"is_active": not u.get("is_active", True)}})
    u = await db.users.find_one({"_id": u["_id"]})
    return {"success": True, "data": serialize_user(u)}


@api.get("/admin/courses")
async def admin_courses(
    user=Depends(require_roles(["ADMIN"])),
    status: Optional[str] = None,
    page: int = 1, limit: int = 25,
):
    query = {}
    if status:
        query["status"] = status
    total = await db.courses.count_documents(query)
    cursor = db.courses.find(query).sort([("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    out = []
    async for c in cursor:
        out.append(await _enrich_course(c))
    return {"success": True, "data": out, "pagination": {"page": page, "limit": limit, "total": total}}


# ===========================================================
# EDUCATOR ANALYTICS
# ===========================================================
@api.get("/educator/dashboard")
async def educator_dashboard(user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    educator_oid = safe_object_id(user["id"])
    query = {} if user["role"] == "ADMIN" else {"educator_id": educator_oid}
    total_courses = await db.courses.count_documents(query)
    published = await db.courses.count_documents({**query, "status": "PUBLISHED"})
    course_ids = [c["_id"] async for c in db.courses.find(query, {"_id": 1})]
    total_enr = await db.enrollments.count_documents({"course_id": {"$in": course_ids}}) if course_ids else 0
    completed_enr = await db.enrollments.count_documents({"course_id": {"$in": course_ids}, "status": "COMPLETED"}) if course_ids else 0
    top = []
    async for c in db.courses.find(query).sort([("total_enrollments", -1)]).limit(5):
        top.append(await _enrich_course(c))
    return {
        "success": True,
        "data": {
            "total_courses": total_courses,
            "published_courses": published,
            "total_enrollments": total_enr,
            "completed_enrollments": completed_enr,
            "estimated_earnings": total_enr * 20,
            "top_courses": top,
        },
    }


# ===========================================================
# QUIZZES
# ===========================================================
def _strip_answers(quiz: dict, hide: bool = True) -> dict:
    quiz = serialize_doc(quiz)
    if hide:
        for q in quiz.get("questions", []):
            for opt in q.get("options", []):
                opt.pop("is_correct", None)
            q.pop("explanation", None)
    return quiz


async def _user_owns_course(user, course_oid) -> bool:
    if user["role"] == "ADMIN":
        return True
    c = await db.courses.find_one({"_id": course_oid})
    return c is not None and str(c["educator_id"]) == user["id"]


@api.post("/quizzes")
async def create_quiz(payload: QuizIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    lesson_oid = safe_object_id(payload.lesson_id)
    lesson = await db.lessons.find_one({"_id": lesson_oid})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not await _user_owns_course(user, lesson["course_id"]):
        raise HTTPException(status_code=403, detail="Not your course")
    existing = await db.quizzes.find_one({"lesson_id": lesson_oid})
    questions = [q.model_dump() for q in payload.questions]
    doc = {
        "lesson_id": lesson_oid,
        "course_id": lesson["course_id"],
        "title": payload.title,
        "instructions": payload.instructions,
        "passing_score": payload.passing_score,
        "time_limit": payload.time_limit,
        "attempts_allowed": payload.attempts_allowed,
        "shuffle_questions": payload.shuffle_questions,
        "questions": questions,
        "updated_at": datetime.now(timezone.utc),
    }
    if existing:
        await db.quizzes.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
    else:
        doc["created_at"] = datetime.now(timezone.utc)
        res = await db.quizzes.insert_one(doc)
        doc["_id"] = res.inserted_id
    await db.lessons.update_one({"_id": lesson_oid}, {"$set": {"type": "QUIZ"}})
    return {"success": True, "data": _strip_answers(doc, hide=False)}


@api.get("/quizzes/lesson/{lesson_id}")
async def get_quiz_for_lesson(lesson_id: str, user=Depends(get_current_user)):
    lesson_oid = safe_object_id(lesson_id)
    quiz = await db.quizzes.find_one({"lesson_id": lesson_oid})
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz for this lesson")
    hide = user["role"] == "STUDENT"
    if user["role"] in ("EDUCATOR", "ADMIN") and await _user_owns_course(user, quiz["course_id"]):
        hide = False
    return {"success": True, "data": _strip_answers(quiz, hide=hide)}


@api.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, payload: QuizSubmitIn, user=Depends(get_current_user)):
    quiz_oid = safe_object_id(quiz_id)
    quiz = await db.quizzes.find_one({"_id": quiz_oid})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    total_points = 0
    earned = 0
    breakdown = []
    for idx, q in enumerate(quiz["questions"]):
        pts = q.get("points", 1)
        total_points += pts
        correct_indexes = sorted([i for i, o in enumerate(q.get("options", [])) if o.get("is_correct")])
        submitted = sorted(payload.answers.get(str(idx), []) or [])
        is_right = submitted == correct_indexes and len(submitted) > 0
        if is_right:
            earned += pts
        breakdown.append({
            "question_index": idx,
            "question_text": q.get("text"),
            "submitted": submitted,
            "correct": correct_indexes,
            "is_correct": is_right,
            "points": pts if is_right else 0,
            "max_points": pts,
            "explanation": q.get("explanation", ""),
            "options": [{"text": o.get("text")} for o in q.get("options", [])],
        })
    score_pct = (earned / total_points * 100) if total_points else 0
    is_passed = score_pct >= quiz.get("passing_score", 60)
    attempt_doc = {
        "quiz_id": quiz_oid,
        "user_id": safe_object_id(user["id"]),
        "course_id": quiz["course_id"],
        "lesson_id": quiz["lesson_id"],
        "score": score_pct,
        "earned_points": earned,
        "total_points": total_points,
        "is_passed": is_passed,
        "answers": payload.answers,
        "time_spent": payload.time_spent,
        "submitted_at": datetime.now(timezone.utc),
    }
    await db.quiz_attempts.insert_one(attempt_doc)
    return {
        "success": True,
        "data": {
            "score": score_pct, "earned_points": earned, "total_points": total_points,
            "is_passed": is_passed, "breakdown": breakdown,
        },
    }


@api.get("/quizzes/{quiz_id}/attempts")
async def my_quiz_attempts(quiz_id: str, user=Depends(get_current_user)):
    cursor = db.quiz_attempts.find({
        "quiz_id": safe_object_id(quiz_id),
        "user_id": safe_object_id(user["id"]),
    }).sort([("submitted_at", -1)])
    out = []
    async for a in cursor:
        out.append(serialize_doc(a))
    return {"success": True, "data": out}


# ===========================================================
# DISCUSSIONS
# ===========================================================
@api.get("/discussions")
async def list_discussions(course_id: Optional[str] = None, lesson_id: Optional[str] = None,
                            user=Depends(get_optional_user)):
    query = {"parent_id": None}
    if course_id:
        query["course_id"] = safe_object_id(course_id)
    if lesson_id:
        query["lesson_id"] = safe_object_id(lesson_id)
    cursor = db.discussions.find(query).sort([("is_pinned", -1), ("created_at", -1)]).limit(100)
    threads = []
    async for d in cursor:
        threads.append(d)
    if not threads:
        return {"success": True, "data": []}
    # Bulk fetch reply counts + authors to avoid N+1
    thread_ids = [t["_id"] for t in threads]
    user_ids = list({t["user_id"] for t in threads})
    reply_counts = {
        x["_id"]: x["count"]
        async for x in db.discussions.aggregate([
            {"$match": {"parent_id": {"$in": thread_ids}}},
            {"$group": {"_id": "$parent_id", "count": {"$sum": 1}}},
        ])
    }
    users_by_id = {}
    async for u in db.users.find({"_id": {"$in": user_ids}}):
        users_by_id[u["_id"]] = u
    out = []
    for d in threads:
        d_out = serialize_doc(d)
        d_out["reply_count"] = reply_counts.get(d["_id"], 0)
        u = users_by_id.get(d["user_id"])
        if u:
            d_out["author"] = {
                "id": str(u["_id"]),
                "first_name": u.get("first_name"), "last_name": u.get("last_name"),
                "avatar": u.get("avatar", ""), "role": u.get("role"),
            }
        out.append(d_out)
    return {"success": True, "data": out}


@api.get("/discussions/{thread_id}")
async def get_discussion_thread(thread_id: str):
    tid = safe_object_id(thread_id)
    thread = await db.discussions.find_one({"_id": tid})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    out = serialize_doc(thread)
    u = await db.users.find_one({"_id": thread["user_id"]})
    if u:
        out["author"] = {"first_name": u.get("first_name"), "last_name": u.get("last_name"),
                         "avatar": u.get("avatar", ""), "role": u.get("role")}
    replies = []
    async for r in db.discussions.find({"parent_id": tid}).sort([("created_at", 1)]):
        r_out = serialize_doc(r)
        ru = await db.users.find_one({"_id": r["user_id"]})
        if ru:
            r_out["author"] = {"first_name": ru.get("first_name"), "last_name": ru.get("last_name"),
                               "avatar": ru.get("avatar", ""), "role": ru.get("role")}
        replies.append(r_out)
    out["replies"] = replies
    return {"success": True, "data": out}


@api.post("/discussions")
async def create_discussion(payload: DiscussionIn, user=Depends(get_current_user)):
    doc = {
        "course_id": safe_object_id(payload.course_id),
        "lesson_id": safe_object_id(payload.lesson_id) if payload.lesson_id else None,
        "parent_id": safe_object_id(payload.parent_id) if payload.parent_id else None,
        "user_id": safe_object_id(user["id"]),
        "title": payload.title,
        "content": payload.content,
        "is_resolved": False, "is_pinned": False, "upvotes": 0, "upvoted_by": [],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.discussions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/discussions/{thread_id}")
async def delete_discussion(thread_id: str, user=Depends(get_current_user)):
    tid = safe_object_id(thread_id)
    d = await db.discussions.find_one({"_id": tid})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] != "ADMIN" and str(d["user_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.discussions.delete_many({"$or": [{"_id": tid}, {"parent_id": tid}]})
    return {"success": True}


@api.post("/discussions/{thread_id}/upvote")
async def upvote_discussion(thread_id: str, user=Depends(get_current_user)):
    tid = safe_object_id(thread_id)
    d = await db.discussions.find_one({"_id": tid})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    user_oid = safe_object_id(user["id"])
    upvoted = [ObjectId(u) if isinstance(u, str) else u for u in d.get("upvoted_by", [])]
    if user_oid in upvoted:
        upvoted.remove(user_oid)
    else:
        upvoted.append(user_oid)
    await db.discussions.update_one({"_id": tid}, {"$set": {"upvoted_by": upvoted, "upvotes": len(upvoted)}})
    return {"success": True, "data": {"upvotes": len(upvoted)}}


@api.patch("/discussions/{thread_id}/pin")
async def pin_discussion(thread_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    tid = safe_object_id(thread_id)
    d = await db.discussions.find_one({"_id": tid})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    await db.discussions.update_one({"_id": tid}, {"$set": {"is_pinned": not d.get("is_pinned", False)}})
    return {"success": True}


@api.patch("/discussions/{thread_id}/resolve")
async def resolve_discussion(thread_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    tid = safe_object_id(thread_id)
    d = await db.discussions.find_one({"_id": tid})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    await db.discussions.update_one({"_id": tid}, {"$set": {"is_resolved": not d.get("is_resolved", False)}})
    return {"success": True}


# ===========================================================
# ANNOUNCEMENTS
# ===========================================================
@api.get("/announcements")
async def list_announcements(course_id: Optional[str] = None):
    query = {"is_published": True}
    if course_id:
        query["$or"] = [{"course_id": safe_object_id(course_id)}, {"course_id": None}]
    cursor = db.announcements.find(query).sort([("created_at", -1)]).limit(50)
    out = []
    async for a in cursor:
        a_out = serialize_doc(a)
        if a.get("author_id"):
            u = await db.users.find_one({"_id": a["author_id"]})
            if u:
                a_out["author"] = {"first_name": u.get("first_name"), "last_name": u.get("last_name")}
        out.append(a_out)
    return {"success": True, "data": out}


@api.post("/announcements")
async def create_announcement(payload: AnnouncementIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    course_oid = safe_object_id(payload.course_id) if payload.course_id else None
    if course_oid and not await _user_owns_course(user, course_oid):
        raise HTTPException(status_code=403, detail="Not your course")
    if course_oid is None and user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Only admin can publish platform-wide")
    doc = {
        "course_id": course_oid,
        "author_id": safe_object_id(user["id"]),
        "title": payload.title,
        "content": payload.content,
        "is_published": True,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.announcements.insert_one(doc)
    doc["_id"] = res.inserted_id
    if course_oid:
        course = await db.courses.find_one({"_id": course_oid})
        slug = course.get("slug", "") if course else ""
        async for e in db.enrollments.find({"course_id": course_oid}, {"user_id": 1}):
            await create_notification(
                e["user_id"], "ANNOUNCEMENT",
                payload.title, payload.content[:140], f"/learn/{slug}",
            )
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    aid = safe_object_id(ann_id)
    a = await db.announcements.find_one({"_id": aid})
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] != "ADMIN" and str(a["author_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.announcements.delete_one({"_id": aid})
    return {"success": True}


# ===========================================================
# NOTIFICATIONS
# ===========================================================
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": safe_object_id(user["id"])}).sort([("created_at", -1)]).limit(50)
    out = []
    async for n in cursor:
        out.append(serialize_doc(n))
    unread = await db.notifications.count_documents({"user_id": safe_object_id(user["id"]), "is_read": False})
    return {"success": True, "data": out, "unread_count": unread}


@api.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": safe_object_id(notif_id), "user_id": safe_object_id(user["id"])},
        {"$set": {"is_read": True}},
    )
    return {"success": True}


@api.patch("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": safe_object_id(user["id"])},
        {"$set": {"is_read": True}},
    )
    return {"success": True}


# ===========================================================
# REVIEWS LIST
# ===========================================================
@api.get("/reviews/course/{course_id}")
async def list_course_reviews(course_id: str, page: int = 1, limit: int = 20):
    course_oid = safe_object_id(course_id) if ObjectId.is_valid(course_id) else None
    if not course_oid:
        c = await db.courses.find_one({"slug": course_id})
        if not c:
            return {"success": True, "data": []}
        course_oid = c["_id"]
    review_docs = await db.reviews.find({"course_id": course_oid}).sort([("created_at", -1)]).skip((page - 1) * limit).limit(limit).to_list(limit)
    if not review_docs:
        return {"success": True, "data": []}
    review_user_ids = list({r["user_id"] for r in review_docs})
    users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": review_user_ids}})}
    out = []
    for r in review_docs:
        r_out = serialize_doc(r)
        u = users.get(r["user_id"])
        if u:
            r_out["user"] = {"first_name": u.get("first_name"), "last_name": u.get("last_name"), "avatar": u.get("avatar", "")}
        out.append(r_out)
    return {"success": True, "data": out}


# ===========================================================
# CERTIFICATES (PDF)
# ===========================================================
def _generate_certificate_pdf(certificate_number: str, learner_name: str, course_title: str, issued_at: datetime) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    c.setFillColor(HexColor("#f8fafc"))
    c.rect(0, 0, width, height, stroke=0, fill=1)
    c.setStrokeColor(HexColor("#f59e0b"))
    c.setLineWidth(6)
    c.rect(30, 30, width - 60, height - 60, stroke=1, fill=0)
    c.setStrokeColor(HexColor("#1e40af"))
    c.setLineWidth(2)
    c.rect(45, 45, width - 90, height - 90, stroke=1, fill=0)

    c.setFillColor(HexColor("#1e40af"))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, height - 90, "LEARNHUB")
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(width / 2, height - 160, "Certificate of Completion")
    c.setFillColor(HexColor("#64748b"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 190, "This is to certify that")
    c.setFillColor(HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2, height - 245, learner_name)

    c.setStrokeColor(HexColor("#f59e0b"))
    c.setLineWidth(2)
    name_width = c.stringWidth(learner_name, "Helvetica-Bold", 36)
    c.line(width / 2 - name_width / 2 - 20, height - 255, width / 2 + name_width / 2 + 20, height - 255)

    c.setFillColor(HexColor("#64748b"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 285, "has successfully completed the course")
    c.setFillColor(HexColor("#1e40af"))
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 320, course_title)

    c.setFillColor(HexColor("#64748b"))
    c.setFont("Helvetica", 11)
    date_str = issued_at.strftime("%B %d, %Y")
    c.drawCentredString(width / 2 - 120, 95, f"Issued on  {date_str}")
    c.drawCentredString(width / 2 + 120, 95, f"Certificate ID  {certificate_number}")

    c.setStrokeColor(HexColor("#cbd5e1"))
    c.setLineWidth(1)
    c.line(width / 2 - 100, 130, width / 2 + 100, 130)
    c.setFont("Helvetica-Oblique", 10)
    c.drawCentredString(width / 2, 115, "LearnHub Platform · verify at /certificate/verify")

    c.showPage()
    c.save()
    return buf.getvalue()


async def _ensure_certificate(enrollment, user_doc, course_doc) -> dict:
    cert = await db.certificates.find_one({"enrollment_id": enrollment["_id"]})
    if cert:
        return cert
    cert_number = f"LH-{secrets.token_hex(4).upper()}"
    cert_doc = {
        "user_id": enrollment["user_id"],
        "course_id": enrollment["course_id"],
        "enrollment_id": enrollment["_id"],
        "certificate_number": cert_number,
        "issued_at": datetime.now(timezone.utc),
        "learner_name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip(),
        "course_title": course_doc.get("title", ""),
    }
    res = await db.certificates.insert_one(cert_doc)
    cert_doc["_id"] = res.inserted_id
    return cert_doc


@api.post("/certificates/generate/{enrollment_id}")
async def generate_certificate(enrollment_id: str, user=Depends(get_current_user)):
    eid = safe_object_id(enrollment_id)
    enr = await db.enrollments.find_one({"_id": eid})
    if not enr:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if str(enr["user_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Not your enrollment")
    if enr.get("progress", 0) < 100:
        raise HTTPException(status_code=400, detail="Course not yet completed")
    u = await db.users.find_one({"_id": enr["user_id"]})
    c = await db.courses.find_one({"_id": enr["course_id"]})
    cert = await _ensure_certificate(enr, u, c)
    return {"success": True, "data": serialize_doc(cert)}


@api.get("/certificates/my")
async def my_certificates(user=Depends(get_current_user)):
    cursor = db.certificates.find({"user_id": safe_object_id(user["id"])}).sort([("issued_at", -1)])
    out = []
    async for cert in cursor:
        c_out = serialize_doc(cert)
        course = await db.courses.find_one({"_id": cert["course_id"]})
        if course:
            c_out["course"] = {"id": str(course["_id"]), "title": course["title"], "slug": course["slug"], "thumbnail": course.get("thumbnail")}
        out.append(c_out)
    return {"success": True, "data": out}


@api.get("/certificates/verify/{cert_number}")
async def verify_certificate(cert_number: str):
    cert = await db.certificates.find_one({"certificate_number": cert_number})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    course = await db.courses.find_one({"_id": cert["course_id"]})
    u = await db.users.find_one({"_id": cert["user_id"]})
    issued = cert.get("issued_at")
    return {
        "success": True,
        "data": {
            "certificate_number": cert["certificate_number"],
            "issued_at": issued.isoformat() if isinstance(issued, datetime) else issued,
            "learner_name": cert.get("learner_name") or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
            "course_title": cert.get("course_title") or (course["title"] if course else ""),
            "course_slug": course["slug"] if course else None,
        },
    }


@api.get("/certificates/{cert_number}/download")
async def download_certificate(cert_number: str):
    from fastapi.responses import Response as FastResponse
    cert = await db.certificates.find_one({"certificate_number": cert_number})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    issued = cert.get("issued_at")
    if not isinstance(issued, datetime):
        issued = datetime.now(timezone.utc)
    pdf = _generate_certificate_pdf(
        cert["certificate_number"],
        cert.get("learner_name", ""),
        cert.get("course_title", ""),
        issued,
    )
    return FastResponse(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="certificate-{cert_number}.pdf"'},
    )


# ===========================================================
# ADMIN SETTINGS
# ===========================================================
@api.get("/admin/settings")
async def get_settings(user=Depends(require_roles(["ADMIN"]))):
    cursor = db.settings.find({}).sort([("group", 1), ("key", 1)])
    out = []
    async for s in cursor:
        out.append(serialize_doc(s))
    return {"success": True, "data": out}


@api.post("/admin/settings")
async def upsert_setting(payload: SettingIn, user=Depends(require_roles(["ADMIN"]))):
    existing = await db.settings.find_one({"key": payload.key})
    doc = {
        "key": payload.key, "value": payload.value, "group": payload.group,
        "description": payload.description, "updated_at": datetime.now(timezone.utc),
    }
    if existing:
        await db.settings.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
    else:
        doc["created_at"] = datetime.now(timezone.utc)
        res = await db.settings.insert_one(doc)
        doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}


@api.delete("/admin/settings/{key}")
async def delete_setting(key: str, user=Depends(require_roles(["ADMIN"]))):
    await db.settings.delete_one({"key": key})
    return {"success": True}


# ===========================================================
# ADMIN REPORTS
# ===========================================================
@api.get("/admin/reports/overview")
async def admin_reports(user=Depends(require_roles(["ADMIN"]))):
    course_stats = []
    async for c in db.courses.find({"status": "PUBLISHED"}).sort([("total_enrollments", -1)]).limit(20):
        completed = await db.enrollments.count_documents({"course_id": c["_id"], "status": "COMPLETED"})
        course_stats.append({
            "id": str(c["_id"]),
            "title": c["title"],
            "enrollments": c.get("total_enrollments", 0),
            "completed": completed,
            "rating": c.get("average_rating", 0),
            "revenue_estimate": (c.get("total_enrollments", 0)) * (c.get("price", 0) if not c.get("is_free") else 0),
        })
    return {"success": True, "data": {"courses": course_stats}}


# ===========================================================
# EDUCATOR EARNINGS
# ===========================================================
@api.get("/educator/earnings")
async def educator_earnings(user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    educator_oid = safe_object_id(user["id"])
    query = {} if user["role"] == "ADMIN" else {"educator_id": educator_oid}
    transactions = []
    total = 0
    async for c in db.courses.find(query):
        if c.get("is_free"):
            continue
        course_enr = await db.enrollments.count_documents({"course_id": c["_id"]})
        gross = course_enr * float(c.get("price", 0))
        total += gross
        if course_enr > 0:
            transactions.append({
                "course_id": str(c["_id"]),
                "course_title": c["title"],
                "thumbnail": c.get("thumbnail"),
                "enrollments": course_enr,
                "price": c.get("price", 0),
                "gross_revenue": gross,
                "net_revenue": gross * 0.7,
            })
    transactions.sort(key=lambda t: t["gross_revenue"], reverse=True)
    return {
        "success": True,
        "data": {
            "total_gross": total, "total_net": total * 0.7,
            "platform_fee_pct": 30, "transactions": transactions,
        },
    }


# ===========================================================
# PUBLIC INSTRUCTORS LIST
# ===========================================================
@api.get("/instructors")
async def list_instructors():
    cursor = db.users.find({"role": "EDUCATOR", "is_active": True})
    out = []
    async for u in cursor:
        u_out = serialize_user(u)
        u_out["course_count"] = await db.courses.count_documents({"educator_id": u["_id"], "status": "PUBLISHED"})
        out.append(u_out)
    return {"success": True, "data": out}


# ===========================================================
# ASSIGNMENTS
# ===========================================================
@api.post("/assignments")
async def create_assignment(payload: AssignmentIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    lesson_oid = safe_object_id(payload.lesson_id)
    lesson = await db.lessons.find_one({"_id": lesson_oid})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not await _user_owns_course(user, lesson["course_id"]):
        raise HTTPException(status_code=403, detail="Not your course")
    existing = await db.assignments.find_one({"lesson_id": lesson_oid})
    due = None
    if payload.due_date:
        try:
            due = datetime.fromisoformat(payload.due_date.replace("Z", "+00:00"))
        except Exception:
            pass
    doc = {
        "lesson_id": lesson_oid,
        "course_id": lesson["course_id"],
        "title": payload.title,
        "instructions": payload.instructions,
        "due_date": due,
        "max_score": payload.max_score,
        "allowed_file_types": payload.allowed_file_types,
        "max_file_size_mb": payload.max_file_size_mb,
        "updated_at": datetime.now(timezone.utc),
    }
    if existing:
        await db.assignments.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
    else:
        doc["created_at"] = datetime.now(timezone.utc)
        res = await db.assignments.insert_one(doc)
        doc["_id"] = res.inserted_id
    await db.lessons.update_one({"_id": lesson_oid}, {"$set": {"type": "ASSIGNMENT"}})
    return {"success": True, "data": serialize_doc(doc)}


@api.get("/assignments/lesson/{lesson_id}")
async def get_assignment_for_lesson(lesson_id: str, user=Depends(get_current_user)):
    a = await db.assignments.find_one({"lesson_id": safe_object_id(lesson_id)})
    if not a:
        raise HTTPException(status_code=404, detail="No assignment for this lesson")
    out = serialize_doc(a)
    sub = await db.assignment_submissions.find_one({
        "assignment_id": a["_id"],
        "user_id": safe_object_id(user["id"]),
    })
    out["my_submission"] = serialize_doc(sub) if sub else None
    return {"success": True, "data": out}


@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    # Validate filename + extension
    name = file.filename or "upload"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
    allowed = {"pdf", "doc", "docx", "txt", "md", "png", "jpg", "jpeg", "gif", "webp", "zip", "csv", "json", "py", "js", "ts", "html", "css", "mp3", "wav"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type .{ext} is not allowed")

    # Read with size cap (avoid OOM)
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit")

    # Validate declared content-type isn't suspicious
    ctype = (file.content_type or "application/octet-stream").lower()
    if "html" in ctype or "javascript" in ctype or "script" in ctype:
        raise HTTPException(status_code=400, detail="Disallowed content type")

    path = make_path(user["id"], ext)
    try:
        put_object(path, contents, ctype)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    return {"success": True, "data": {
        "path": path,
        "url": f"/api/files/{path}",
        "name": name,
        "size": len(contents),
        "content_type": ctype,
    }}


@api.get("/files/{full_path:path}")
async def download_object(full_path: str, user=Depends(get_current_user)):
    """Auth-gated file download.

    Permissions: owner of the uploaded path OR an ADMIN OR an EDUCATOR whose
    course contains a submission referencing this path. This protects
    private assignment submissions from being scraped via URL guessing.
    """
    # Path format is "{APP_NAME}/uploads/{owner_id}/{uuid}.ext"
    is_admin = user.get("role") == "ADMIN"
    parts = full_path.split("/")
    owner_id = parts[2] if len(parts) >= 4 and parts[1] == "uploads" else None
    is_owner = owner_id == user["id"]
    is_authorized = is_admin or is_owner

    if not is_authorized and user.get("role") == "EDUCATOR":
        # Allow educator if any submission referencing this file is in their course
        sub = await db.assignment_submissions.find_one({
            "file_urls": {"$elemMatch": {"path": full_path}},
        })
        if sub and await _user_owns_course(user, sub["course_id"]):
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Forbidden")

    from fastapi.responses import Response as FastResponse
    try:
        data, ctype = get_object(full_path)
        return FastResponse(content=data, media_type=ctype)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@api.post("/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, body: dict, user=Depends(get_current_user)):
    aid = safe_object_id(assignment_id)
    a = await db.assignments.find_one({"_id": aid})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    enr = await db.enrollments.find_one({"user_id": safe_object_id(user["id"]), "course_id": a["course_id"]})
    if not enr:
        raise HTTPException(status_code=403, detail="You must be enrolled")
    sub_doc = {
        "assignment_id": aid,
        "user_id": safe_object_id(user["id"]),
        "enrollment_id": enr["_id"],
        "course_id": a["course_id"],
        "lesson_id": a["lesson_id"],
        "text_content": body.get("text_content", ""),
        "file_urls": body.get("file_urls", []),
        "status": "SUBMITTED",
        "submitted_at": datetime.now(timezone.utc),
    }
    existing = await db.assignment_submissions.find_one({"assignment_id": aid, "user_id": sub_doc["user_id"]})
    if existing:
        await db.assignment_submissions.update_one({"_id": existing["_id"]}, {"$set": sub_doc})
        sub_doc["_id"] = existing["_id"]
    else:
        res = await db.assignment_submissions.insert_one(sub_doc)
        sub_doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(sub_doc)}


@api.get("/assignments/{assignment_id}/submissions")
async def list_assignment_submissions(assignment_id: str, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    aid = safe_object_id(assignment_id)
    a = await db.assignments.find_one({"_id": aid})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not await _user_owns_course(user, a["course_id"]):
        raise HTTPException(status_code=403, detail="Not your course")
    cursor = db.assignment_submissions.find({"assignment_id": aid}).sort([("submitted_at", -1)])
    out = []
    async for s in cursor:
        s_out = serialize_doc(s)
        u = await db.users.find_one({"_id": s["user_id"]})
        if u:
            s_out["user"] = {"id": str(u["_id"]), "first_name": u.get("first_name"), "last_name": u.get("last_name"),
                             "email": u.get("email"), "avatar": u.get("avatar", "")}
        out.append(s_out)
    return {"success": True, "data": out}


@api.patch("/assignments/submissions/{submission_id}/grade")
async def grade_submission(submission_id: str, payload: GradeIn, user=Depends(require_roles(["EDUCATOR", "ADMIN"]))):
    sid = safe_object_id(submission_id)
    sub = await db.assignment_submissions.find_one({"_id": sid})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not await _user_owns_course(user, sub["course_id"]):
        raise HTTPException(status_code=403, detail="Not your course")
    a = await db.assignments.find_one({"_id": sub["assignment_id"]})
    max_score = (a or {}).get("max_score", 100)
    score = max(0, min(payload.score, max_score))
    await db.assignment_submissions.update_one(
        {"_id": sid},
        {"$set": {
            "score": score, "feedback": payload.feedback or "",
            "status": "GRADED",
            "graded_at": datetime.now(timezone.utc),
            "graded_by": safe_object_id(user["id"]),
        }},
    )
    course = await db.courses.find_one({"_id": sub["course_id"]})
    slug = course.get("slug", "") if course else ""
    await create_notification(
        sub["user_id"], "GRADE",
        f"Assignment graded: {a.get('title', '')}",
        f"You scored {score} / {max_score}",
        f"/learn/{slug}",
    )
    new_sub = await db.assignment_submissions.find_one({"_id": sid})
    return {"success": True, "data": serialize_doc(new_sub)}





@api.get("/")
async def root():
    return {"success": True, "message": "LearnHub LMS API", "version": "1.0.0"}


@api.get("/health")
async def health_check():
    """Health endpoint with DB ping for load balancers and uptime monitors."""
    try:
        await db.command("ping")
        db_ok = True
    except Exception as e:
        db_ok = False
        logger.warning("health: db ping failed: %s", e)
    return {
        "success": True,
        "status": "healthy" if db_ok else "degraded",
        "db": "up" if db_ok else "down",
        "version": "1.0.0",
    }


app.include_router(api)

# ---------- CORS ----------
_cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_raw == "*" or _cors_raw == "":
    # Permissive wildcard mode — allow any origin via regex, but per CORS spec
    # browsers reject credentials with "*". The frontend uses both cookies AND
    # localStorage Bearer tokens, so disabling credentials is acceptable: Bearer
    # tokens still authenticate every request.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ---------- STARTUP ----------
@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.courses.create_index("slug", unique=True)
    await db.courses.create_index([("status", 1), ("created_at", -1)])
    await db.sections.create_index("course_id")
    await db.lessons.create_index("section_id")
    await db.lessons.create_index("course_id")
    await db.enrollments.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    await db.reviews.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    await db.certificates.create_index("certificate_number", unique=True)
    await db.certificates.create_index("enrollment_id", unique=True)
    await db.quizzes.create_index("lesson_id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.discussions.create_index([("course_id", 1), ("created_at", -1)])
    await db.settings.create_index("key", unique=True)
    await db.assignments.create_index("lesson_id", unique=True)
    await db.assignment_submissions.create_index([("assignment_id", 1), ("user_id", 1)], unique=True)

    from seed import seed_database, write_test_credentials
    await seed_database(db)
    await write_test_credentials()

    # Init object storage (no-op if EMERGENT_LLM_KEY missing)
    try:
        init_storage()
    except Exception as e:
        logger.warning("storage init: %s", e)

    logger.info("LMS startup complete — database seeded")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------- Mount Socket.IO over the FastAPI ASGI app ----------
# Wrap our FastAPI app inside socket.io's ASGI app so the same uvicorn process
# serves both REST endpoints AND websockets at /socket.io. Supervisor imports
# `server:app`, so we re-bind `app` to the combined ASGI app at the end.
_fastapi_app = app
app = socketio.ASGIApp(sio, other_asgi_app=_fastapi_app, socketio_path="socket.io")
