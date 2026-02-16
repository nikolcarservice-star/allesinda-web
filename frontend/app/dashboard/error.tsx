'use client';

import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mb-4 mt-6 flex max-w-xl flex-col rounded-lg border border-border bg-white p-8 md:p-12">
      <h2 className="text-xl font-bold">Oh nein!</h2>
      <p className="my-2">
        Es gab ein Problem mit dem Dashboard. Bitte versuchen Sie es erneut oder wechseln Sie die Registerkarte.
      </p>
      <Button size="lg" className="mt-4" onClick={() => reset()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
