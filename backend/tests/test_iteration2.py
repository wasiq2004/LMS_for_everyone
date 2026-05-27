"""Iteration 2: Quizzes, Certificates, Discussions, Announcements, Notifications,
Settings, Reports, Earnings, Reviews list, Instructors public."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://learn-hub-1253.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@lms.com", "password": "Admin@123"}
EDU_SARAH = {"email": "sarah.chen@lms.com", "password": "Educator@123"}
EDU_MARCUS = {"email": "marcus.lee@lms.com", "password": "Educator@123"}
STUDENT_ALEX = {"email": "alex.kim@example.com", "password": "Student@123"}
STUDENT_PRIYA = {"email": "priya.patel@example.com", "password": "Student@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text[:200]}"
    j = r.json()
    return j["access_token"], j["data"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------- module-scoped helpers / shared state -------
@pytest.fixture(scope="module")
def sarah():
    t, u = _login(EDU_SARAH)
    return {"t": t, "u": u}


@pytest.fixture(scope="module")
def marcus():
    t, u = _login(EDU_MARCUS)
    return {"t": t, "u": u}


@pytest.fixture(scope="module")
def admin():
    t, u = _login(ADMIN)
    return {"t": t, "u": u}


@pytest.fixture(scope="module")
def alex():
    t, u = _login(STUDENT_ALEX)
    return {"t": t, "u": u}


@pytest.fixture(scope="module")
def priya():
    t, u = _login(STUDENT_PRIYA)
    return {"t": t, "u": u}


@pytest.fixture(scope="module")
def sarah_course(sarah):
    """Pick Sarah's first published course."""
    r = requests.get(f"{API}/courses/my-courses", headers=_h(sarah["t"]))
    assert r.status_code == 200, r.text
    courses = r.json()["data"]
    assert courses, "Sarah has no courses"
    return courses[0]


@pytest.fixture(scope="module")
def sarah_lesson(sarah, sarah_course):
    """Find a non-quiz lesson under Sarah's course to attach a fresh quiz to."""
    slug = sarah_course["slug"]
    r = requests.get(f"{API}/courses/{slug}", headers=_h(sarah["t"]))
    assert r.status_code == 200, r.text
    course = r.json()["data"]
    for sec in course.get("sections", []):
        for lsn in sec.get("lessons", []):
            return lsn  # pick the first lesson
    pytest.skip("No lesson available in Sarah's course")


