import type { MDXComponents } from "mdx/types";
import type { HTMLAttributes } from "react";

function HeadingAnchor({ id }: { readonly id?: string }) {
  return id ? (
    <a
      aria-label="此章节的永久链接"
      className="heading-anchor"
      href={`#${id}`}
    >
      <span aria-hidden="true">#</span>
    </a>
  ) : null;
}

function Heading2({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 {...props} id={id} tabIndex={id ? -1 : undefined}>
      {children}
      <HeadingAnchor id={id} />
    </h2>
  );
}

function Heading3({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 {...props} id={id} tabIndex={id ? -1 : undefined}>
      {children}
      <HeadingAnchor id={id} />
    </h3>
  );
}

const learningDocumentComponents: MDXComponents = {
  h2: Heading2,
  h3: Heading3,
  pre: (props) => <pre {...props} tabIndex={0} />,
  table: (props) => <table {...props} tabIndex={0} />,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...learningDocumentComponents, ...components };
}
