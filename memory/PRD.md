# LearnHub LMS — Product Requirements

## Original Problem Statement
Build a complete, production-ready Learning Management System with auth, course catalog, enrollment, course player, educator builder, and admin panel. (Original spec used Node/Postgres/Prisma — adapted to FastAPI + MongoDB + React per user confirmation, MVP-first.)

## Stack
- Backend: FastAPI + MongoDB (motor)
- Frontend: React + Tailwind + shadcn/ui + React Router v6 + Recharts
- Auth: Custom JWT (httpOnly cookies + Bearer fallback) with bcrypt
- Integrations: NONE wired (Stripe/email/Socket.io deferred, video = YouTube embed)

## User Personas
- **Student** — browses catalog, enrolls, learns via course player, tracks progress
- **Educator** — creates courses, builds curriculum, monitors enrollments/earnings
- **Admin** — manages users, courses, categories, sees platform analytics

## Core Requirements (static)
- Role-based auth (STUDENT, EDUCATOR, ADMIN) with brute-force lockout
- Public catalog with filters (category, level, price, sort, search) + course detail
- Student dashboard with continue-learning + progress tracking
- Course player (YouTube iframe + lesson list + mark complete + auto progress)
- Educator dashboard (KPIs, enrollment chart, top courses) + course builder
- Admin dashboard (platform KPIs, revenue chart, category pie, top courses)
- User mgmt, course mgmt, category mgmt screens for admin

## Implemented (2026-02-27)
- Auth: register/login/logout/me/refresh/forgot/reset (mocked email logs link)
- 8 sample courses, 3 educators, 5 students, admin (seeded automatically)
- Public: Landing (hero + categories + featured + testimonials), Catalog with all filters, Course detail (curriculum accordion + reviews + sticky enroll)
- Student: dashboard, my courses, course player (YouTube embed + progress save)
- Educator: dashboard with charts, my courses list w/ publish toggle, course builder (basics/curriculum/pricing tabs + sections + lessons)
- Admin: dashboard with KPIs + charts, users mgmt, courses mgmt, categories CRUD
- Profile edit page

## Prioritized Backlog (deferred for v1)
- **P1**: Quiz builder + quiz attempts, assignment submission/grading, real notifications
- **P1**: Certificate PDF generation + verification page
- **P1**: Reviews UI (writing one as a student)
- **P2**: Stripe payments, email service, video file upload to object storage
- **P2**: Discussions / Q&A, announcements, real-time Socket.io
- **P2**: Course analytics page (per-course), educator earnings page, admin reports/settings

## Next Tasks
1. Quiz builder + student quiz-taking
2. Certificate generation on course completion
3. Reviews/ratings UI for students
4. Stripe checkout integration for paid courses (request keys from user)
