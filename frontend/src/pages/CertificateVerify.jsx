import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, CheckCircle2, XCircle, Search, Download } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

export default function CertificateVerify() {
    const [params, setParams] = useSearchParams();
    const [number, setNumber] = useState(params.get("cert") || "");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const verify = async (val) => {
        const n = (val ?? number).trim();
        if (!n) return;
        setLoading(true); setError(""); setResult(null);
        try {
            const { data } = await api.get(`/certificates/verify/${n}`);
            setResult(data.data);
            setParams({ cert: n });
        } catch (e) {
            setError(formatApiError(e));
        } finally { setLoading(false); }
    };

    useEffect(() => {
        if (params.get("cert")) verify(params.get("cert"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="mx-auto max-w-3xl px-6 py-16">
                <div className="text-center">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 text-white">
                        <Award className="h-7 w-7" />
                    </div>
                    <h1 className="mt-4 font-display text-4xl font-bold text-slate-900">Verify a certificate</h1>
                    <p className="mt-2 text-slate-600">Enter the certificate ID printed on the PDF to confirm authenticity.</p>
                </div>

                <Card className="mt-10 border-slate-200 p-6">
                    <div className="flex gap-2">
                        <Input
                            placeholder="LH-XXXXXXXX"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && verify()}
                            data-testid="cert-number-input"
                        />
                        <Button onClick={() => verify()} disabled={loading} className="bg-brand-800 hover:bg-brand-900" data-testid="verify-btn">
                            <Search className="mr-2 h-4 w-4" />Verify
                        </Button>
                    </div>
                    {error && (
                        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" data-testid="verify-error">
                            <XCircle className="mb-1 inline h-4 w-4 mr-1" />{error}
                        </div>
                    )}
                    {result && (
                        <div className="mt-6 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6" data-testid="verify-success">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                                <div className="flex-1">
                                    <div className="font-display text-xl font-bold text-slate-900">Verified ✓</div>
                                    <p className="text-sm text-emerald-700">This is a valid LearnHub certificate.</p>
                                    <div className="mt-4 grid gap-2 text-sm">
                                        <Detail label="Issued to" value={result.learner_name} />
                                        <Detail label="Course" value={result.course_title} />
                                        <Detail label="Issued on" value={new Date(result.issued_at).toLocaleDateString()} />
                                        <Detail label="Certificate ID" value={result.certificate_number} />
                                    </div>
                                    <a
                                        href={`${process.env.REACT_APP_BACKEND_URL}/api/certificates/${result.certificate_number}/download`}
                                        target="_blank" rel="noreferrer"
                                    >
                                        <Button className="mt-4 bg-brand-800 hover:bg-brand-900" data-testid="download-verified"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="flex justify-between border-b border-emerald-200 py-1.5">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium text-slate-900">{value}</span>
        </div>
    );
}
