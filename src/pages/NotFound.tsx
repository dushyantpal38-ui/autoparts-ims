import { Button, EmptyState, usePageMeta } from '../ui';

export function NotFound({ go }: { go: (p: string) => void }) {
  usePageMeta('Page Not Found', 'The page you requested does not exist in AutoParts IMS.');

  return (
    <div className="page">
      <h1 className="visually-hidden">Page not found</h1>
      <EmptyState
        title="404 — Page not found"
        message="The page or part you requested doesn't exist, or its record was deleted. Check the address or continue from one of the sections below."
        action={
          <div className="scan-result-actions">
            <Button variant="primary" onClick={() => go('/')}>Go to Dashboard</Button>
            <Button onClick={() => go('/inventory')}>View Inventory</Button>
            <Button onClick={() => go('/scan')}>Scan QR Code</Button>
          </div>
        }
      />
    </div>
  );
}
