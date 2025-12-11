import { useNavigate, useLocation } from "react-router-dom";
import { PostAd } from "../features/ads/PostAd";

export function PostAdPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const editingAd = location.state?.editingAd;
    const from = location.state?.from || '/';

    const handleBack = () => {
        // Navigate back to origin or default to home
        navigate(from);
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
