import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Wallet, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function EducatorEarnings() {
    const [data, setData] = useState(null);

    useEffect(() => { (async () => {
        const { data: d } = await api.get("/educator/earnings");
        setData(d.data);
    })(); }, []);

    if (!data) return <DashboardLayout title="Earnings"><div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-800" /></div></DashboardLayout>;

    return (
        <DashboardLayout title="Earnings" subtitle="Revenue from your paid courses (estimated).">
            <div className="grid gap-4 md:grid-cols-3">
                <KPI icon={DollarSign} label="Gross revenue" value={`$${data.total_gross.toFixed(2)}`} />
                <KPI icon={Wallet} label="Your earnings (70%)" value={`$${data.total_net.toFixed(2)}`} accent="gold" />
                <KPI icon={TrendingUp} label="Platform fee" value={`${data.platform_fee_pct}%`} />
            </div>

            <Card className="mt-8 border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-5">
                    <h3 className="font-display text-base font-bold text-slate-900">Course revenue breakdown</h3>
                </div>
                {data.transactions.length === 0 ? (
                    <div className="p-12 text-center text-sm text-slate-500">
                        No revenue yet — all your courses are free or no enrollments.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Enrollments</TableHead>
                                <TableHead className="text-right">Gross</TableHead>
                                <TableHead className="text-right">Net</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.transactions.map((t) => (
                                <TableRow key={t.course_id} data-testid={`earn-row-${t.course_id}`}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <img src={t.thumbnail} className="h-9 w-12 rounded object-cover" alt="" />
                                            <div className="font-display font-semibold text-slate-900">{t.course_title}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">${Number(t.price).toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{t.enrollments}</TableCell>
                                    <TableCell className="text-right">${t.gross_revenue.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-semibold text-emerald-600">${t.net_revenue.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </DashboardLayout>
    );
}

function KPI({ icon: Icon, label, value, accent }) {
    return (
        <Card className="border-slate-200 bg-white p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent === "gold" ? "bg-gold-500/10 text-gold-600" : "bg-brand-50 text-brand-800"}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        </Card>
    );
}
