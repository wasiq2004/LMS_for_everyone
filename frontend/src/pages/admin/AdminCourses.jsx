import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";

export default function AdminCourses() {
    const [courses, setCourses] = useState([]);
    const [status, setStatus] = useState("");

    const load = async () => {
        const qs = new URLSearchParams();
        if (status) qs.set("status", status);
        const { data } = await api.get(`/admin/courses?${qs.toString()}`);
        setCourses(data.data);
    };

    useEffect(() => { load(); }, [status]);

    return (
        <DashboardLayout title="Course Management" subtitle="Approve, feature, and moderate courses.">
            <Card className="border-slate-200 bg-white">
                <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                    <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-44" data-testid="status-filter"><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="PUBLISHED">Published</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Educator</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Enrollments</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {courses.map((c) => (
                            <TableRow key={c.id} data-testid={`admin-course-${c.id}`}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <img src={c.thumbnail} className="h-9 w-12 rounded object-cover" alt="" />
                                        <div className="font-display font-semibold text-slate-900">{c.title}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-600">{c.educator?.first_name} {c.educator?.last_name}</TableCell>
                                <TableCell className="text-slate-600">{c.category?.name}</TableCell>
                                <TableCell>
                                    <Badge className={c.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                                        {c.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">{c.total_enrollments || 0}</TableCell>
                                <TableCell className="text-right">{(c.average_rating || 0).toFixed(1)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </DashboardLayout>
    );
}
