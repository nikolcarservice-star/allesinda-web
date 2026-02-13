import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Раздел «Продукты» отключён — не генерируем страницы товаров */
export async function generateStaticParams() {
  return [];
}

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Allesinda" };
}

/** Раздел «Продукты» отключён — показываем заглушку вместо карточки товара */
export default async function ProductPage() {
  return (
    <div className="container mx-auto px-sides py-12 sm:py-16 text-center">
      <p className="text-muted-foreground mb-6">
        Раздел «Продукты» temporär deaktiviert.
      </p>
      <Button asChild variant="default">
        <Link href="/">Zur Startseite</Link>
      </Button>
    </div>
  );
}
