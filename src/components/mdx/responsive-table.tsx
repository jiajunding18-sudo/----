import type { TableHTMLAttributes } from "react";

export function ResponsiveTable(props: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div
      aria-label="可横向滚动的数据表"
      className="table-scroll-container"
      role="group"
      tabIndex={0}
    >
      <table {...props} />
    </div>
  );
}
