import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ReviewForm({ courseId, existing, onSaved }) {
    const [rating, setRating] = useState(existing?.rating || 0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState(existing?.comment || "");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (rating === 0) return toast.error("Please pick a star rating.");
        setSaving(true);
        try {
            await api.post("/reviews", { course_id: courseId, rating, comment });
            toast.success("Review submitted!");
            onSaved?.();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    return (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your review</div>
            <h4 className="mt-1 font-display text-base font-bold text-slate-900">How was this course?</h4>
            <div className="mt-3 flex items-center gap-1" data-testid="rating-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(n)}
                        data-testid={`star-${n}`}
                    >
                        <Star className={`h-6 w-6 transition-colors ${(hover || rating) >= n ? "fill-gold-500 text-gold-500" : "text-slate-300"}`} />
                    </button>
                ))}
            </div>
            <Textarea
                rows={3}
                className="mt-3"
                placeholder="What did you like? Anything to improve?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid="review-comment"
            />
            <Button onClick={submit} disabled={saving} className="mt-3 bg-brand-800 hover:bg-brand-900" data-testid="review-submit-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "Update review" : "Post review"}
            </Button>
        </div>
    );
}
