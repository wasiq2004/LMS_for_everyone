import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, TrendingUp, DollarSign, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import api from "@/lib/api";

const MOCK_ENROLLMENTS_TREND = [
    { month: "Sep", enrollments: 24 }, { month: "Oct", enrollments: 38 },
    { month: "Nov", enrollments: 51 }, { month: "Dec", enrollments: 47 },
    { month: "Jan", enrollments: 68 }, { month: "Feb", enrollments: 82 },
];

export default function EducatorDashboard() {
    const [stats, setStats] = useState(null);

    useEffect(() => { (async () => {
        const { data } = await api.get("/educator/dashboard");
        setStats(data.data);
    })(); }, []);

    if (!stats) return (
        <DashboardLayout title="Educator Studio" subtitle="Loading your data...">
            <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white" />)}
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout
            title="Educator Studio"
            subtitle="Track performance, build courses, grow your audience."
            action={<Link to="/educator/courses/new"><Button className="bg-brand-800 hover:bg-brand-900" data-testid="create-course-btn"><Plus className="mr-2 h-4 w-4" />New course</Button></Link>}
        >
            <div className="grid gap-4 md:grid-cols-4">
                <KPICard icon={BookOpen} label="Total Courses" value={stats.total_courses} sub={`${stats.published_courses} published`} />
                <KPICard icon={Users} label="Enrollments" value={stats.total_enrollments} sub={`${stats.completed_enrollments} completed`} />
                <KPICard icon={TrendingUp} label="Completion rate" value={`${stats.total_enrollments ? Math.round((stats.completed_enrollments / stats.total_enrollments) * 100) : 0}%`} sub="All-time" />
                <KPICard icon={DollarSign} label="Est. earnings" value={`$${stats.estimated_earnings.toLocaleString()}`} sub="Lifetime" accent="gold" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <Card className="border-slate-200 bg-white p-6 lg:col-span-2">
                    <div className="mb-5">
                        <h3 className="font-display text-base font-bold text-slate-900">Enrollment trend</h3>
                        <p className="text-xs text-slate-500">Last 6 months</p>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={MOCK_ENROLLMENTS_TREND}>
                                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip />
                                <Line type="monotone" dataKey="enrollments" stroke="#1e40af" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">Top courses</h3>
                    <p className="text-xs text-slate-500">By enrollments</p>
                    <div className="mt-5 space-y-3">
                        {stats.top_courses?.length === 0 ? (
                            <p className="text-sm text-slate-500">No courses yet.</p>
                        ) : stats.top_courses.map((c) => (
                            <Link key={c.id} to={`/educator/courses/${c.id}/edit`} className="block rounded-lg p-3 hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <img src={c.thumbnail} className="h-10 w-14 rounded object-cover" alt="" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-display text-sm font-semibold text-slate-900 truncate">{c.title}</div>
                                        <div className="text-xs text-slate-500">{c.total_enrollments} enrolled</div>
                                    </div>
                                    <Badge variant="secondary" className={c.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}>
                                        {c.status}
                                    </Badge>
                                </div>
                            </Link>
                        ))}
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
}

function KPICard({ icon: Icon, label, value, sub, accent }) {
    return (
        <Card className="border-slate-200 bg-white p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent === "gold" ? "bg-gold-500/10 text-gold-600" : "bg-brand-50 text-brand-800"}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
            <div className="mt-1 text-xs text-slate-400">{sub}</div>
        </Card>
    );
}