# =========== QUIZZES ===========
class TestQuizzes:
    def test_create_quiz_educator(self, sarah, sarah_lesson):
        payload = {
            "lesson_id": sarah_lesson["id"],
            "title": "TEST_Quiz iter2",
            "instructions": "Pick the right answers",
            "passing_score": 60,
            "time_limit": 10,
            "attempts_allowed": 0,
            "shuffle_questions": False,
            "questions": [
                {
                    "text": "Capital of France?",
                    "type": "SINGLE_CHOICE",
                    "points": 1,
                    "options": [
                        {"text": "Paris", "is_correct": True},
                        {"text": "Rome", "is_correct": False},
                        {"text": "Berlin", "is_correct": False},
                    ],
                },
                {
                    "text": "Pick prime numbers",
                    "type": "MULTIPLE_CHOICE",
                    "points": 2,
                    "options": [
                        {"text": "2", "is_correct": True},
                        {"text": "3", "is_correct": True},
                        {"text": "4", "is_correct": False},
                        {"text": "6", "is_correct": False},
                    ],
                },
            ],
        }
        r = requests.post(f"{API}/quizzes", json=payload, headers=_h(sarah["t"]))
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert d["title"] == "TEST_Quiz iter2"
        # store quiz id on lesson dict
        sarah_lesson["_quiz_id"] = d.get("id") or d.get("_id")

    def test_create_quiz_other_educator_forbidden(self, marcus, sarah_lesson):
        payload = {"lesson_id": sarah_lesson["id"], "title": "stealing", "questions": []}
        r = requests.post(f"{API}/quizzes", json=payload, headers=_h(marcus["t"]))
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"

    def test_create_quiz_student_forbidden(self, alex, sarah_lesson):
        payload = {"lesson_id": sarah_lesson["id"], "title": "x", "questions": []}
        r = requests.post(f"{API}/quizzes", json=payload, headers=_h(alex["t"]))
        assert r.status_code in (401, 403)

    def test_overwrite_same_lesson(self, sarah, sarah_lesson):
        payload = {
            "lesson_id": sarah_lesson["id"],
            "title": "TEST_Quiz iter2 v2",
            "passing_score": 50,
            "questions": [
                {"text": "1+1?", "type": "SINGLE_CHOICE", "points": 1,
                 "options": [{"text": "2", "is_correct": True}, {"text": "3", "is_correct": False}]},
            ],
        }
        r = requests.post(f"{API}/quizzes", json=payload, headers=_h(sarah["t"]))
        assert r.status_code == 200
        assert r.json()["data"]["title"] == "TEST_Quiz iter2 v2"

        # restore richer quiz for downstream tests
        full = {
            "lesson_id": sarah_lesson["id"],
            "title": "TEST_Quiz iter2",
            "passing_score": 60,
            "questions": [
                {"text": "Capital of France?", "type": "SINGLE_CHOICE", "points": 1,
                 "options": [{"text": "Paris", "is_correct": True},
                             {"text": "Rome", "is_correct": False}]},
                {"text": "Pick primes", "type": "MULTIPLE_CHOICE", "points": 2,
                 "options": [{"text": "2", "is_correct": True},
                             {"text": "3", "is_correct": True},
                             {"text": "4", "is_correct": False}]},
            ],
        }
        r = requests.post(f"{API}/quizzes", json=full, headers=_h(sarah["t"]))
        assert r.status_code == 200

    def test_student_get_quiz_hides_answers(self, alex, sarah_lesson):
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(alex["t"]))
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        for q in d["questions"]:
            for o in q["options"]:
                assert "is_correct" not in o, "student should not see is_correct"
            assert "explanation" not in q or q.get("explanation") in (None, "")

    def test_educator_owner_sees_answers(self, sarah, sarah_lesson):
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(sarah["t"]))
        assert r.status_code == 200
        d = r.json()["data"]
        assert any("is_correct" in o for q in d["questions"] for o in q["options"]), \
            "owner-educator must see is_correct"

    def test_submit_quiz_all_correct(self, alex, sarah_lesson):
        # fetch quiz id (student view)
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(alex["t"]))
        quiz = r.json()["data"]
        quiz_id = quiz.get("id") or quiz.get("_id")
        # All correct: q0 -> 0, q1 -> [0,1]
        body = {"answers": {"0": [0], "1": [0, 1]}, "time_spent": 5}
        r = requests.post(f"{API}/quizzes/{quiz_id}/submit", json=body, headers=_h(alex["t"]))
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert d["score"] == 100
        assert d["is_passed"] is True
        assert len(d["breakdown"]) == 2
        assert all(b["is_correct"] for b in d["breakdown"])

    def test_submit_multi_partial_is_wrong(self, alex, sarah_lesson):
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(alex["t"]))
        quiz = r.json()["data"]
        quiz_id = quiz.get("id") or quiz.get("_id")
        # q0 correct, q1 only one of two correct submitted -> wrong (no partial credit)
        body = {"answers": {"0": [0], "1": [0]}}
        r = requests.post(f"{API}/quizzes/{quiz_id}/submit", json=body, headers=_h(alex["t"]))
        d = r.json()["data"]
        # earned 1 of 3, score ~33%
        assert d["earned_points"] == 1
        assert d["total_points"] == 3
        assert d["breakdown"][1]["is_correct"] is False
        assert d["is_passed"] is False

    def test_submit_multi_with_extra_wrong(self, alex, sarah_lesson):
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(alex["t"]))
        quiz_id = r.json()["data"].get("id") or r.json()["data"].get("_id")
        body = {"answers": {"0": [0], "1": [0, 1, 2]}}  # extra wrong index
        r = requests.post(f"{API}/quizzes/{quiz_id}/submit", json=body, headers=_h(alex["t"]))
        d = r.json()["data"]
        assert d["breakdown"][1]["is_correct"] is False

    def test_attempts_list(self, alex, sarah_lesson):
        r = requests.get(f"{API}/quizzes/lesson/{sarah_lesson['id']}", headers=_h(alex["t"]))
        quiz_id = r.json()["data"].get("id") or r.json()["data"].get("_id")
        r = requests.get(f"{API}/quizzes/{quiz_id}/attempts", headers=_h(alex["t"]))
        assert r.status_code == 200
        attempts = r.json()["data"]
        assert isinstance(attempts, list) and len(attempts) >= 3


