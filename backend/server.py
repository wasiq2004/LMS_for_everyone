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

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
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
from models import (
    RegisterIn, LoginIn, ForgotPasswordIn, ResetPasswordIn,
    CategoryIn, CourseIn, CourseUpdate,
    SectionIn, LessonIn, ProgressIn, ReviewIn,
    UserRoleUpdate, ProfileUpdate,
)

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- APP ----------
app = FastAPI(title="LearnHub LMS API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("lms")


# ===========================================================
# AUTH ROUTES
# ===========================================================
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
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
async def forgot_password(payload: ForgotPasswordIn):
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
    # Add course counts
    out = []
    for c in docs:
        count = await db.courses.count_documents({"category_id": c["_id"], "status": "PUBLISHED"})
        d = serialize_doc(c)
        d["course_count"] = count
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

    # reviews
    reviews = []
    async for r in db.reviews.find({"course_id": course["_id"]}).sort([("created_at", -1)]).limit(20):
        r_out = serialize_doc(r)
        u = await db.users.find_one({"_id": r["user_id"]})
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

    # enrollments where course belongs to this educator
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


app.include_router(api)

# ---------- CORS ----------
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:3000"]
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

    from seed import seed_database, write_test_credentials
    await seed_database(db)
    await write_test_credentials()
    logger.info("LMS startup complete — database seeded")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"success": True, "message": "LearnHub LMS API"}
