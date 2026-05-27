import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock, Users, BookOpen, CheckCircle2, PlayCircle, Loader2, Lock } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReviewForm from "@/components/ReviewForm";

export default function CourseDetail() {
    const { slug } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [enrolling, setEnrolling] = useState(false);

    const load = async () => {
        try {
            const { data } = await api.get(`/courses/${slug}`);
            setCourse(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    useEffect(() => { load(); }, [slug]);

    const enroll = async () => {
        if (!user) return navigate("/login");
        setEnrolling(true);
        try {
            await api.post("/enrollments", { course_id: course.id });
            toast.success("Enrolled successfully!");
            navigate(`/learn/${course.slug}`);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setEnrolling(false); }
    };

    if (!course) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Navbar />
                <div className="flex h-[60vh] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-brand-800" />
                </div>
            </div>
        );
    }

    const totalLessons = (course.sections || []).reduce((n, s) => n + (s.lessons?.length || 0), 0);

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <section className="border-b border-slate-200 bg-brand-800 text-white">
                <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        {course.category && (
                            <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">{course.category.name}</div>
                        )}
                        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight lg:text-5xl" data-testid="course-title">
                            {course.title}
                        </h1>
                        <p className="mt-4 max-w-2xl text-white/80 leading-relaxed">{course.short_description}</p>
                        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
                            <div className="flex items-center gap-1.5">
                                <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
                                <span className="font-semibold">{(course.average_rating || 0).toFixed(1)}</span>
                                <span className="text-white/60">({course.total_ratings || 0} reviews)</span>
                            </div>
                            <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-white/60" />{course.total_enrollments || 0} enrolled</div>
                            <div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-white/60" />{totalLessons} lessons</div>
                            <Badge className="bg-gold-500 text-white hover:bg-gold-600">{course.level?.replace("_", " ")}</Badge>
                        </div>
                        {course.educator && (
                            <div className="mt-6 flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-white/20">
                                    <AvatarImage src={course.educator.avatar} />
                                    <AvatarFallback className="bg-gold-500 text-white">{course.educator.first_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="text-xs uppercase tracking-wider text-white/60">Instructor</div>
                                    <div className="font-display font-semibold">{course.educator.first_name} {course.educator.last_name}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-10">
                    {course.outcomes?.length > 0 && (
                        <Card className="border-slate-200 p-6">
                            <h2 className="font-display text-xl font-bold text-slate-900">What you'll learn</h2>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {course.outcomes.map((o, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                                        <span>{o}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    <div>
                        <h2 className="font-display text-xl font-bold text-slate-900">Curriculum</h2>
                        <p className="mt-1 text-sm text-slate-500">{course.sections?.length || 0} sections · {totalLessons} lessons</p>
                        <Accordion type="multiple" className="mt-4 rounded-xl border border-slate-200 bg-white" data-testid="curriculum">
                            {(course.sections || []).map((s, i) => (
                                <AccordionItem key={s.id} value={s.id} className="border-slate-200 px-5 last:border-0">
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex flex-1 items-center justify-between pr-3 text-left">
                                            <div>
                                                <div className="text-xs uppercase tracking-wider text-slate-500">Section {i + 1}</div>
                                                <div className="mt-0.5 font-display font-semibold text-slate-900">{s.title}</div>
                                            </div>
                                            <span className="text-xs text-slate-500">{s.lessons?.length || 0} lessons</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="space-y-2 pb-4">
                                            {(s.lessons || []).map((l) => (
                                                <li key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {l.is_free || course.is_enrolled ? (
                                                            <PlayCircle className="h-4 w-4 text-brand-800" />
                                                        ) : (
                                                            <Lock className="h-4 w-4 text-slate-400" />
                                                        )}
                                                        <span className="text-slate-700">{l.title}</span>
                                                        {l.is_free && <Badge variant="secondary" className="bg-gold-500/10 text-gold-600">Preview</Badge>}
                                                    </div>
                                                    <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />{l.duration || 0}m</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    {course.requirements?.length > 0 && (
                        <Card className="border-slate-200 p-6">
                            <h2 className="font-display text-xl font-bold text-slate-900">Requirements</h2>
                            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                                {course.requirements.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </Card>
                    )}

                    {course.description && (
                        <Card className="border-slate-200 p-6">
                            <h2 className="font-display text-xl font-bold text-slate-900">About this course</h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{course.description}</p>
                        </Card>
                    )}

                    {(course.is_enrolled || course.reviews?.length > 0) && (
                        <div>
                            <h2 className="font-display text-xl font-bold text-slate-900">Student reviews</h2>
                            {course.is_enrolled && (
                                <div className="mt-4">
                                    <ReviewForm courseId={course.id} onSaved={load} />
                                </div>
                            )}
                            <div className="mt-4 space-y-3">
                                {(course.reviews || []).map((r) => (
                                    <Card key={r.id} className="border-slate-200 p-5">
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-9 w-9"><AvatarFallback className="bg-brand-800 text-white text-xs">{r.user?.first_name?.[0] || "S"}</AvatarFallback></Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-display text-sm font-semibold text-slate-900">{r.user?.first_name} {r.user?.last_name}</div>
                                                    <div className="flex">
                                                        {[1, 2, 3, 4, 5].map((n) => (
                                                            <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-gold-500 text-gold-500" : "text-slate-200"}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* sticky enrollment sidebar */}
                <aside className="lg:col-span-1">
                    <Card className="sticky top-24 border-slate-200 p-6 shadow-md">
                        <div className="overflow-hidden rounded-lg bg-slate-100">
                            <img src={course.thumbnail} alt="" className="aspect-video w-full object-cover" />
                        </div>
                        <div className="mt-5 font-display text-3xl font-bold text-brand-800">
                            {course.is_free ? "Free" : `$${Number(course.price).toFixed(2)}`}
                        </div>

                        {course.is_enrolled ? (
                            <Link to={`/learn/${course.slug}`} className="mt-5 block">
                                <Button className="w-full bg-brand-800 hover:bg-brand-900" data-testid="continue-learning-btn">
                                    Continue learning
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                onClick={enroll}
                                disabled={enrolling}
                                className="mt-5 w-full bg-gold-500 hover:bg-gold-600"
                                data-testid="enroll-button"
                            >
                                {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll now"}
                            </Button>
                        )}

                        <ul className="mt-6 space-y-3 text-sm text-slate-700">
                            <li className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-brand-800" />{totalLessons} on-demand lessons</li>
                            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-800" />Lifetime access</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-800" />Certificate of completion</li>
                        </ul>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
