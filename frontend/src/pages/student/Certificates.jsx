import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, ExternalLink, Loader2, Search } from "lucide-react";
import api from "@/lib/api";

export default function Certificates() {
    const [certs, setCerts] = useState(null);

    useEffect(() => { (async () => {
        const { data } = await api.get("/certificates/my");
        setCerts(data.data);
    })(); }, []);

    if (!certs) return <DashboardLayout title="My Certificates"><div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-800" /></div></DashboardLayout>;

    return (
        <DashboardLayout title="My Certificates" subtitle="Download and share your proof of completion.">
            {certs.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-16 text-center">
                    <Award className="mx-auto h-12 w-12 text-gold-500" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No certificates yet</h3>
                    <p className="mt-1 text-sm text-slate-500">Complete a course to earn your first certificate.</p>
                    <Link to="/courses"><Button className="mt-4 bg-brand-800 hover:bg-brand-900" data-testid="browse-to-earn"><Search className="mr-2 h-4 w-4" />Browse courses</Button></Link>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {certs.map((cert) => (
                        <Card key={cert.id} className="overflow-hidden border-slate-200" data-testid={`cert-${cert.certificate_number}`}>
                            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-800 to-brand-900">
                                <div className="absolute inset-0 p-6 text-white">
                                    <div className="flex h-full flex-col justify-between">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">LearnHub</div>
                                            <div className="mt-1 text-[10px] uppercase tracking-widest text-white/60">Certificate</div>
                                        </div>
                                        <div>
                                            <div className="font-display text-base font-bold line-clamp-2">{cert.course?.title}</div>
                                            <div className="mt-1 text-xs text-white/60">{cert.certificate_number}</div>
                                        </div>
                                    </div>
                                </div>
                                <Award className="absolute right-4 top-4 h-8 w-8 text-gold-400/40" />
                            </div>
                            <div className="p-4">
                                <div className="text-xs text-slate-500">Issued {new Date(cert.issued_at).toLocaleDateString()}</div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <a
                                        href={`${process.env.REACT_APP_BACKEND_URL}/api/certificates/${cert.certificate_number}/download`}
                                        target="_blank" rel="noreferrer"
                                        data-testid={`download-${cert.certificate_number}`}
                                    >
                                        <Button size="sm" variant="outline" className="w-full"><Download className="mr-1 h-3 w-3" />PDF</Button>
                                    </a>
                                    <Link to={`/certificate/verify?cert=${cert.certificate_number}`}>
                                        <Button size="sm" variant="outline" className="w-full"><ExternalLink className="mr-1 h-3 w-3" />Verify</Button>
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
