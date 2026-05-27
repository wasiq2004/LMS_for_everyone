import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileBarChart } from "lucide-react";
import api from "@/lib/api";

export default function AdminReports() {
    const [data, setData] = useState(null);

    useEffect(() => { (async () => {
        const { data: d } = await api.get("/admin/reports/overview");
        setData(d.data);
    })(); }, []);

    const downloadCsv = () => {
        if (!data) return;
        const headers = ["title", "enrollments", "completed", "rating", "revenue_estimate"];
        const rows = [headers.join(",")];
        data.courses.forEach((c) => {
            rows.push([JSON.stringify(c.title), c.enrollments, c.completed, c.rating.toFixed(2), c.revenue_estimate.toFixed(2)].join(","));
        });
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "course_report.csv"; a.click();
    };

    return (
        <DashboardLayout
            title="Reports"
            subtitle="Course performance overview."
            action={data && <Button onClick={downloadCsv} variant="outline" data-testid="export-csv-btn"><Download className="mr-2 h-4 w-4" />Export CSV</Button>}
        >
            <Card className="border-slate-200 bg-white">
                {!data ? (
                    <div className="p-12 text-center text-sm text-slate-500">Loading report…</div>
                ) : data.courses.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileBarChart className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm text-slate-500">No published courses yet.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead className="text-right">Enrollments</TableHead>
                                <TableHead className="text-right">Completed</TableHead>
                                <TableHead className="text-right">Completion %</TableHead>
                                <TableHead className="text-right">Rating</TableHead>
                                <TableHead className="text-right">Revenue est.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.courses.map((c) => (
                                <TableRow key={c.id} data-testid={`report-row-${c.id}`}>
                                    <TableCell className="font-display font-semibold text-slate-900">{c.title}</TableCell>
                                    <TableCell className="text-right">{c.enrollments}</TableCell>
                                    <TableCell className="text-right">{c.completed}</TableCell>
                                    <TableCell className="text-right">{c.enrollments ? Math.round((c.completed / c.enrollments) * 100) : 0}%</TableCell>
                                    <TableCell className="text-right">{c.rating.toFixed(1)}</TableCell>
                                    <TableCell className="text-right font-semibold text-brand-800">${c.revenue_estimate.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </DashboardLayout>
    );
}
