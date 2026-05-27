import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Megaphone, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function Announcements() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [courses, setCourses] = useState([]);
    const [form, setForm] = useState({ title: "", content: "", course_id: "PLATFORM" });
    const [posting, setPosting] = useState(false);

    const load = async () => {
        const { data } = await api.get("/announcements");
        setItems(data.data);
        if (user?.role === "EDUCATOR" || user?.role === "ADMIN") {
            const { data: cs } = await api.get("/courses/my-courses");
            setCourses(cs.data);
        }
    };
    useEffect(() => { load(); }, [user]);

    const post = async () => {
        if (!form.title || !form.content) return toast.error("Title & content required");
        setPosting(true);
        try {
            await api.post("/announcements", {
                title: form.title, content: form.content,
                course_id: form.course_id === "PLATFORM" ? null : form.course_id,
            });
            setForm({ title: "", content: "", course_id: "PLATFORM" });
            await load();
            toast.success("Announcement posted!");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setPosting(false); }
    };

    const remove = async (id) => {
        if (!confirm("Delete announcement?")) return;
        try { await api.delete(`/announcements/${id}`); await load(); } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <DashboardLayout title="Announcements" subtitle="Broadcast updates to your students.">
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="border-slate-200 p-6 lg:col-span-1 h-fit">
                    <h3 className="font-display text-base font-bold text-slate-900">New announcement</h3>
                    <div className="mt-4 space-y-3">
                        <div>
                            <Label>Audience</Label>
                            <Select value={form.course_id} onValueChange={(v) => setForm((p) => ({ ...p, course_id: v }))}>
                                <SelectTrigger className="mt-1" data-testid="audience-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {user?.role === "ADMIN" && <SelectItem value="PLATFORM">Platform-wide</SelectItem>}
                                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Title</Label>
                            <Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} data-testid="ann-title-input" />
                        </div>
                        <div>
                            <Label>Content</Label>
                            <Textarea className="mt-1" rows={5} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} data-testid="ann-content-input" />
                        </div>
                        <Button onClick={post} disabled={posting} className="w-full bg-brand-800 hover:bg-brand-900" data-testid="post-ann-btn">
                            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" />Publish</>}
                        </Button>
                    </div>
                </Card>

                <div className="lg:col-span-2">
                    <h3 className="mb-4 font-display text-base font-bold text-slate-900">Recent announcements</h3>
                    {items.length === 0 ? (
                        <Card className="border-dashed border-slate-300 p-12 text-center">
                            <Megaphone className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-slate-500">No announcements yet.</p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {items.map((a) => (
                                <Card key={a.id} className="border-slate-200 p-5" data-testid={`ann-${a.id}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <h4 className="font-display text-base font-bold text-slate-900">{a.title}</h4>
                                            <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{a.content}</p>
                                            <div className="mt-3 text-xs text-slate-500">
                                                {a.author?.first_name} {a.author?.last_name} · {new Date(a.created_at).toLocaleDateString()}
                                                {!a.course_id && <span className="ml-2 inline-flex rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Platform</span>}
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
