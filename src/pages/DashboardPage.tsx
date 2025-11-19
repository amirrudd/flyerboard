import { useNavigate } from "react-router-dom";
import { UserDashboard } from "../features/dashboard/UserDashboard";

export function DashboardPage() {
    const navigate = useNavigate();

    return (
        <UserDashboard
            onBack={() => navigate('/')}
            onPostAd={() => navigate('/post')}
            onEditAd={(ad) => navigate('/post', { state: { editingAd: ad } })}
        />
    );
}
