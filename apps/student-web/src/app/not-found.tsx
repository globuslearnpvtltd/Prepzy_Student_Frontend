import { HomeLink, StatusScreen } from '@/shared/layout/status-screens';

export default function NotFound() {
  return (
    <StatusScreen
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={<HomeLink />}
    />
  );
}
