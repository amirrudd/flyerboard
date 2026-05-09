import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { UserDashboard } from "../features/dashboard/UserDashboard";
import { PageLoader } from "../components/PageLoader";

export function DashboardPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isSessionLoading } = useSession();

    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    return (
        <UserDashboard
            onBack={() => navigate('/')}
            onPostAd={() => navigate('/post', { state: { from: '/dashboard' } })}
            onEditAd={(ad) => navigate('/post', { state: { editingAd: ad, from: '/dashboard' } })}
        />
    );
}

export default DashboardPage;
