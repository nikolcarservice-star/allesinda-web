import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Allesinda | Shop",
  description: "Allesinda marketplace.",
};

/** Раздел «Продукты» отключён — показываем заглушку вместо каталога */
export default function ShopPage() {
  return (
    <div className="container mx-auto px-sides py-12 sm:py-16 text-center">
      <p className="text-muted-foreground mb-6">
        Der Bereich „Produkte“ ist temporär deaktiviert.
      </p>
      <Button asChild variant="default">
        <Link href="/">Zur Startseite</Link>
      </Button>
    </div>
  );
}
