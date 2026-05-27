import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, ChevronLeft, ChevronRight, PlayCircle, Loader2, ArrowLeft } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import DiscussionsTab from "@/components/DiscussionsTab";

function youtubeEmbed(url) {
    if (!url) return null;
    if (url.includes("/embed/")) return url;
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

export default function CoursePlayer() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [activeLessonId, setActiveLessonId] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { (async () => {
        try {
            const { data } = await api.get(`/courses/${slug}`);
            setCourse(data.data);
            if (!data.data.is_enrolled) {
                toast.error("You must enroll first.");
                navigate(`/courses/${slug}`);
                return;
            }
            // pick first lesson
            const firstLesson = data.data.sections?.[0]?.lessons?.[0];
            if (firstLesson) setActiveLessonId(firstLesson.id);
        } catch (e) { toast.error(formatApiError(e)); }
    })(); }, [slug, navigate]);

    const allLessons = useMemo(() => {
        if (!course) return [];
        const list = [];
        (course.sections || []).forEach((s) => (s.lessons || []).forEach((l) => list.push({ ...l, sectionTitle: s.title })));
        return list;
    }, [course]);

    const activeLesson = allLessons.find((l) => l.id === activeLessonId);
    const completedIds = course?.enrollment?.completed_lesson_ids || [];
    const completedSet = new Set(completedIds.map(String));
    const isCompleted = activeLesson && completedSet.has(String(activeLesson.id));

    const activeIdx = allLessons.findIndex((l) => l.id === activeLessonId);
    const prev = activeIdx > 0 ? allLessons[activeIdx - 1] : null;
    const next = activeIdx < allLessons.length - 1 ? allLessons[activeIdx + 1] : null;

    const toggleComplete = async () => {
        if (!course || !activeLesson) return;
        setSaving(true);
        try {
            const { data } = await api.patch(`/enrollments/${course.enrollment.id}/progress`, {
                lesson_id: activeLesson.id,
                is_completed: !isCompleted,
            });
            setCourse((c) => ({ ...c, enrollment: data.data, progress: data.data.progress }));
            toast.success(isCompleted ? "Marked incomplete" : "Lesson complete!");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    if (!course || !activeLesson) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-brand-800" /></div>;
    }

    const progress = course.enrollment?.progress || 0;

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar — curriculum */}
            <aside className="hidden w-80 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
                <div className="border-b border-slate-200 p-5">
                    <Link to="/dashboard/courses" className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-brand-800">
                        <ArrowLeft className="mr-1 h-3 w-3" /> All my courses
                    </Link>
                    <h2 className="mt-2 font-display text-base font-bold text-slate-900 line-clamp-2">{course.title}</h2>
                    <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Course progress</span>
                            <span className="font-semibold text-slate-900">{Math.round(progress)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-gold-500" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                    {(course.sections || []).map((s, sIdx) => (
                        <div key={s.id} className="mb-3">
                            <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Section {sIdx + 1}: {s.title}
                            </div>
                            <ul className="space-y-1">
                                {(s.lessons || []).map((l) => {
                                    const active = l.id === activeLessonId;
                                    const done = completedSet.has(String(l.id));
                                    return (
                                        <li key={l.id}>
                                            <button
                                                onClick={() => setActiveLessonId(l.id)}
                                                data-testid={`lesson-${l.id}`}
                                                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                    active ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50 text-slate-700"
                                                }`}
                                            >
                                                {done ? (
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                                ) : (
                                                    <PlayCircle className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-brand-800" : "text-slate-400"}`} />
                                                )}
                                                <span className="flex-1 line-clamp-2">{l.title}</span>
                                                <span className="text-xs text-slate-400">{l.duration}m</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </aside>

            {/* main */}
            <main className="flex-1 overflow-x-hidden">
                <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wider text-slate-500">{activeLesson.sectionTitle}</div>
                            <h1 className="font-display text-lg font-bold text-slate-900 truncate">{activeLesson.title}</h1>
                        </div>
                        <Button
                            onClick={toggleComplete}
                            disabled={saving}
                            className={isCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gold-500 hover:bg-gold-600"}
                            data-testid="mark-complete-btn"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isCompleted ? <><CheckCircle2 className="mr-2 h-4 w-4" />Completed</> : "Mark complete"}
                        </Button>
                    </div>
                </header>

                <div className="mx-auto max-w-5xl p-6">
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-black shadow-lg">
                        {activeLesson.type === "QUIZ" ? (
                            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-brand-800 to-brand-900 text-white">
                                <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">Quiz</div>
                                <h3 className="mt-2 font-display text-2xl font-bold">{activeLesson.title}</h3>
                                <p className="mt-2 max-w-md text-center text-sm text-white/70">Take the quiz when you're ready.</p>
                                <Button
                                    className="mt-6 bg-gold-500 hover:bg-gold-600"
                                    onClick={() => navigate(`/quiz/${activeLesson.id}`)}
                                    data-testid="take-quiz-btn"
                                >
                                    Start quiz
                                </Button>
                            </div>
                        ) : activeLesson.video_url ? (
                            <iframe
                                title={activeLesson.title}
                                src={youtubeEmbed(activeLesson.video_url)}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-white">No video for this lesson</div>
                        )}
                    </div>

                    <Tabs defaultValue="overview" className="mt-8">
                        <TabsList>
                            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                            <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
                            <TabsTrigger value="qa" data-testid="tab-qa">Q&amp;A</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
                            <h3 className="font-display text-base font-bold text-slate-900">About this lesson</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{activeLesson.content || activeLesson.description || "No description provided."}</p>
                        </TabsContent>
                        <TabsContent value="resources" className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
                            {(activeLesson.resources || []).length === 0
                                ? <p className="text-sm text-slate-500">No resources for this lesson.</p>
                                : <ul className="space-y-2 text-sm">{activeLesson.resources.map((r, i) => <li key={i}><a className="text-brand-800 hover:underline" href={r.url}>{r.name}</a></li>)}</ul>}
                        </TabsContent>
                        <TabsContent value="qa" className="mt-4">
                            <DiscussionsTab courseId={course.id} lessonId={activeLesson.id} />
                        </TabsContent>
                    </Tabs>

                    <div className="mt-8 flex items-center justify-between gap-3">
                        <Button
                            variant="outline"
                            disabled={!prev}
                            onClick={() => prev && setActiveLessonId(prev.id)}
                            data-testid="prev-lesson-btn"
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        <Button
                            disabled={!next}
                            onClick={() => next && setActiveLessonId(next.id)}
                            className="bg-brand-800 hover:bg-brand-900"
                            data-testid="next-lesson-btn"
                        >
                            Next <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
