import { useNavigate, useLocation } from "react-router-dom";
import { PostAd } from "../features/ads/PostAd";

export function PostAdPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const editingAd = location.state?.editingAd;
    const from = location.state?.from || '/';

    const handleBack = () => {
        // If posting from dashboard, navigate back to dashboard
        // Otherwise navigate to home to see the newly posted flyer
        if (from === '/dashboard') {
            navigate('/dashboard');
        } else {
            // Pass forceRefresh flag to trigger immediate refresh on home page
            navigate('/', { state: { forceRefresh: true } });
        }
    };

    return (
        <PostAd
            onBack={handleBack}
            editingAd={editingAd}
            origin={from}
        />
    );
}

export default PostAdPage;
