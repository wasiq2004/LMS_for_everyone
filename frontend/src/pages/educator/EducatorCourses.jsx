import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function EducatorCourses() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/courses/my-courses");
            setCourses(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const togglePublish = async (id) => {
        try {
            await api.patch(`/courses/${id}/publish`);
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <DashboardLayout
            title="My Courses"
            subtitle="Manage and grow your course catalog."
            action={<Link to="/educator/courses/new"><Button className="bg-brand-800 hover:bg-brand-900" data-testid="new-course-btn"><Plus className="mr-2 h-4 w-4" />Create course</Button></Link>}
        >
            <Card className="border-slate-200">
                {loading ? (
                    <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-800" /></div>
                ) : courses.length === 0 ? (
                    <div className="p-16 text-center">
                        <h3 className="font-display text-lg font-bold text-slate-900">No courses yet</h3>
                        <p className="mt-1 text-sm text-slate-500">Create your first course in under 5 minutes.</p>
                        <Link to="/educator/courses/new"><Button className="mt-4 bg-brand-800 hover:bg-brand-900" data-testid="first-course-cta"><Plus className="mr-2 h-4 w-4" />Create course</Button></Link>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Enrollments</TableHead>
                                <TableHead className="text-right">Rating</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {courses.map((c) => (
                                <TableRow key={c.id} data-testid={`edu-course-row-${c.id}`}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <img src={c.thumbnail} className="h-10 w-14 rounded object-cover" alt="" />
                                            <div>
                                                <div className="font-display font-semibold text-slate-900">{c.title}</div>
                                                <div className="text-xs text-slate-500">{c.level?.replace("_", " ")}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={c.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}>
                                            {c.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{c.total_enrollments || 0}</TableCell>
                                    <TableCell className="text-right">{(c.average_rating || 0).toFixed(1)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link to={`/educator/courses/${c.id}/edit`}>
                                                <Button size="sm" variant="outline" data-testid={`edit-${c.id}`}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                                            </Link>
                                            <Button size="sm" variant="ghost" onClick={() => togglePublish(c.id)} data-testid={`toggle-${c.id}`}>
                                                {c.status === "PUBLISHED" ? <><ToggleRight className="mr-1 h-4 w-4" />Unpublish</> : <><ToggleLeft className="mr-1 h-4 w-4" />Publish</>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </DashboardLayout>
    );
}
