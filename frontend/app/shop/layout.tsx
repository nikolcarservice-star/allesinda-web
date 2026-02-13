import { PageLayout } from "@/components/layout/page-layout";

/** Раздел «Продукты» отключён — минимальный layout без каталога и фильтров */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}
