'use client';

import { Button } from '@/components/ui/button';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto mb-4 mt-top-spacing flex max-w-xl flex-col rounded-lg border border-border bg-white p-8 md:p-12">
      <h2 className="text-xl font-bold">Oh nein!</h2>
      <p className="my-2">
        Es gab ein Problem mit unserer Plattform. Dies könnte ein vorübergehendes Problem sein, bitte versuchen Sie Ihre Aktion erneut.
      </p>
      <Button size="lg" className="mt-4" onClick={() => reset()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
