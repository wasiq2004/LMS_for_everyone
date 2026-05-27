import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle2, XCircle, ArrowLeft, Trophy, RotateCcw } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function QuizView() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [started, setStarted] = useState(false);
    const [answers, setAnswers] = useState({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => { (async () => {
        try {
            const { data } = await api.get(`/quizzes/lesson/${lessonId}`);
            setQuiz(data.data);
            if (data.data.time_limit > 0) setTimeLeft(data.data.time_limit * 60);
        } catch (e) { toast.error(formatApiError(e)); }
    })(); }, [lessonId]);

    useEffect(() => {
        if (!started || timeLeft <= 0 || result) return;
        const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
        return () => clearInterval(t);
    }, [started, timeLeft, result]);

    useEffect(() => {
        if (started && quiz?.time_limit > 0 && timeLeft === 0 && !result) {
            submit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, started]);

    if (!quiz) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-brand-800" /></div>;
    }

    const toggleAnswer = (qIdx, optIdx, multi) => {
        setAnswers((p) => {
            const arr = p[qIdx] || [];
            if (multi) {
                return { ...p, [qIdx]: arr.includes(optIdx) ? arr.filter((x) => x !== optIdx) : [...arr, optIdx] };
            }
            return { ...p, [qIdx]: [optIdx] };
        });
    };

    const submit = async () => {
        setSubmitting(true);
        try {
            const { data } = await api.post(`/quizzes/${quiz.id}/submit`, { answers, time_spent: quiz.time_limit * 60 - timeLeft });
            setResult(data.data);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSubmitting(false); }
    };

    const fmtTime = (s) => {
        const m = Math.floor(s / 60), sec = s % 60;
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    if (!started) {
        return (
            <div className="min-h-screen bg-slate-50 py-16">
                <div className="mx-auto max-w-2xl px-6">
                    <Link to={-1} onClick={(e) => { e.preventDefault(); navigate(-1); }} className="inline-flex items-center text-sm text-slate-500 hover:text-brand-800">
                        <ArrowLeft className="mr-1 h-4 w-4" />Back
                    </Link>
                    <Card className="mt-4 border-slate-200 p-10">
                        <div className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-800">Quiz</div>
                        <h1 className="mt-4 font-display text-3xl font-bold text-slate-900">{quiz.title}</h1>
                        <p className="mt-3 text-slate-600">{quiz.instructions}</p>
                        <div className="mt-6 grid grid-cols-3 gap-4">
                            <Stat label="Questions" value={quiz.questions.length} />
                            <Stat label="Passing" value={`${quiz.passing_score}%`} />
                            <Stat label="Time" value={quiz.time_limit > 0 ? `${quiz.time_limit}m` : "∞"} />
                        </div>
                        <Button onClick={() => setStarted(true)} className="mt-8 w-full bg-brand-800 hover:bg-brand-900" data-testid="start-quiz-btn">
                            Start quiz
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    if (result) {
        return (
            <div className="min-h-screen bg-slate-50 py-12">
                <div className="mx-auto max-w-3xl px-6">
                    <Card className={`border-slate-200 p-10 text-center ${result.is_passed ? "" : ""}`}>
                        <div className={`mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full ${result.is_passed ? "bg-emerald-100" : "bg-red-100"}`}>
                            {result.is_passed ? <Trophy className="h-10 w-10 text-emerald-600" /> : <XCircle className="h-10 w-10 text-red-600" />}
                        </div>
                        <h2 className="mt-4 font-display text-3xl font-bold text-slate-900">{result.is_passed ? "You passed!" : "Not quite there yet"}</h2>
                        <div className="mt-2 font-display text-5xl font-bold text-brand-800">{Math.round(result.score)}%</div>
                        <p className="mt-2 text-slate-600">{result.earned_points} / {result.total_points} points</p>
                        <div className="mt-4 flex justify-center gap-3">
                            <Button variant="outline" onClick={() => { setResult(null); setStarted(false); setAnswers({}); setCurrentIdx(0); }} data-testid="retake-quiz-btn">
                                <RotateCcw className="mr-2 h-4 w-4" />Retake
                            </Button>
                            <Button onClick={() => navigate(-1)} className="bg-brand-800 hover:bg-brand-900" data-testid="back-to-course-btn">Back to course</Button>
                        </div>
                    </Card>

                    <h3 className="mt-10 font-display text-xl font-bold text-slate-900">Review answers</h3>
                    <div className="mt-4 space-y-4">
                        {result.breakdown.map((b, i) => (
                            <Card key={i} className={`border p-5 ${b.is_correct ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}`}>
                                <div className="flex items-start gap-2">
                                    {b.is_correct ? <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" /> : <XCircle className="mt-1 h-5 w-5 text-red-600" />}
                                    <div className="flex-1">
                                        <div className="font-display font-semibold text-slate-900">{i + 1}. {b.question_text}</div>
                                        <ul className="mt-2 space-y-1 text-sm">
                                            {b.options.map((o, oi) => (
                                                <li key={oi} className={`rounded px-2 py-1 ${b.correct.includes(oi) ? "bg-emerald-100 text-emerald-800 font-medium" : b.submitted.includes(oi) ? "bg-red-100 text-red-800" : "text-slate-600"}`}>
                                                    {o.text}
                                                </li>
                                            ))}
                                        </ul>
                                        {b.explanation && <p className="mt-2 rounded bg-white p-2 text-xs italic text-slate-600">💡 {b.explanation}</p>}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const q = quiz.questions[currentIdx];
    const multi = q.type === "MULTIPLE_CHOICE";
    const selected = answers[currentIdx] || [];

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
                    <div>
                        <h1 className="font-display text-lg font-bold text-slate-900">{quiz.title}</h1>
                        <div className="text-xs text-slate-500">Question {currentIdx + 1} of {quiz.questions.length}</div>
                    </div>
                    {quiz.time_limit > 0 && (
                        <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono font-semibold ${timeLeft < 30 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`} data-testid="quiz-timer">
                            <Clock className="h-4 w-4" />{fmtTime(timeLeft)}
                        </div>
                    )}
                </div>
                <Progress value={((currentIdx + 1) / quiz.questions.length) * 100} className="h-1 rounded-none" />
            </header>

            <div className="mx-auto max-w-3xl px-6 py-10">
                <Card className="border-slate-200 p-8">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Question {currentIdx + 1}</div>
                    <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">{q.text}</h2>
                    {multi && <p className="mt-1 text-xs text-slate-500">(Select all that apply)</p>}

                    <div className="mt-6 space-y-2">
                        {q.options.map((o, oi) => (
                            <label
                                key={oi}
                                data-testid={`quiz-option-${oi}`}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all ${selected.includes(oi) ? "border-brand-800 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}
                                onClick={() => toggleAnswer(currentIdx, oi, multi)}
                            >
                                {multi ? (
                                    <Checkbox checked={selected.includes(oi)} onCheckedChange={() => toggleAnswer(currentIdx, oi, multi)} />
                                ) : (
                                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected.includes(oi) ? "border-brand-800 bg-brand-800" : "border-slate-300"}`}>
                                        {selected.includes(oi) && <div className="h-2 w-2 rounded-full bg-white" />}
                                    </div>
                                )}
                                <span className="text-sm text-slate-800">{o.text}</span>
                            </label>
                        ))}
                    </div>
                </Card>

                <div className="mt-6 flex items-center justify-between">
                    <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)} data-testid="quiz-prev-btn">Previous</Button>
                    {currentIdx < quiz.questions.length - 1 ? (
                        <Button onClick={() => setCurrentIdx((i) => i + 1)} className="bg-brand-800 hover:bg-brand-900" data-testid="quiz-next-btn">Next</Button>
                    ) : (
                        <Button onClick={submit} disabled={submitting} className="bg-gold-500 hover:bg-gold-600" data-testid="quiz-submit-btn">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit quiz"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 p-4">
            <div className="font-display text-2xl font-bold text-brand-800">{value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        </div>
    );
}
