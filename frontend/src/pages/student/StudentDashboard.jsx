import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import CourseCard from "@/components/CourseCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Award, Clock, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

export default function StudentDashboard() {
    const { user } = useAuth();
    const [enrollments, setEnrollments] = useState([]);
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => { (async () => {
        const [{ data: enr }, { data: rec }] = await Promise.all([
            api.get("/enrollments/my"),
            api.get("/courses?limit=4&sort=popular"),
        ]);
        setEnrollments(enr.data);
        setRecommendations(rec.data);
    })(); }, []);

    const inProgress = enrollments.filter((e) => e.status === "ACTIVE");
    const completed = enrollments.filter((e) => e.status === "COMPLETED");
    const totalHours = enrollments.reduce((s, e) => s + (e.course?.estimated_duration || 0), 0) / 60;

    return (
        <DashboardLayout
            title={`Welcome back, ${user?.first_name} 👋`}
            subtitle="Pick up where you left off and keep building skills."
        >
            <div className="grid gap-4 md:grid-cols-4">
                <StatCard icon={BookOpen} label="Enrolled" value={enrollments.length} accent="brand" />
                <StatCard icon={TrendingUp} label="In progress" value={inProgress.length} accent="gold" />
                <StatCard icon={Award} label="Completed" value={completed.length} accent="green" />
                <StatCard icon={Clock} label="Total hours" value={`${Math.round(totalHours)}h`} accent="purple" />
            </div>

            <section className="mt-10">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-display text-xl font-bold text-slate-900">Continue learning</h2>
                    <Link to="/dashboard/courses" className="text-sm font-medium text-brand-800 hover:underline">View all →</Link>
                </div>
                {inProgress.length === 0 ? (
                    <Card className="border-dashed border-slate-300 bg-white p-12 text-center">
                        <Sparkles className="mx-auto h-10 w-10 text-gold-500" />
                        <h3 className="mt-4 font-display text-lg font-bold text-slate-900">Nothing in progress yet</h3>
                        <p className="mt-1 text-sm text-slate-500">Browse the catalog and enroll in your first course.</p>
                        <Link to="/courses"><Button className="mt-4 bg-brand-800 hover:bg-brand-900" data-testid="browse-courses-cta">Browse courses</Button></Link>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {inProgress.slice(0, 6).map((e) => (
                            <Link key={e.id} to={`/learn/${e.course.slug}`} className="group">
                                <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md">
                                    <div className="aspect-video overflow-hidden bg-slate-100">
                                        <img src={e.course.thumbnail} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-display font-semibold text-slate-900 line-clamp-1">{e.course.title}</h3>
                                        <p className="mt-1 text-xs text-slate-500">By {e.course.educator?.first_name} {e.course.educator?.last_name}</p>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span className="font-semibold text-slate-900">{Math.round(e.progress)}%</span>
                                            </div>
                                            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${e.progress}%` }} />
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="mt-4 w-full text-brand-800 hover:bg-brand-50">
                                            Continue <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-12">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-display text-xl font-bold text-slate-900">Recommended for you</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {recommendations.map((c) => <CourseCard key={c.id} course={c} />)}
                </div>
            </section>
        </DashboardLayout>
    );
}

function StatCard({ icon: Icon, label, value, accent }) {
    const colors = {
        brand: "bg-brand-50 text-brand-800",
        gold: "bg-gold-500/10 text-gold-600",
        green: "bg-emerald-50 text-emerald-600",
        purple: "bg-purple-50 text-purple-600",
    };
    return (
        <Card className="border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[accent]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        </Card>
    );
}
