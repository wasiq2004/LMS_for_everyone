"""Seed initial data: admin, educators, students, categories, courses."""
import os
from datetime import datetime, timezone
from bson import ObjectId

from auth import hash_password
from db_utils import slugify


CATEGORIES = [
    {"name": "Web Development", "icon": "code", "color": "#1e40af",
     "thumb": "https://images.unsplash.com/photo-1515879218367-8466d910aaa4"},
    {"name": "Data Science", "icon": "bar-chart-3", "color": "#0ea5e9",
     "thumb": "https://images.unsplash.com/photo-1551288049-bebda4e38f71"},
    {"name": "Design", "icon": "palette", "color": "#f59e0b",
     "thumb": "https://images.pexels.com/photos/2324808/pexels-photo-2324808.jpeg"},
    {"name": "Business", "icon": "briefcase", "color": "#10b981",
     "thumb": "https://static.prod-images.emergentagent.com/jobs/eae26e5d-b97e-437c-99fd-58debe5155a0/images/79ba574302868ce6036daad6374014553ee7029e90f2f5729f0c85c1ff53dfd6.png"},
    {"name": "Marketing", "icon": "megaphone", "color": "#ef4444",
     "thumb": "https://static.prod-images.emergentagent.com/jobs/eae26e5d-b97e-437c-99fd-58debe5155a0/images/b6c84f243765d17b4a68be1328d9fae238c8e57af475bbd778103bd5e47f54da.png"},
]

SAMPLE_COURSES = [
    {
        "title": "Modern React from the Ground Up",
        "short": "Build production-ready React apps with hooks, context, and React Router v6.",
        "description": "A practical course covering React fundamentals, hooks, state management with context, routing, performance optimization, and deployment. Includes 3 hands-on projects.",
        "category": "Web Development",
        "level": "INTERMEDIATE",
        "price": 0, "is_free": True,
        "tags": ["react", "javascript", "frontend"],
        "outcomes": ["Master modern React patterns", "Build SPAs with React Router", "Manage state without Redux", "Deploy production apps"],
        "requirements": ["Basic JavaScript", "HTML & CSS fundamentals"],
        "preview": "https://www.youtube.com/embed/Tn6-PIqc4UM",
    },
    {
        "title": "Python for Data Science Bootcamp",
        "short": "From zero to hero: NumPy, Pandas, Matplotlib, and your first ML model.",
        "description": "Learn data analysis with Python from scratch. Hands-on labs with real datasets, building visualizations, and training your first machine learning model.",
        "category": "Data Science",
        "level": "BEGINNER",
        "price": 49.99, "is_free": False,
        "tags": ["python", "pandas", "ml"],
        "outcomes": ["Analyze data with Pandas", "Build visualizations", "Train ML models", "Tell stories with data"],
        "requirements": ["Curiosity!"],
        "preview": "https://www.youtube.com/embed/LHBE6Q9XlzI",
    },
    {
        "title": "UI/UX Design Fundamentals",
        "short": "Design beautiful, user-centered interfaces using Figma.",
        "description": "Master the principles of UI/UX design: typography, color theory, layout, wireframing, prototyping in Figma, and user testing.",
        "category": "Design",
        "level": "BEGINNER",
        "price": 39.99, "is_free": False,
        "tags": ["figma", "ux", "design"],
        "outcomes": ["Design pixel-perfect UIs", "Prototype in Figma", "Run usability tests"],
        "requirements": ["No prior experience needed"],
        "preview": "https://www.youtube.com/embed/c9Wg6Cb_YlU",
    },
    {
        "title": "Startup Founder Playbook",
        "short": "Validate, build, and grow your startup from idea to product-market fit.",
        "description": "A no-fluff guide to building a startup: customer discovery, MVP development, growth marketing, fundraising, and team building.",
        "category": "Business",
        "level": "ALL_LEVELS",
        "price": 79.99, "is_free": False,
        "tags": ["startup", "business", "growth"],
        "outcomes": ["Validate ideas quickly", "Build an MVP", "Raise a seed round"],
        "requirements": ["A startup idea (or curiosity)"],
        "preview": "https://www.youtube.com/embed/ZoqgAy3h4OM",
    },
    {
        "title": "Digital Marketing Masterclass",
        "short": "SEO, ads, content, and email — the complete growth marketer's toolkit.",
        "description": "Comprehensive marketing course covering SEO, paid ads (Google, Meta), content marketing, email funnels, and analytics.",
        "category": "Marketing",
        "level": "INTERMEDIATE",
        "price": 0, "is_free": True,
        "tags": ["seo", "ads", "growth"],
        "outcomes": ["Run paid ad campaigns", "Master SEO basics", "Build email funnels"],
        "requirements": ["Basic computer skills"],
        "preview": "https://www.youtube.com/embed/bixR-KIJKYM",
    },
    {
        "title": "Advanced TypeScript Patterns",
        "short": "Master conditional types, generics, and type-level programming.",
        "description": "Deep dive into TypeScript: generics, conditional types, mapped types, decorators, and real-world patterns.",
        "category": "Web Development",
        "level": "ADVANCED",
        "price": 59.99, "is_free": False,
        "tags": ["typescript", "advanced"],
        "outcomes": ["Master generics", "Write type-safe APIs", "Build type-level utilities"],
        "requirements": ["Solid JavaScript & TypeScript basics"],
        "preview": "https://www.youtube.com/embed/30LWjhZzg50",
    },
    {
        "title": "Machine Learning with PyTorch",
        "short": "Build neural networks from scratch with PyTorch.",
        "description": "Hands-on machine learning course using PyTorch. Build neural networks, CNNs, and transformers from scratch.",
        "category": "Data Science",
        "level": "ADVANCED",
        "price": 89.99, "is_free": False,
        "tags": ["pytorch", "ml", "deeplearning"],
        "outcomes": ["Build neural networks", "Train CNNs and transformers", "Deploy ML models"],
        "requirements": ["Python fundamentals", "Basic linear algebra"],
        "preview": "https://www.youtube.com/embed/V_xro1bcAuA",
    },
    {
        "title": "Brand Identity Design",
        "short": "Create memorable brand identities from concept to logo system.",
        "description": "Learn the full brand identity process: research, concept, logo design, color systems, typography, and brand guidelines.",
        "category": "Design",
        "level": "INTERMEDIATE",
        "price": 0, "is_free": True,
        "tags": ["branding", "logo", "identity"],
        "outcomes": ["Design brand identities", "Create logo systems", "Build brand guidelines"],
        "requirements": ["Basic design tool familiarity"],
        "preview": "https://www.youtube.com/embed/uZN2WuTJfwo",
    },
]

