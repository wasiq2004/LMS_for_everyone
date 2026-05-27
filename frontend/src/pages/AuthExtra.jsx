import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, KeyRound } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/auth/forgot-password", { email });
            setSent(true);
        } catch (err) { toast.error(formatApiError(err)); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="mx-auto max-w-md px-6 py-20">
                <Card className="border-slate-200 p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                        <Mail className="h-6 w-6" />
                    </div>
                    <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">Forgot password?</h1>
                    <p className="mt-1 text-sm text-slate-500">We'll send a reset link to your email.</p>
                    {sent ? (
                        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="reset-sent-message">
                            If that email exists in our system, a reset link has been sent.
                            <div className="mt-2 text-xs text-emerald-700/80">
                                (In this demo, the link is logged to the backend console.)
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <div>
                                <Label>Email</Label>
                                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" data-testid="forgot-email" />
                            </div>
                            <Button type="submit" disabled={loading} className="w-full bg-brand-800 hover:bg-brand-900" data-testid="forgot-submit">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                            </Button>
                        </form>
                    )}
                    <p className="mt-6 text-center text-sm text-slate-500">
                        Remember it? <Link to="/login" className="font-medium text-brand-800 hover:underline">Sign in</Link>
                    </p>
                </Card>
            </div>
        </div>
    );
}

export function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/auth/reset-password", { token, new_password: password });
            toast.success("Password updated! Please sign in.");
            navigate("/login");
        } catch (err) { toast.error(formatApiError(err)); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="mx-auto max-w-md px-6 py-20">
                <Card className="border-slate-200 p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">Choose a new password</h1>
                    <p className="mt-1 text-sm text-slate-500">Make sure it's at least 6 characters.</p>
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <Label>New password</Label>
                            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" data-testid="reset-password-input" />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-brand-800 hover:bg-brand-900" data-testid="reset-submit">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
