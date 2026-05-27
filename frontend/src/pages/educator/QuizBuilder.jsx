import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Loader2, ArrowLeft } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY_Q = () => ({ text: "", type: "SINGLE_CHOICE", points: 1, explanation: "", options: [{ text: "", is_correct: false }, { text: "", is_correct: false }] });

export default function QuizBuilder() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: "", instructions: "", passing_score: 60, time_limit: 0, attempts_allowed: 0, shuffle_questions: false, questions: [] });
    const [saving, setSaving] = useState(false);
    const [lessonTitle, setLessonTitle] = useState("");

    useEffect(() => { (async () => {
        try {
            const { data } = await api.get(`/quizzes/lesson/${lessonId}`);
            setForm({
                title: data.data.title, instructions: data.data.instructions || "",
                passing_score: data.data.passing_score, time_limit: data.data.time_limit,
                attempts_allowed: data.data.attempts_allowed, shuffle_questions: data.data.shuffle_questions,
                questions: data.data.questions,
            });
        } catch { /* no existing quiz */ }
    })(); }, [lessonId]);

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const updateQ = (qi, k, v) => setForm((p) => ({ ...p, questions: p.questions.map((q, i) => i === qi ? { ...q, [k]: v } : q) }));
    const updateOpt = (qi, oi, k, v) => setForm((p) => ({
        ...p, questions: p.questions.map((q, i) => i !== qi ? q : { ...q, options: q.options.map((o, j) => j === oi ? { ...o, [k]: v } : o) }),
    }));
    const addQ = () => setForm((p) => ({ ...p, questions: [...p.questions, EMPTY_Q()] }));
    const removeQ = (qi) => setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== qi) }));
    const addOpt = (qi) => setForm((p) => ({ ...p, questions: p.questions.map((q, i) => i !== qi ? q : { ...q, options: [...q.options, { text: "", is_correct: false }] }) }));
    const removeOpt = (qi, oi) => setForm((p) => ({ ...p, questions: p.questions.map((q, i) => i !== qi ? q : { ...q, options: q.options.filter((_, j) => j !== oi) }) }));

    const save = async () => {
        if (!form.title.trim() || form.questions.length === 0) {
            toast.error("Add a title and at least one question.");
            return;
        }
        setSaving(true);
        try {
            await api.post("/quizzes", { lesson_id: lessonId, ...form });
            toast.success("Quiz saved!");
            navigate(-1);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    return (
        <DashboardLayout
            title="Quiz Builder"
            subtitle={lessonTitle || `Lesson ${lessonId.slice(-6)}`}
            action={
                <Button onClick={save} disabled={saving} className="bg-brand-800 hover:bg-brand-900" data-testid="save-quiz-btn">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save quiz</>}
                </Button>
            }
        >
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>

            <Card className="border-slate-200 p-6 space-y-4">
                <Field label="Quiz title"><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="quiz-title-input" /></Field>
                <Field label="Instructions"><Textarea rows={2} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} /></Field>
                <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Passing score (%)"><Input type="number" value={form.passing_score} onChange={(e) => update("passing_score", parseInt(e.target.value) || 0)} /></Field>
                    <Field label="Time limit (min, 0 = none)"><Input type="number" value={form.time_limit} onChange={(e) => update("time_limit", parseInt(e.target.value) || 0)} /></Field>
                    <Field label="Attempts allowed (0 = unlimited)"><Input type="number" value={form.attempts_allowed} onChange={(e) => update("attempts_allowed", parseInt(e.target.value) || 0)} /></Field>
                </div>
            </Card>

            <div className="mt-8 mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-slate-900">Questions ({form.questions.length})</h2>
                <Button onClick={addQ} className="bg-gold-500 hover:bg-gold-600" data-testid="add-question-btn"><Plus className="mr-2 h-4 w-4" />Add question</Button>
            </div>

            <div className="space-y-4">
                {form.questions.length === 0 && (
                    <Card className="border-dashed border-slate-300 p-12 text-center">
                        <p className="text-sm text-slate-500">No questions yet. Click "Add question" to start.</p>
                    </Card>
                )}
                {form.questions.map((q, qi) => (
                    <Card key={qi} className="border-slate-200 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="text-xs uppercase tracking-wider text-slate-500">Question {qi + 1}</div>
                            <Button size="sm" variant="ghost" onClick={() => removeQ(qi)} data-testid={`remove-q-${qi}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                        <Textarea rows={2} className="mt-2" placeholder="Question text" value={q.text} onChange={(e) => updateQ(qi, "text", e.target.value)} data-testid={`q-text-${qi}`} />
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <Select value={q.type} onValueChange={(v) => updateQ(qi, "type", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SINGLE_CHOICE">Single choice</SelectItem>
                                    <SelectItem value="MULTIPLE_CHOICE">Multiple choice</SelectItem>
                                    <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="number" placeholder="Points" value={q.points} onChange={(e) => updateQ(qi, "points", parseInt(e.target.value) || 1)} />
                            <Input placeholder="Explanation (shown after submission)" value={q.explanation} onChange={(e) => updateQ(qi, "explanation", e.target.value)} />
                        </div>

                        <div className="mt-4 space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-slate-500">Options (check correct ones)</Label>
                            {q.options.map((o, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                    <Checkbox checked={o.is_correct} onCheckedChange={(v) => updateOpt(qi, oi, "is_correct", !!v)} data-testid={`q${qi}-opt${oi}-correct`} />
                                    <Input value={o.text} onChange={(e) => updateOpt(qi, oi, "text", e.target.value)} placeholder={`Option ${oi + 1}`} data-testid={`q${qi}-opt${oi}-text`} />
                                    <Button size="sm" variant="ghost" onClick={() => removeOpt(qi, oi)} disabled={q.options.length <= 2}>
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button size="sm" variant="outline" onClick={() => addOpt(qi)} data-testid={`add-opt-${qi}`}><Plus className="mr-1 h-3 w-3" />Add option</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </DashboardLayout>
    );
}

function Field({ label, children }) {
    return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