# =========== CERTIFICATES ===========
class TestCertificates:
    def test_my_certs_alex(self, alex):
        r = requests.get(f"{API}/certificates/my", headers=_h(alex["t"]))
        assert r.status_code == 200
        certs = r.json()["data"]
        assert isinstance(certs, list)
        # Alex from earlier should have one (LH-EB32399A)
        assert any(c.get("certificate_number", "").startswith("LH-") for c in certs), \
            f"Alex expected to have a cert; got {certs}"

    def test_generate_cert_incomplete_enrollment_returns_400(self, priya):
        # Priya — find an incomplete enrollment
        r = requests.get(f"{API}/enrollments/my", headers=_h(priya["t"]))
        if r.status_code != 200:
            pytest.skip("no enrollments endpoint")
        items = r.json()["data"]
        incomplete = next((e for e in items if e.get("progress", 0) < 100), None)
        if not incomplete:
            pytest.skip("No incomplete enrollment for Priya")
        enr_id = incomplete.get("id") or incomplete.get("_id")
        r = requests.post(f"{API}/certificates/generate/{enr_id}", headers=_h(priya["t"]))
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_verify_cert_public(self, alex):
        r = requests.get(f"{API}/certificates/my", headers=_h(alex["t"]))
        certs = r.json()["data"]
        if not certs:
            pytest.skip("No cert for Alex")
        num = certs[0]["certificate_number"]
        # PUBLIC: no auth
        r = requests.get(f"{API}/certificates/verify/{num}")
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert "learner_name" in d
        assert "course_title" in d
        assert "issued_at" in d

    def test_verify_cert_bad(self):
        r = requests.get(f"{API}/certificates/verify/LH-BADBADBA")
        assert r.status_code == 404

    def test_download_cert_pdf(self, alex):
        r = requests.get(f"{API}/certificates/my", headers=_h(alex["t"]))
        certs = r.json()["data"]
        if not certs:
            pytest.skip("No cert for Alex")
        num = certs[0]["certificate_number"]
        r = requests.get(f"{API}/certificates/{num}/download")
        assert r.status_code == 200, r.text[:200]
        assert "application/pdf" in r.headers.get("content-type", ""), r.headers
        assert len(r.content) > 1000
        assert r.content[:4] == b"%PDF"

    def test_idempotent_generate(self, alex):
        r = requests.get(f"{API}/enrollments/my", headers=_h(alex["t"]))
        completed = next((e for e in r.json()["data"] if e.get("progress", 0) >= 100), None)
        if not completed:
            pytest.skip("Alex has no completed enrollment")
        enr_id = completed.get("id") or completed.get("_id")
        r1 = requests.post(f"{API}/certificates/generate/{enr_id}", headers=_h(alex["t"]))
        r2 = requests.post(f"{API}/certificates/generate/{enr_id}", headers=_h(alex["t"]))
        assert r1.status_code == 200 and r2.status_code == 200
        n1 = r1.json()["data"]["certificate_number"]
        n2 = r2.json()["data"]["certificate_number"]
        assert n1 == n2, "Cert must be idempotent"


# =========== DISCUSSIONS ===========
class TestDiscussions:
    def test_create_thread_and_list(self, alex, sarah_course):
        course_id = sarah_course.get("id") or sarah_course.get("_id")
        payload = {"course_id": course_id, "title": "TEST_Q iter2", "content": "Help please"}
        r = requests.post(f"{API}/discussions", json=payload, headers=_h(alex["t"]))
        assert r.status_code == 200, r.text
        thread = r.json()["data"]
        tid = thread.get("id") or thread.get("_id")
        assert tid
        # list
        r = requests.get(f"{API}/discussions?course_id={course_id}", headers=_h(alex["t"]))
        assert r.status_code == 200
        threads = r.json()["data"]
        assert any((t.get("id") or t.get("_id")) == tid for t in threads)
        # author/reply_count fields
        found = next(t for t in threads if (t.get("id") or t.get("_id")) == tid)
        assert "author" in found
        assert "reply_count" in found
        # detail
        r = requests.get(f"{API}/discussions/{tid}", headers=_h(alex["t"]))
        assert r.status_code == 200
        assert "replies" in r.json()["data"]
        # reply
        r = requests.post(f"{API}/discussions",
                          json={"course_id": course_id, "parent_id": tid, "content": "TEST_reply"},
                          headers=_h(priya_token := alex["t"]))
        assert r.status_code == 200
        # upvote toggles
        r = requests.post(f"{API}/discussions/{tid}/upvote", headers=_h(alex["t"]))
        assert r.status_code == 200
        u1 = r.json()["data"].get("upvotes", r.json()["data"])
        r = requests.post(f"{API}/discussions/{tid}/upvote", headers=_h(alex["t"]))
        assert r.status_code == 200
        # pin & resolve (educator owner)
        # find Sarah's token via fixture-independent approach — re-login
        st, _ = _login(EDU_SARAH)
        r = requests.patch(f"{API}/discussions/{tid}/pin", headers=_h(st))
        assert r.status_code == 200
        r = requests.patch(f"{API}/discussions/{tid}/resolve", headers=_h(st))
        assert r.status_code == 200