EDUCATORS = [
    {"email": "sarah.chen@lms.com", "first": "Sarah", "last": "Chen",
     "bio": "Senior React engineer @ Spotify. 10+ years building production apps.",
     "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330"},
    {"email": "marcus.lee@lms.com", "first": "Marcus", "last": "Lee",
     "bio": "Data scientist & Kaggle Grandmaster. Teaching ML for 8 years.",
     "avatar": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e"},
    {"email": "ana.silva@lms.com", "first": "Ana", "last": "Silva",
     "bio": "Brand designer. Worked with Airbnb, Stripe, and 30+ startups.",
     "avatar": "https://images.pexels.com/photos/12311567/pexels-photo-12311567.jpeg"},
]

STUDENTS = [
    ("alex.kim@example.com", "Alex", "Kim"),
    ("priya.patel@example.com", "Priya", "Patel"),
    ("john.doe@example.com", "John", "Doe"),
    ("maria.garcia@example.com", "Maria", "Garcia"),
    ("liam.wong@example.com", "Liam", "Wong"),
]


async def seed_database(db) -> None:
    now = datetime.now(timezone.utc)

    # ---- Admin ----
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@lms.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "first_name": "Platform",
            "last_name": "Admin",
            "role": "ADMIN",
            "avatar": "",
            "bio": "Platform administrator",
            "is_active": True,
            "is_verified": True,
            "created_at": now,
        })

    # ---- Educators ----
    educator_ids = {}
    for ed in EDUCATORS:
        existing = await db.users.find_one({"email": ed["email"]})
        if existing is None:
            res = await db.users.insert_one({
                "email": ed["email"],
                "password_hash": hash_password("Educator@123"),
                "first_name": ed["first"],
                "last_name": ed["last"],
                "role": "EDUCATOR",
                "avatar": ed["avatar"],
                "bio": ed["bio"],
                "is_active": True,
                "is_verified": True,
                "created_at": now,
            })
            educator_ids[ed["email"]] = res.inserted_id
        else:
            educator_ids[ed["email"]] = existing["_id"]

    # ---- Students ----
    student_ids = []
    for email, first, last in STUDENTS:
        existing = await db.users.find_one({"email": email})
        if existing is None:
            res = await db.users.insert_one({
                "email": email,
                "password_hash": hash_password("Student@123"),
                "first_name": first,
                "last_name": last,
                "role": "STUDENT",
                "avatar": "",
                "bio": "",
                "is_active": True,
                "is_verified": True,
                "created_at": now,
            })
            student_ids.append(res.inserted_id)
        else:
            student_ids.append(existing["_id"])

    # ---- Categories ----
    cat_ids = {}
    for c in CATEGORIES:
        existing = await db.categories.find_one({"name": c["name"]})
        if existing is None:
            res = await db.categories.insert_one({
                "name": c["name"],
                "slug": slugify(c["name"]),
                "description": f"Explore courses in {c['name']}",
                "icon": c["icon"],
                "color": c["color"],
                "thumbnail": c["thumb"],
                "is_active": True,
                "created_at": now,
            })
            cat_ids[c["name"]] = res.inserted_id
        else:
            cat_ids[c["name"]] = existing["_id"]

    # ---- Courses (only if none exist) ----
    course_count = await db.courses.count_documents({})
    if course_count > 0:
        return

    educator_list = list(educator_ids.values())
    cat_thumb_map = {c["name"]: c["thumb"] for c in CATEGORIES}

    for idx, c in enumerate(SAMPLE_COURSES):
        ed_id = educator_list[idx % len(educator_list)]
        cat_id = cat_ids[c["category"]]
        slug = slugify(c["title"])
        thumbnail = cat_thumb_map[c["category"]]

        course_doc = {
            "title": c["title"],
            "slug": slug,
            "short_description": c["short"],
            "description": c["description"],
            "thumbnail": thumbnail,
            "preview_video_url": c["preview"],
            "price": c["price"],
            "is_free": c["is_free"],
            "level": c["level"],
            "language": "English",
            "status": "PUBLISHED",
            "educator_id": ed_id,
            "category_id": cat_id,
            "tags": c["tags"],
            "requirements": c["requirements"],
            "outcomes": c["outcomes"],
            "estimated_duration": 360,
            "total_enrollments": 0,
            "total_ratings": 0,
            "average_rating": 4.5 + (idx % 5) * 0.1,
            "created_at": now,
            "updated_at": now,
        }
        course_res = await db.courses.insert_one(course_doc)
        course_id = course_res.inserted_id

        # ---- Sections and lessons ----
        for s_idx, section_title in enumerate(["Introduction", "Core Concepts", "Hands-On Project"]):
            sec_res = await db.sections.insert_one({
                "course_id": course_id,
                "title": section_title,
                "description": f"{section_title} for {c['title']}",
                "order": s_idx,
                "is_published": True,
                "created_at": now,
            })
            for l_idx in range(3):
                await db.lessons.insert_one({
                    "section_id": sec_res.inserted_id,
                    "course_id": course_id,
                    "title": f"{section_title}: Lesson {l_idx + 1}",
                    "description": "Lesson content overview.",
                    "order": l_idx,
                    "type": "VIDEO",
                    "video_url": c["preview"],
                    "video_provider": "YOUTUBE",
                    "duration": 12,
                    "content": "Welcome to this lesson. Watch the video and complete the tasks.",
                    "is_free": s_idx == 0 and l_idx == 0,
                    "is_published": True,
                    "resources": [],
                    "created_at": now,
                })

        # ---- Enrollments for first 3 students ----
        for st_id in student_ids[:3]:
            await db.enrollments.insert_one({
                "user_id": st_id,
                "course_id": course_id,
                "enrolled_at": now,
                "status": "ACTIVE",
                "progress": float((idx * 13) % 100),
                "last_accessed_at": now,
                "completed_lesson_ids": [],
            })

        await db.courses.update_one(
            {"_id": course_id},
            {"$set": {"total_enrollments": 3}},
        )

        # ---- A couple of reviews ----
        for r_idx, st_id in enumerate(student_ids[:2]):
            await db.reviews.insert_one({
                "course_id": course_id,
                "user_id": st_id,
                "rating": 5 - r_idx,
                "comment": ["Amazing course, highly recommend!", "Great content, very practical."][r_idx],
                "is_published": True,
                "created_at": now,
            })


async def write_test_credentials():
    """Write credentials for testing agent."""
    content = """# Test Credentials

## Admin
- Email: admin@lms.com
- Password: Admin@123
- Role: ADMIN

## Educators (password: Educator@123)
- sarah.chen@lms.com — Sarah Chen
- marcus.lee@lms.com — Marcus Lee
- ana.silva@lms.com — Ana Silva

## Students (password: Student@123)
- alex.kim@example.com — Alex Kim
- priya.patel@example.com — Priya Patel
- john.doe@example.com — John Doe
- maria.garcia@example.com — Maria Garcia
- liam.wong@example.com — Liam Wong

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET  /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
"""
    import os
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(content)
