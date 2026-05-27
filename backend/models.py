"""Pydantic models for request/response schemas."""
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- AUTH ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    role: Literal["STUDENT", "EDUCATOR"] = "STUDENT"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


# ---------- CATEGORIES ----------
class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    icon: Optional[str] = ""
    color: Optional[str] = "#1e40af"


# ---------- COURSES ----------
class CourseIn(BaseModel):
    title: str
    short_description: Optional[str] = ""
    description: Optional[str] = ""
    thumbnail: Optional[str] = ""
    preview_video_url: Optional[str] = ""
    price: float = 0
    is_free: bool = True
    level: Literal["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] = "ALL_LEVELS"
    language: str = "English"
    category_id: Optional[str] = None
    tags: List[str] = []
    requirements: List[str] = []
    outcomes: List[str] = []
    estimated_duration: int = 0


class CourseUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    preview_video_url: Optional[str] = None
    price: Optional[float] = None
    is_free: Optional[bool] = None
    level: Optional[str] = None
    language: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    outcomes: Optional[List[str]] = None
    estimated_duration: Optional[int] = None
    status: Optional[Literal["DRAFT", "PUBLISHED", "ARCHIVED"]] = None


# ---------- SECTIONS / LESSONS ----------
class SectionIn(BaseModel):
    title: str
    description: Optional[str] = ""
    order: int = 0


class LessonIn(BaseModel):
    title: str
    description: Optional[str] = ""
    order: int = 0
    type: Literal["VIDEO", "TEXT", "QUIZ", "ASSIGNMENT", "LIVE"] = "VIDEO"
    video_url: Optional[str] = ""
    video_provider: Literal["YOUTUBE", "VIMEO", "UPLOAD"] = "YOUTUBE"
    duration: int = 0
    content: Optional[str] = ""
    is_free: bool = False


# ---------- ENROLLMENTS / PROGRESS ----------
class ProgressIn(BaseModel):
    lesson_id: str
    is_completed: bool = False
    watched_duration: int = 0
    last_position: int = 0


# ---------- REVIEWS ----------
class ReviewIn(BaseModel):
    course_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


# ---------- USERS ----------
class UserRoleUpdate(BaseModel):
    role: Literal["ADMIN", "EDUCATOR", "STUDENT"]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None


# ---------- QUIZZES ----------
class QuizOption(BaseModel):
    text: str
    is_correct: bool = False


class QuestionIn(BaseModel):
    text: str
    type: Literal["MULTIPLE_CHOICE", "SINGLE_CHOICE", "TRUE_FALSE"] = "SINGLE_CHOICE"
    points: int = 1
    explanation: Optional[str] = ""
    options: List[QuizOption] = []


class QuizIn(BaseModel):
    lesson_id: str
    title: str
    instructions: Optional[str] = ""
    passing_score: int = 60
    time_limit: int = 0  # minutes; 0 = no limit
    attempts_allowed: int = 0  # 0 = unlimited
    shuffle_questions: bool = False
    questions: List[QuestionIn] = []


class QuizSubmitIn(BaseModel):
    # answers: { question_index: [selected_option_indexes] }
    answers: dict = {}
    time_spent: int = 0


# ---------- DISCUSSIONS ----------
class DiscussionIn(BaseModel):
    course_id: str
    lesson_id: Optional[str] = None
    parent_id: Optional[str] = None
    title: Optional[str] = None
    content: str


# ---------- ANNOUNCEMENTS ----------
class AnnouncementIn(BaseModel):
    course_id: Optional[str] = None  # None = platform-wide
    title: str
    content: str


# ---------- SETTINGS ----------
class SettingIn(BaseModel):
    key: str
    value: str
    group: Optional[str] = "general"
    description: Optional[str] = ""

