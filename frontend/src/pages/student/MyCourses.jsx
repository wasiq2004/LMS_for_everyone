import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search } from "lucide-react";
import api from "@/lib/api";

export default function MyCourses() {
    const [enrollments, setEnrollments] = useState([]);
    const [tab, setTab] = useState("all");

    useEffect(() => { (async () => {
        const { data } = await api.get("/enrollments/my");
        setEnrollments(data.data);
    })(); }, []);

    const filtered = enrollments.filter((e) =>
        tab === "all" ? true : tab === "active" ? e.status === "ACTIVE" : e.status === "COMPLETED"
    );

    return (
        <DashboardLayout title="My Courses" subtitle="Your enrolled courses and progress.">
            <Tabs value={tab} onValueChange={setTab} className="mb-6">
                <TabsList>
                    <TabsTrigger value="all" data-testid="tab-all">All ({enrollments.length})</TabsTrigger>
                    <TabsTrigger value="active" data-testid="tab-active">In progress</TabsTrigger>
                    <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
                </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-16 text-center">
                    <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No courses yet</h3>
                    <p className="mt-1 text-sm text-slate-500">Time to start your learning journey.</p>
                    <Link to="/courses"><Button className="mt-4 bg-brand-800 hover:bg-brand-900" data-testid="browse-cta"><Search className="mr-2 h-4 w-4" />Browse courses</Button></Link>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((e) => (
                        <Link key={e.id} to={`/learn/${e.course.slug}`} data-testid={`enrolled-${e.id}`}>
                            <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md">
                                <div className="aspect-video bg-slate-100">
                                    <img src={e.course.thumbnail} alt="" className="h-full w-full object-cover" />
                                </div>
                                <div className="p-5">
                                    <h3 className="font-display font-semibold text-slate-900 line-clamp-1">{e.course.title}</h3>
                                    <div className="mt-3">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Progress</span>
                                            <span className="font-semibold text-slate-900">{Math.round(e.progress)}%</span>
                                        </div>
                                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-gold-500" style={{ width: `${e.progress}%` }} />
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="mt-4 w-full text-brand-800 hover:bg-brand-50">
                                        {e.status === "COMPLETED" ? "Review" : "Continue"}
                                    </Button>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
