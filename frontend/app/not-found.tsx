import Link from 'next/link';
import { PageLayout } from '@/components/layout/page-layout';

export default function NotFound() {
  return (
    <PageLayout>
      <div className="min-h-[90vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-8">
            <h1 className="text-8xl font-bold text-primary/20 mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Seite nicht gefunden.{' '}
              <Link href="/" className="underline">
                Zurück zur Startseite
              </Link>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Entschuldigung, wir konnten die gesuchte Seite nicht finden. Die Seite wurde möglicherweise verschoben, gelöscht oder
              Sie haben eine falsche URL eingegeben.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