# =========== ANNOUNCEMENTS ===========
class TestAnnouncements:
    def test_educator_creates_for_own_course(self, sarah, sarah_course):
        cid = sarah_course.get("id") or sarah_course.get("_id")
        r = requests.post(f"{API}/announcements",
                          json={"course_id": cid, "title": "TEST_Ann iter2", "content": "Hello class"},
                          headers=_h(sarah["t"]))
        assert r.status_code == 200, r.text
        # list
        r = requests.get(f"{API}/announcements?course_id={cid}", headers=_h(sarah["t"]))
        assert r.status_code == 200
        assert any(a.get("title") == "TEST_Ann iter2" for a in r.json()["data"])

    def test_educator_cannot_platform_wide(self, sarah):
        r = requests.post(f"{API}/announcements",
                          json={"course_id": None, "title": "evil", "content": "x"},
                          headers=_h(sarah["t"]))
        assert r.status_code in (400, 403), r.text

    def test_admin_platform_wide(self, admin):
        r = requests.post(f"{API}/announcements",
                          json={"course_id": None, "title": "TEST_PLATFORM iter2", "content": "ann"},
                          headers=_h(admin["t"]))
        assert r.status_code == 200, r.text


# =========== NOTIFICATIONS ===========
class TestNotifications:
    def test_list_and_mark_all(self, alex):
        r = requests.get(f"{API}/notifications", headers=_h(alex["t"]))
        assert r.status_code == 200
        body = r.json()
        # API returns {success, data:[...notifs], unread_count}
        assert isinstance(body["data"], list)
        assert "unread_count" in body
        # mark all
        r = requests.patch(f"{API}/notifications/read-all", headers=_h(alex["t"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/notifications", headers=_h(alex["t"]))
        assert r.json()["unread_count"] == 0


# =========== SETTINGS ===========
class TestSettings:
    def test_admin_crud(self, admin):
        key = f"TEST_setting_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/settings",
                          json={"key": key, "value": "v1", "group": "general"},
                          headers=_h(admin["t"]))
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/admin/settings", headers=_h(admin["t"]))
        assert r.status_code == 200
        keys = [s["key"] for s in r.json()["data"]]
        assert key in keys
        # update / upsert
        r = requests.post(f"{API}/admin/settings",
                          json={"key": key, "value": "v2", "group": "general"},
                          headers=_h(admin["t"]))
        assert r.status_code == 200
        r = requests.delete(f"{API}/admin/settings/{key}", headers=_h(admin["t"]))
        assert r.status_code == 200

    def test_settings_non_admin_forbidden(self, sarah):
        r = requests.get(f"{API}/admin/settings", headers=_h(sarah["t"]))
        assert r.status_code in (401, 403)


# =========== EARNINGS / REPORTS ===========
class TestEarningsReports:
    def test_educator_earnings(self, sarah):
        r = requests.get(f"{API}/educator/earnings", headers=_h(sarah["t"]))
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert "total_gross" in d
        assert "total_net" in d
        assert "transactions" in d
        # 70% rule
        if d["total_gross"] > 0:
            ratio = d["total_net"] / d["total_gross"]
            assert 0.69 <= ratio <= 0.71, f"expected ~70% net got {ratio}"

    def test_admin_reports(self, admin):
        r = requests.get(f"{API}/admin/reports/overview", headers=_h(admin["t"]))
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        # actual shape: {"courses": [...]}
        rows = d["courses"] if isinstance(d, dict) else d
        assert isinstance(rows, list)
        if rows:
            row = rows[0]
            for k in ("enrollments", "completed", "revenue_estimate"):
                assert k in row, f"missing {k} in report row"


# =========== REVIEWS LIST ===========
class TestReviewsList:
    def test_reviews_by_slug(self, sarah_course):
        slug = sarah_course["slug"]
        r = requests.get(f"{API}/reviews/course/{slug}")
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert "items" in d or "reviews" in d or isinstance(d, list)


# =========== INSTRUCTORS PUBLIC ===========
class TestInstructors:
    def test_instructors_list(self):
        r = requests.get(f"{API}/instructors")
        assert r.status_code == 200
        items = r.json()["data"]
        assert any("course_count" in i for i in items)

    def test_instructor_profile(self, sarah):
        uid = sarah["u"]["id"]
        r = requests.get(f"{API}/users/instructor/{uid}")
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        # backend returns flat user with .courses appended
        assert d.get("email") == EDU_SARAH["email"]
        assert "courses" in d
        assert isinstance(d["courses"], list)
