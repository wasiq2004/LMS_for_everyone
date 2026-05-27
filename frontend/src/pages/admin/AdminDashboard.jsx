import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Users, BookOpen, Award, DollarSign, Loader2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import api from "@/lib/api";

const REVENUE_DATA = [
    { month: "Sep", revenue: 1200 }, { month: "Oct", revenue: 1900 },
    { month: "Nov", revenue: 2200 }, { month: "Dec", revenue: 1850 },
    { month: "Jan", revenue: 2900 }, { month: "Feb", revenue: 3700 },
];

const PIE_COLORS = ["#1e40af", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);

    useEffect(() => { (async () => {
        const { data } = await api.get("/admin/dashboard");
        setStats(data.data);
    })(); }, []);

    if (!stats) return <DashboardLayout title="Loading..."><Loader2 className="h-8 w-8 animate-spin text-brand-800" /></DashboardLayout>;

    const categoryPie = stats.top_courses?.reduce((acc, c) => {
        const name = c.category?.name || "Uncategorized";
        const found = acc.find((a) => a.name === name);
        if (found) found.value += c.total_enrollments || 0;
        else acc.push({ name, value: c.total_enrollments || 1 });
        return acc;
    }, []) || [];

    return (
        <DashboardLayout title="Admin Console" subtitle="Platform health and key metrics at a glance.">
            <div className="grid gap-4 md:grid-cols-4">
                <KPI icon={Users} label="Total Users" value={stats.total_users} sub={`${stats.total_students} students · ${stats.total_educators} educators`} />
                <KPI icon={BookOpen} label="Courses" value={stats.total_courses} sub={`${stats.published_courses} published`} />
                <KPI icon={Award} label="Enrollments" value={stats.total_enrollments} sub="All-time" />
                <KPI icon={DollarSign} label="Est. Revenue" value={`$${stats.revenue_estimate.toLocaleString()}`} sub="Lifetime" accent="gold" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <Card className="border-slate-200 bg-white p-6 lg:col-span-2">
                    <h3 className="font-display text-base font-bold text-slate-900">Revenue trend</h3>
                    <p className="text-xs text-slate-500">Last 6 months (estimated)</p>
                    <div className="mt-5 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={REVENUE_DATA}>
                                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="revenue" fill="#1e40af" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">Enrollments by category</h3>
                    <p className="text-xs text-slate-500">Top categories</p>
                    <div className="mt-5 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                                    {categoryPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <Card className="mt-8 border-slate-200 bg-white p-6">
                <h3 className="font-display text-base font-bold text-slate-900">Top courses</h3>
                <div className="mt-5 space-y-2">
                    {stats.top_courses.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                            <img src={c.thumbnail} className="h-12 w-16 rounded object-cover" alt="" />
                            <div className="flex-1">
                                <div className="font-display font-semibold text-slate-900">{c.title}</div>
                                <div className="text-xs text-slate-500">{c.category?.name} · {c.total_enrollments} enrolled</div>
                            </div>
                            <div className="text-sm font-bold text-brand-800">
                                {c.is_free ? "Free" : `$${Number(c.price).toFixed(2)}`}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </DashboardLayout>
    );
}

function KPI({ icon: Icon, label, value, sub, accent }) {
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
