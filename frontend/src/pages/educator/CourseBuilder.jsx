import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, Loader2, Save } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
    title: "", short_description: "", description: "", thumbnail: "",
    preview_video_url: "", price: 0, is_free: true, level: "BEGINNER",
    language: "English", category_id: null, tags: [], requirements: [], outcomes: [],
    estimated_duration: 0,
};

export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);
    const [form, setForm] = useState(EMPTY);
    const [categories, setCategories] = useState([]);
    const [course, setCourse] = useState(null); // full course w/ sections
    const [saving, setSaving] = useState(false);
    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    useEffect(() => { (async () => {
        const { data: cats } = await api.get("/categories");
        setCategories(cats.data);
        if (isEdit) {
            const { data } = await api.get(`/courses/${id}`);
            const c = data.data;
            setCourse(c);
            setForm({
                title: c.title, short_description: c.short_description, description: c.description,
                thumbnail: c.thumbnail, preview_video_url: c.preview_video_url, price: c.price,
                is_free: c.is_free, level: c.level, language: c.language, category_id: c.category?.id || null,
                tags: c.tags || [], requirements: c.requirements || [], outcomes: c.outcomes || [],
                estimated_duration: c.estimated_duration,
            });
        }
    })(); }, [id, isEdit]);

    const save = async () => {
        setSaving(true);
        try {
            if (isEdit) {
                await api.patch(`/courses/${id}`, form);
                toast.success("Course updated!");
            } else {
                const { data } = await api.post("/courses", form);
                toast.success("Course created!");
                navigate(`/educator/courses/${data.data.id}/edit`);
            }
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    const addSection = async () => {
        const title = prompt("Section title:");
        if (!title) return;
        try {
            await api.post(`/courses/${id}/sections`, { title, order: (course?.sections?.length || 0), description: "" });
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const addLesson = async (sectionId) => {
        const title = prompt("Lesson title:");
        if (!title) return;
        const video_url = prompt("YouTube URL (paste full URL):", "https://www.youtube.com/embed/Tn6-PIqc4UM") || "";
        try {
            await api.post(`/sections/${sectionId}/lessons`, {
                title, type: "VIDEO", video_url, video_provider: "YOUTUBE", duration: 10, content: "",
            });
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const deleteSection = async (sectionId) => {
        if (!confirm("Delete this section and its lessons?")) return;
        try {
            await api.delete(`/sections/${sectionId}`);
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const deleteLesson = async (lessonId) => {
        try {
            await api.delete(`/lessons/${lessonId}`);
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const togglePublish = async () => {
        try {
            await api.patch(`/courses/${id}/publish`);
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
            toast.success("Status updated!");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <DashboardLayout
            title={isEdit ? "Edit course" : "Create course"}
            subtitle={isEdit ? course?.title : "Define your course details and curriculum."}
            action={
                <div className="flex gap-2">
                    {isEdit && (
                        <Button variant="outline" onClick={togglePublish} data-testid="publish-toggle">
                            {course?.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </Button>
                    )}
                    <Button onClick={save} disabled={saving} className="bg-brand-800 hover:bg-brand-900" data-testid="save-course-btn">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
                    </Button>
                </div>
            }
        >
            <Tabs defaultValue="basics">
                <TabsList>
                    <TabsTrigger value="basics" data-testid="tab-basics">Basics</TabsTrigger>
                    <TabsTrigger value="curriculum" disabled={!isEdit} data-testid="tab-curriculum">Curriculum</TabsTrigger>
                    <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
                </TabsList>

                <TabsContent value="basics" className="mt-6">
                    <Card className="border-slate-200 bg-white p-6 space-y-5">
                        <Field label="Title">
                            <Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="course-title-input" />
                        </Field>
                        <Field label="Short description">
                            <Input value={form.short_description} onChange={(e) => update("short_description", e.target.value)} data-testid="course-short-desc" />
                        </Field>
                        <Field label="Description">
                            <Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} data-testid="course-description" />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Category">
                                <Select value={form.category_id || ""} onValueChange={(v) => update("category_id", v)}>
                                    <SelectTrigger data-testid="course-category"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Level">
                                <Select value={form.level} onValueChange={(v) => update("level", v)}>
                                    <SelectTrigger data-testid="course-level"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BEGINNER">Beginner</SelectItem>
                                        <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                                        <SelectItem value="ADVANCED">Advanced</SelectItem>
                                        <SelectItem value="ALL_LEVELS">All Levels</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Language">
                                <Input value={form.language} onChange={(e) => update("language", e.target.value)} />
                            </Field>
                        </div>
                        <Field label="Thumbnail URL">
                            <Input value={form.thumbnail} onChange={(e) => update("thumbnail", e.target.value)} placeholder="https://..." />
                        </Field>
                        <Field label="Preview video URL (YouTube)">
                            <Input value={form.preview_video_url} onChange={(e) => update("preview_video_url", e.target.value)} />
                        </Field>
                    </Card>
                </TabsContent>

                <TabsContent value="curriculum" className="mt-6">
                    <Card className="border-slate-200 bg-white p-6">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="font-display text-lg font-bold text-slate-900">Sections & Lessons</h3>
                            <Button onClick={addSection} className="bg-brand-800 hover:bg-brand-900" data-testid="add-section-btn">
                                <Plus className="mr-2 h-4 w-4" />Add section
                            </Button>
                        </div>
                        {(!course?.sections || course.sections.length === 0) ? (
                            <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No sections yet. Add one to get started.</p>
                        ) : (
                            <div className="space-y-4">
                                {course.sections.map((s, i) => (
                                    <Card key={s.id} className="border-slate-200 p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs uppercase tracking-wider text-slate-500">Section {i + 1}</div>
                                                <div className="font-display font-semibold text-slate-900">{s.title}</div>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => deleteSection(s.id)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                        <ul className="mt-3 space-y-1.5">
                                            {(s.lessons || []).map((l) => (
                                                <li key={l.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                                                    <span className="text-slate-700">
                                                        {l.title}
                                                        {l.type === "QUIZ" && <span className="ml-2 inline-flex rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Quiz</span>}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/educator/quiz/${l.id}`)}
                                                            className="text-xs font-medium text-brand-800 hover:underline"
                                                            data-testid={`build-quiz-${l.id}`}
                                                        >
                                                            {l.type === "QUIZ" ? "Edit quiz" : "Add quiz"}
                                                        </button>
                                                        <button onClick={() => deleteLesson(l.id)} className="text-slate-400 hover:text-red-500">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                        <Button size="sm" variant="outline" className="mt-3" onClick={() => addLesson(s.id)} data-testid={`add-lesson-${s.id}`}>
                                            <Plus className="mr-1 h-3 w-3" />Add lesson
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="pricing" className="mt-6">
                    <Card className="border-slate-200 bg-white p-6 space-y-5">
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                            <div>
                                <div className="font-display font-semibold text-slate-900">Free course</div>
                                <div className="text-xs text-slate-500">Anyone can enroll without paying.</div>
                            </div>
                            <Switch checked={form.is_free} onCheckedChange={(v) => update("is_free", v)} data-testid="is-free-switch" />
                        </div>
                        {!form.is_free && (
                            <Field label="Price (USD)">
                                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", parseFloat(e.target.value) || 0)} />
                            </Field>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}

function Field({ label, children }) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-900">{label}</Label>
            {children}
        </div>
    );
}
