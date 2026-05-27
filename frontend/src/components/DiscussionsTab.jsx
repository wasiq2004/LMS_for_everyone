import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, MessageSquare, Pin, CheckCircle2, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function DiscussionsTab({ courseId, lessonId }) {
    const { user } = useAuth();
    const [threads, setThreads] = useState([]);
    const [content, setContent] = useState("");
    const [title, setTitle] = useState("");
    const [posting, setPosting] = useState(false);
    const [openThread, setOpenThread] = useState(null);

    const load = async () => {
        const qs = new URLSearchParams();
        if (courseId) qs.set("course_id", courseId);
        if (lessonId) qs.set("lesson_id", lessonId);
        const { data } = await api.get(`/discussions?${qs.toString()}`);
        setThreads(data.data);
    };

    useEffect(() => { load(); }, [courseId, lessonId]);

    const post = async () => {
        if (!content.trim()) return;
        setPosting(true);
        try {
            await api.post("/discussions", { course_id: courseId, lesson_id: lessonId, title: title || null, content });
            setContent(""); setTitle("");
            await load();
            toast.success("Posted!");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setPosting(false); }
    };

    const upvote = async (id) => {
        try {
            const { data } = await api.post(`/discussions/${id}/upvote`);
            setThreads((p) => p.map((t) => t.id === id ? { ...t, upvotes: data.data.upvotes } : t));
        } catch (e) { toast.error(formatApiError(e)); }
    };

    if (openThread) return <ThreadDetail threadId={openThread} onBack={() => { setOpenThread(null); load(); }} />;

    return (
        <div className="space-y-4">
            {user && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <input
                        className="w-full border-0 px-0 py-1 font-display text-base font-semibold outline-none placeholder:text-slate-400"
                        placeholder="Add a title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        data-testid="discussion-title-input"
                    />
                    <Textarea
                        rows={3}
                        className="mt-2 border-slate-200"
                        placeholder="Ask a question or share something..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        data-testid="discussion-content-input"
                    />
                    <Button onClick={post} disabled={posting} className="mt-2 bg-brand-800 hover:bg-brand-900" data-testid="post-discussion-btn">
                        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                    </Button>
                </div>
            )}

            {threads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                    No discussions yet. Be the first to start one!
                </div>
            ) : (
                threads.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setOpenThread(t.id)}
                        data-testid={`thread-${t.id}`}
                        className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    >
                        <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={t.author?.avatar} />
                                <AvatarFallback className="bg-brand-800 text-xs text-white">{t.author?.first_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    {t.is_pinned && <Pin className="h-3 w-3 text-gold-500" />}
                                    {t.is_resolved && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />Resolved</Badge>}
                                    <div className="text-sm font-semibold text-slate-900">{t.author?.first_name} {t.author?.last_name}</div>
                                    {t.author?.role !== "STUDENT" && (
                                        <Badge variant="secondary" className="bg-brand-50 text-brand-800">{t.author?.role}</Badge>
                                    )}
                                </div>
                                {t.title && <div className="mt-1 font-display font-semibold text-slate-900">{t.title}</div>}
                                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{t.content}</p>
                                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                                    <span
                                        role="button"
                                        onClick={(e) => { e.stopPropagation(); upvote(t.id); }}
                                        className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100"
                                        data-testid={`upvote-${t.id}`}
                                    >
                                        <ThumbsUp className="h-3.5 w-3.5" />{t.upvotes || 0}
                                    </span>
                                    <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{t.reply_count || 0}</span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    );
}

function ThreadDetail({ threadId, onBack }) {
    const { user } = useAuth();
    const [thread, setThread] = useState(null);
    const [reply, setReply] = useState("");
    const [posting, setPosting] = useState(false);

    const load = async () => {
        const { data } = await api.get(`/discussions/${threadId}`);
        setThread(data.data);
    };

    useEffect(() => { load(); }, [threadId]);

    const post = async () => {
        if (!reply.trim()) return;
        setPosting(true);
        try {
            await api.post("/discussions", { course_id: thread.course_id, parent_id: threadId, content: reply });
            setReply("");
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setPosting(false); }
    };

    if (!thread) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-800" />;

    return (
        <div>
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-3" data-testid="back-to-threads">← Back to discussions</Button>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={thread.author?.avatar} />
                        <AvatarFallback className="bg-brand-800 text-white">{thread.author?.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{thread.author?.first_name} {thread.author?.last_name}</div>
                        {thread.title && <h3 className="mt-1 font-display text-lg font-bold text-slate-900">{thread.title}</h3>}
                        <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{thread.content}</p>
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-3 pl-8 border-l-2 border-slate-200">
                {(thread.replies || []).map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={r.author?.avatar} />
                                <AvatarFallback className="bg-slate-200 text-xs">{r.author?.first_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900">{r.author?.first_name} {r.author?.last_name}
                                    {r.author?.role !== "STUDENT" && <Badge variant="secondary" className="ml-2 bg-brand-50 text-brand-800">{r.author?.role}</Badge>}
                                </div>
                                <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{r.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {user && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <Textarea rows={3} placeholder="Write a reply..." value={reply} onChange={(e) => setReply(e.target.value)} data-testid="reply-input" />
                    <Button onClick={post} disabled={posting} className="mt-2 bg-brand-800 hover:bg-brand-900" data-testid="post-reply-btn">
                        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post reply"}
                    </Button>
                </div>
            )}
        </div>
    );
}
