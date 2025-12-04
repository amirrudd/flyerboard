import { useNavigate, useLocation } from "react-router-dom";
import { PostAd } from "../features/ads/PostAd";

export function PostAdPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const editingAd = location.state?.editingAd;

    return (
        <PostAd
            onBack={() => navigate(-1)}
            editingAd={editingAd}
        />
    );
}

export default PostAdPage;
