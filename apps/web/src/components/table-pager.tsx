import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export const PAGE_SIZE = 50;

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    slice: items.slice((current - 1) * size, current * size),
    total,
    pageCount,
    current,
  };
}

export function TablePager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 p-3">
      <Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("pager.prev")}
      </Button>
      <span className="text-sm text-stone-600">{t("pager.page", { page, pages: pageCount })}</span>
      <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        {t("pager.next")}
      </Button>
    </div>
  );
}
