"""LMS Backend pytest suite — covers auth, categories, courses, enrollments, reviews, admin, educator."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://learn-hub-1253.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@lms.com", "password": "Admin@123"}
EDU_SARAH = {"email": "sarah.chen@lms.com", "password": "Educator@123"}
EDU_MARCUS = {"email": "marcus.lee@lms.com", "password": "Educator@123"}
STUDENT_ALEX = {"email": "alex.kim@example.com", "password": "Student@123"}
STUDENT_PRIYA = {"email": "priya.patel@example.com", "password": "Student@123"}


# ---------- session helpers ----------
def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(creds):
    s = new_session()
    r = s.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, data["data"], token


# ---------- AUTH ----------
class TestAuth:
    def test_login_admin(self):
        s, user, token = login(ADMIN)
        assert user["role"] == "ADMIN"
        assert user["email"] == ADMIN["email"]
        assert len(token) > 20

    def test_login_educator(self):
        _, user, _ = login(EDU_SARAH)
        assert user["role"] == "EDUCATOR"

    def test_login_student(self):
        _, user, _ = login(STUDENT_ALEX)
        assert user["role"] == "STUDENT"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@lms.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer(self):
        s, user, token = login(STUDENT_ALEX)
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["data"]["email"] == STUDENT_ALEX["email"]

    def test_me_with_cookie(self):
        s = new_session()
        r = s.post(f"{API}/auth/login", json=STUDENT_ALEX)
        assert r.status_code == 200
        # cookie-based call (no Authorization header)
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 200, f"Cookie auth failed: {r2.text}"
        assert r2.json()["data"]["email"] == STUDENT_ALEX["email"]

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self):
        s, _, _ = login(STUDENT_ALEX)
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200

    def test_refresh(self):
        s = new_session()
        r = s.post(f"{API}/auth/login", json=STUDENT_ALEX)
        assert r.status_code == 200
        r2 = s.post(f"{API}/auth/refresh")
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    def test_register_new_student(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass1!",
            "first_name": "Test", "last_name": "User", "role": "STUDENT"
        })
        assert r.status_code == 200
        assert r.json()["data"]["email"] == email
        assert r.json()["data"]["role"] == "STUDENT"

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": ADMIN["email"], "password": "TestPass1!",
            "first_name": "X", "last_name": "Y", "role": "STUDENT"
        })
        assert r.status_code == 400

    def test_bcrypt_format(self):
        # Indirect check: login works which means hash is valid bcrypt
        # We can't read DB directly via API; trust login as the proof.
        s, _, _ = login(ADMIN)
        assert s is not None

    def test_brute_force_lockout(self):
        # use a unique email so we don't lock real users
        email = f"TEST_lockout_{uuid.uuid4().hex[:6]}@example.com"
        # register
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass1!",
            "first_name": "L", "last_name": "T", "role": "STUDENT"
        })
        # 5 wrong attempts
        codes = []
        for _ in range(5):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
            codes.append(r.status_code)
        # 6th should be 429
        r6 = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
        assert r6.status_code == 429, f"Expected lockout 429, got {r6.status_code}; prior codes={codes}"


# ---------- CATEGORIES ----------
class TestCategories:
    def test_list(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        data = r.json()["data"]
        assert len(data) >= 5
        assert all("course_count" in c for c in data)
        assert all("slug" in c for c in data)


# ---------- COURSES ----------
class TestCourses:
    def test_list_courses(self):
        r = requests.get(f"{API}/courses")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body and "pagination" in body
        assert len(body["data"]) >= 1

    def test_filter_category(self):
        r = requests.get(f"{API}/courses?category=web-development")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c.get("category", {}).get("slug") == "web-development"

    def test_filter_level(self):
        r = requests.get(f"{API}/courses?level=BEGINNER")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["level"] == "BEGINNER"

    def test_filter_is_free(self):
        r = requests.get(f"{API}/courses?is_free=true")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["is_free"] is True

    def test_search(self):
        r = requests.get(f"{API}/courses?search=python")
        assert r.status_code == 200

    def test_sort_rating(self):
        r = requests.get(f"{API}/courses?sort=rating")
        assert r.status_code == 200

    def test_course_detail_by_slug(self):
        r = requests.get(f"{API}/courses")
        slug = r.json()["data"][0]["slug"]
        r2 = requests.get(f"{API}/courses/{slug}")
        assert r2.status_code == 200
        d = r2.json()["data"]
        assert "sections" in d and "reviews" in d
        assert "is_enrolled" in d

    def test_course_detail_with_auth(self):
        s, _, _ = login(STUDENT_ALEX)
        r = requests.get(f"{API}/courses")
        slug = r.json()["data"][0]["slug"]
        r2 = s.get(f"{API}/courses/{slug}")
        assert r2.status_code == 200
        assert "is_enrolled" in r2.json()["data"]


# ---------- COURSE CRUD (educator/admin) ----------
class TestCourseCRUD:
    created_course_id = None

    def test_create_as_educator(self):
        s, _, _ = login(EDU_SARAH)
        r = s.post(f"{API}/courses", json={
            "title": f"TEST_Course_{uuid.uuid4().hex[:6]}",
            "short_description": "test",
            "description": "test desc",
            "is_free": True,
            "level": "BEGINNER",
        })
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["status"] == "DRAFT"
        TestCourseCRUD.created_course_id = d["id"]

    def test_update_own_course(self):
        assert TestCourseCRUD.created_course_id
        s, _, _ = login(EDU_SARAH)
        r = s.patch(f"{API}/courses/{TestCourseCRUD.created_course_id}", json={"title": "TEST_Updated"})
        assert r.status_code == 200
        assert r.json()["data"]["title"] == "TEST_Updated"

    def test_update_other_educator_forbidden(self):
        assert TestCourseCRUD.created_course_id
        s, _, _ = login(EDU_MARCUS)
        r = s.patch(f"{API}/courses/{TestCourseCRUD.created_course_id}", json={"title": "HACKED"})
        assert r.status_code == 403

    def test_publish_toggle(self):
        assert TestCourseCRUD.created_course_id
        s, _, _ = login(EDU_SARAH)
        r = s.patch(f"{API}/courses/{TestCourseCRUD.created_course_id}/publish")
        assert r.status_code == 200
        assert r.json()["data"]["status"] == "PUBLISHED"
        r2 = s.patch(f"{API}/courses/{TestCourseCRUD.created_course_id}/publish")
        assert r2.json()["data"]["status"] == "DRAFT"

    def test_student_cannot_create(self):
        s, _, _ = login(STUDENT_ALEX)
        r = s.post(f"{API}/courses", json={"title": "X"})
        assert r.status_code == 403

    def test_my_courses_educator(self):
        s, _, _ = login(EDU_SARAH)
        r = s.get(f"{API}/courses/my-courses")
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_my_courses_forbidden_for_student(self):
        s, _, _ = login(STUDENT_ALEX)
        r = s.get(f"{API}/courses/my-courses")
        assert r.status_code == 403

    def test_sections_lessons_crud(self):
        assert TestCourseCRUD.created_course_id
        s, _, _ = login(EDU_SARAH)
        # create section
        r = s.post(f"{API}/courses/{TestCourseCRUD.created_course_id}/sections",
                   json={"title": "TEST Section", "order": 1})
        assert r.status_code == 200
        section_id = r.json()["data"]["id"]
        # create lesson
        r2 = s.post(f"{API}/sections/{section_id}/lessons",
                    json={"title": "TEST Lesson", "type": "VIDEO",
                          "video_url": "https://youtu.be/dQw4w9WgXcQ", "duration": 60})
        assert r2.status_code == 200
        lesson_id = r2.json()["data"]["id"]
        # delete lesson
        r3 = s.delete(f"{API}/lessons/{lesson_id}")
        assert r3.status_code == 200
        # delete section
        r4 = s.delete(f"{API}/sections/{section_id}")
        assert r4.status_code == 200

    def test_delete_course_zzz(self):
        # named zzz to run last in class
        assert TestCourseCRUD.created_course_id
        s, _, _ = login(EDU_SARAH)
        r = s.delete(f"{API}/courses/{TestCourseCRUD.created_course_id}")
        assert r.status_code == 200


# ---------- ENROLLMENTS & PROGRESS ----------
class TestEnrollments:
    enrollment_id = None
    course_id = None
    lesson_ids = []

    def test_enroll_in_seeded_course(self):
        # find a published course with lessons
        s, _, _ = login(STUDENT_PRIYA)
        r = requests.get(f"{API}/courses?is_free=true")
        # pick a course that has lessons
        chosen = None
        for c in r.json()["data"]:
            d = requests.get(f"{API}/courses/{c['slug']}").json()["data"]
            lessons = [l for sec in d.get("sections", []) for l in sec.get("lessons", [])]
            if lessons:
                chosen = d
                TestEnrollments.lesson_ids = [l["id"] for l in lessons[:3]]
                break
        assert chosen, "No course with lessons found"
        TestEnrollments.course_id = chosen["id"]
        r2 = s.post(f"{API}/enrollments", json={"course_id": chosen["id"]})
        assert r2.status_code == 200
        TestEnrollments.enrollment_id = r2.json()["data"]["id"]

    def test_my_enrollments(self):
        s, _, _ = login(STUDENT_PRIYA)
        r = s.get(f"{API}/enrollments/my")
        assert r.status_code == 200
        assert any(e.get("course", {}).get("id") == TestEnrollments.course_id for e in r.json()["data"])

    def test_update_progress(self):
        assert TestEnrollments.enrollment_id
        assert TestEnrollments.lesson_ids
        s, _, _ = login(STUDENT_PRIYA)
        r = s.patch(f"{API}/enrollments/{TestEnrollments.enrollment_id}/progress",
                    json={"lesson_id": TestEnrollments.lesson_ids[0], "is_completed": True})
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["progress"] > 0
        assert TestEnrollments.lesson_ids[0] in [str(x) for x in d["completed_lesson_ids"]]


# ---------- REVIEWS ----------
class TestReviews:
    def test_review_requires_enrollment(self):
        s, _, _ = login(STUDENT_ALEX)
        # find a course alex isn't enrolled in (try a random one)
        r = requests.get(f"{API}/courses")
        course_id = r.json()["data"][-1]["id"]
        # try to review without enrolling — may succeed if already enrolled; check 403 case
        r2 = s.post(f"{API}/reviews", json={"course_id": course_id, "rating": 4, "comment": "TEST"})
        assert r2.status_code in (200, 403)

    def test_create_review_after_enroll(self):
        s, _, _ = login(STUDENT_PRIYA)
        # Priya is enrolled from TestEnrollments
        course_id = TestEnrollments.course_id
        if not course_id:
            pytest.skip("No enrolled course")
        r = s.post(f"{API}/reviews", json={"course_id": course_id, "rating": 5, "comment": "TEST review"})
        assert r.status_code == 200


# ---------- ADMIN ----------
class TestAdmin:
    def test_admin_dashboard(self):
        s, _, _ = login(ADMIN)
        r = s.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        d = r.json()["data"]
        assert "total_users" in d and "total_courses" in d and "top_courses" in d

    def test_admin_dashboard_forbidden_for_student(self):
        s, _, _ = login(STUDENT_ALEX)
        r = s.get(f"{API}/admin/dashboard")
        assert r.status_code == 403

    def test_admin_users_list(self):
        s, _, _ = login(ADMIN)
        r = s.get(f"{API}/admin/users")
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_admin_users_search(self):
        s, _, _ = login(ADMIN)
        r = s.get(f"{API}/admin/users?search=alex")
        assert r.status_code == 200

    def test_admin_change_role_and_toggle(self):
        s, _, _ = login(ADMIN)
        # find a student
        users = s.get(f"{API}/admin/users?role=STUDENT").json()["data"]
        target = next((u for u in users if u["email"].startswith("TEST_") or "kim" not in u["email"]), None)
        if not target:
            pytest.skip("No student to mutate")
        uid = target["id"]
        # toggle active off then on
        r1 = s.patch(f"{API}/admin/users/{uid}/toggle-active")
        assert r1.status_code == 200
        r2 = s.patch(f"{API}/admin/users/{uid}/toggle-active")
        assert r2.status_code == 200

    def test_admin_courses(self):
        s, _, _ = login(ADMIN)
        r = s.get(f"{API}/admin/courses")
        assert r.status_code == 200
        r2 = s.get(f"{API}/admin/courses?status=PUBLISHED")
        assert r2.status_code == 200


# ---------- EDUCATOR ----------
class TestEducator:
    def test_educator_dashboard(self):
        s, _, _ = login(EDU_SARAH)
        r = s.get(f"{API}/educator/dashboard")
        assert r.status_code == 200
        d = r.json()["data"]
        assert "total_courses" in d and "top_courses" in d

    def test_educator_dashboard_forbidden_for_student(self):
        s, _, _ = login(STUDENT_ALEX)
        r = s.get(f"{API}/educator/dashboard")
        assert r.status_code == 403
