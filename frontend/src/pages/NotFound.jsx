import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="mx-auto max-w-2xl px-6 py-24 text-center">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
                    <Compass className="h-8 w-8" />
                </div>
                <div className="mt-6 font-display text-7xl font-bold tracking-tight text-brand-800">404</div>
                <h1 className="mt-3 font-display text-2xl font-bold text-slate-900">This page wandered off.</h1>
                <p className="mt-2 text-slate-600">The link may be broken, or the content moved. Let's get you back on track.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link to="/"><Button variant="outline" data-testid="back-home-btn"><ArrowLeft className="mr-2 h-4 w-4" />Back home</Button></Link>
                    <Link to="/courses"><Button className="bg-brand-800 hover:bg-brand-900" data-testid="explore-courses-btn">Explore courses</Button></Link>
                </div>
            </div>
        </div>
    );
}
