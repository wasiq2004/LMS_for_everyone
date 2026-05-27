import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Loader2, ArrowLeft, CheckCircle2, FileIcon } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AssignmentView() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const [assignment, setAssignment] = useState(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]); // [{name, url, path, size}]
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const load = async () => {
        try {
            const { data } = await api.get(`/assignments/lesson/${lessonId}`);
            setAssignment(data.data);
            if (data.data.my_submission) {
                setText(data.data.my_submission.text_content || "");
                setFiles(data.data.my_submission.file_urls || []);
            }
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, [lessonId]);

    const onUpload = async (e) => {
        const list = Array.from(e.target.files || []);
        if (list.length === 0) return;
        setUploading(true);
        try {
            for (const f of list) {
                if (f.size > (assignment?.max_file_size_mb || 20) * 1024 * 1024) {
                    toast.error(`${f.name} exceeds size limit`);
                    continue;
                }
                const fd = new FormData();
                fd.append("file", f);
                const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
                setFiles((p) => [...p, data.data]);
            }
        } catch (err) { toast.error(formatApiError(err)); }
        finally { setUploading(false); e.target.value = ""; }
    };

    const removeFile = (idx) => setFiles((p) => p.filter((_, i) => i !== idx));

    const submit = async () => {
        setSubmitting(true);
        try {
            await api.post(`/assignments/${assignment.id}/submit`, { text_content: text, file_urls: files });
            toast.success("Assignment submitted!");
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSubmitting(false); }
    };

    if (!assignment) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-brand-800" /></div>;

    const sub = assignment.my_submission;
    const graded = sub && sub.status === "GRADED";

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-3xl px-6 py-10">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>

                <div className="text-xs font-semibold uppercase tracking-wider text-brand-800">Assignment</div>
                <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">{assignment.title}</h1>
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                    <Badge variant="secondary">Max score: {assignment.max_score}</Badge>
                    {assignment.due_date && <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>}
                </div>

                <Card className="mt-6 border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">Instructions</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{assignment.instructions}</p>
                </Card>

                {graded && (
                    <Card className="mt-4 border-emerald-200 bg-emerald-50 p-5">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <div className="flex-1">
                                <div className="font-display text-base font-bold text-slate-900">Graded: {sub.score} / {assignment.max_score}</div>
                                {sub.feedback && <p className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-700">💬 {sub.feedback}</p>}
                            </div>
                        </div>
                    </Card>
                )}

                <Card className="mt-4 border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">Your submission</h3>
                    <Textarea
                        rows={6}
                        className="mt-3"
                        placeholder="Paste your code, link, or written answer..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        data-testid="assignment-text"
                        disabled={graded}
                    />

                    <div className="mt-4">
                        <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-6 hover:bg-slate-50" data-testid="assignment-upload-zone">
                            <Upload className="h-6 w-6 text-slate-400" />
                            <span className="mt-2 text-sm text-slate-600">
                                {uploading ? "Uploading…" : "Click to upload files"}
                            </span>
                            <span className="mt-1 text-xs text-slate-400">
                                Max {assignment.max_file_size_mb}MB per file · Allowed: {(assignment.allowed_file_types || []).join(", ")}
                            </span>
                            <input
                                type="file"
                                multiple
                                hidden
                                onChange={onUpload}
                                disabled={graded || uploading}
                                data-testid="assignment-file-input"
                            />
                        </label>

                        {files.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {files.map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                        <FileIcon className="h-5 w-5 text-brand-800" />
                                        <a href={`${process.env.REACT_APP_BACKEND_URL}${f.url}`} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-slate-700 hover:underline">{f.name}</a>
                                        <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                                        {!graded && (
                                            <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500" data-testid={`remove-file-${i}`}>
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {!graded && (
                        <Button onClick={submit} disabled={submitting} className="mt-6 w-full bg-brand-800 hover:bg-brand-900" data-testid="assignment-submit-btn">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : sub ? "Update submission" : "Submit assignment"}
                        </Button>
                    )}
                </Card>

                {sub && !graded && (
                    <div className="mt-3 text-center text-xs text-slate-500">
                        Submitted on {new Date(sub.submitted_at).toLocaleString()} · waiting for instructor review
                    </div>
                )}
            </div>
        </div>
    );
}
