import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, ArrowLeft, FileIcon, CheckCircle2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
    title: "", instructions: "", max_score: 100, due_date: "",
    allowed_file_types: ["pdf", "doc", "docx", "txt", "png", "jpg", "zip"],
    max_file_size_mb: 20,
};

export default function AssignmentBuilder() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY);
    const [assignmentId, setAssignmentId] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [gradeState, setGradeState] = useState({}); // sid -> {score, feedback, saving}

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const loadExisting = async () => {
        try {
            const { data } = await api.get(`/assignments/lesson/${lessonId}`);
            setForm({
                title: data.data.title, instructions: data.data.instructions || "",
                max_score: data.data.max_score, due_date: data.data.due_date || "",
                allowed_file_types: data.data.allowed_file_types || EMPTY.allowed_file_types,
                max_file_size_mb: data.data.max_file_size_mb,
            });
            setAssignmentId(data.data.id);
            const { data: subs } = await api.get(`/assignments/${data.data.id}/submissions`);
            setSubmissions(subs.data);
        } catch { /* no existing */ }
    };

    useEffect(() => { loadExisting(); }, [lessonId]);

    const save = async () => {
        if (!form.title.trim()) return toast.error("Title required");
        setSaving(true);
        try {
            const { data } = await api.post("/assignments", { lesson_id: lessonId, ...form });
            setAssignmentId(data.data.id);
            toast.success("Saved");
            await loadExisting();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    const setGrade = (sid, patch) => setGradeState((p) => ({ ...p, [sid]: { ...p[sid], ...patch } }));

    const grade = async (sid) => {
        const g = gradeState[sid] || {};
        if (g.score == null || g.score === "") return toast.error("Enter a score");
        setGrade(sid, { saving: true });
        try {
            await api.patch(`/assignments/submissions/${sid}/grade`, {
                score: parseInt(g.score, 10), feedback: g.feedback || "",
            });
            toast.success("Graded!");
            await loadExisting();
            setGrade(sid, { saving: false });
        } catch (e) { toast.error(formatApiError(e)); setGrade(sid, { saving: false }); }
    };

    return (
        <DashboardLayout
            title="Assignment Builder"
            subtitle={form.title || "Configure assignment & grade submissions"}
            action={
                <Button onClick={save} disabled={saving} className="bg-brand-800 hover:bg-brand-900" data-testid="save-assignment-btn">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
                </Button>
            }
        >
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-slate-200 p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-slate-900">Configuration</h3>
                    <Field label="Title"><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="assignment-title-input" /></Field>
                    <Field label="Instructions"><Textarea rows={5} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} data-testid="assignment-instructions" /></Field>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Max score"><Input type="number" value={form.max_score} onChange={(e) => update("max_score", parseInt(e.target.value) || 0)} /></Field>
                        <Field label="Max file size (MB)"><Input type="number" value={form.max_file_size_mb} onChange={(e) => update("max_file_size_mb", parseInt(e.target.value) || 0)} /></Field>
                    </div>
                </Card>

                <Card className="border-slate-200 p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">Submissions ({submissions.length})</h3>
                    {!assignmentId ? (
                        <p className="mt-3 text-sm text-slate-500">Save the assignment first to enable grading.</p>
                    ) : submissions.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No submissions yet.</p>
                    ) : (
                        <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                            {submissions.map((s) => {
                                const g = gradeState[s.id] || { score: s.score ?? "", feedback: s.feedback ?? "" };
                                const isGraded = s.status === "GRADED";
                                return (
                                    <div key={s.id} className="rounded-xl border border-slate-200 p-4" data-testid={`submission-${s.id}`}>
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-9 w-9"><AvatarFallback className="bg-brand-800 text-xs text-white">{s.user?.first_name?.[0]}</AvatarFallback></Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-display text-sm font-semibold text-slate-900">{s.user?.first_name} {s.user?.last_name}</div>
                                                    {isGraded
                                                        ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />{s.score}/{form.max_score}</Badge>
                                                        : <Badge variant="secondary" className="bg-gold-500/10 text-gold-700">Pending</Badge>}
                                                </div>
                                                <div className="text-xs text-slate-500">{s.user?.email}</div>
                                                {s.text_content && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-line line-clamp-6">{s.text_content}</p>}
                                                {(s.file_urls || []).length > 0 && (
                                                    <ul className="mt-2 space-y-1 text-xs">
                                                        {s.file_urls.map((f, i) => (
                                                            <li key={i}>
                                                                <a target="_blank" rel="noreferrer" href={`${process.env.REACT_APP_BACKEND_URL}${f.url}`} className="inline-flex items-center gap-1 text-brand-800 hover:underline">
                                                                    <FileIcon className="h-3 w-3" />{f.name}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}

                                                <div className="mt-3 grid gap-2 md:grid-cols-[100px_1fr_auto]">
                                                    <Input
                                                        type="number" placeholder="Score"
                                                        value={g.score ?? ""}
                                                        onChange={(e) => setGrade(s.id, { score: e.target.value })}
                                                        data-testid={`grade-score-${s.id}`}
                                                    />
                                                    <Input
                                                        placeholder="Feedback (optional)"
                                                        value={g.feedback ?? ""}
                                                        onChange={(e) => setGrade(s.id, { feedback: e.target.value })}
                                                        data-testid={`grade-feedback-${s.id}`}
                                                    />
                                                    <Button size="sm" onClick={() => grade(s.id)} disabled={g.saving} className="bg-brand-800 hover:bg-brand-900" data-testid={`grade-btn-${s.id}`}>
                                                        {g.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Grade"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
}

function Field({ label, children }) {
    return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
