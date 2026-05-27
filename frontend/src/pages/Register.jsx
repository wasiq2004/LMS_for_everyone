import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Loader2, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
    const { register, formatApiError } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        first_name: "", last_name: "", email: "", password: "", role: "STUDENT",
    });
    const [loading, setLoading] = useState(false);
    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const u = await register(form);
            toast.success("Account created!");
            navigate(u.role === "EDUCATOR" ? "/educator/dashboard" : "/dashboard");
        } catch (err) { toast.error(formatApiError(err)); }
        finally { setLoading(false); }
    };

    return (
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
            <div className="hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between"
                style={{ backgroundImage: "linear-gradient(135deg, #1e40af 0%, #f59e0b22 100%)" }}>
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="font-display text-xl font-bold">LearnHub</span>
                </Link>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">Get started</div>
                    <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight">
                        Build skills that change your career.
                    </h1>
                    <p className="mt-4 max-w-md text-white/80">
                        Join 50,000+ learners advancing their careers with hands-on, project-based courses.
                    </p>
                </div>
                <div className="text-xs text-white/40">
                    Trusted by learners at Stripe, Shopify, Airbnb, and more.
                </div>
            </div>

            <div className="flex items-center justify-center bg-slate-50 p-8">
                <Card className="w-full max-w-md border-slate-200 p-8 shadow-lg">
                    <h2 className="font-display text-2xl font-bold text-slate-900">Create your account</h2>
                    <p className="mt-1 text-sm text-slate-500">Free forever for browsing and free courses.</p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => update("role", "STUDENT")}
                            data-testid="role-student"
                            className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all ${form.role === "STUDENT" ? "border-brand-800 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}
                        >
                            <BookOpen className="h-5 w-5 text-brand-800" />
                            <div className="mt-2 font-display font-semibold text-slate-900">Student</div>
                            <div className="text-xs text-slate-500">Learn and earn certificates</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => update("role", "EDUCATOR")}
                            data-testid="role-educator"
                            className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all ${form.role === "EDUCATOR" ? "border-brand-800 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}
                        >
                            <Pencil className="h-5 w-5 text-brand-800" />
                            <div className="mt-2 font-display font-semibold text-slate-900">Educator</div>
                            <div className="text-xs text-slate-500">Teach and earn revenue</div>
                        </button>
                    </div>

                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="fn">First name</Label>
                                <Input id="fn" required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} data-testid="register-first-name" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ln">Last name</Label>
                                <Input id="ln" required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} data-testid="register-last-name" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} data-testid="register-email" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pw">Password</Label>
                            <Input id="pw" type="password" required minLength={6} value={form.password} onChange={(e) => update("password", e.target.value)} data-testid="register-password" />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-brand-800 hover:bg-brand-900" data-testid="register-submit">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-600">
                        Already have an account? <Link to="/login" className="font-medium text-brand-800 hover:underline">Sign in</Link>
                    </p>
                </Card>
            </div>
        </div>
    );
}
