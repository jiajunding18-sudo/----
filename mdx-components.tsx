import type { MDXComponents } from "mdx/types";
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from "react";

import { CodeBlock } from "@/components/mdx/code-block";
import { ResponsiveTable } from "@/components/mdx/responsive-table";

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

function getLearningSectionKind(id?: string) {
  if (id?.includes("worked-example")) return "example";
  if (id?.includes("active-recall")) return "recall";
  if (id?.includes("practice")) return "practice";
  if (id?.includes("mastery-evidence")) return "evidence";
  return undefined;
}

function Heading2({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      data-learning-section={getLearningSectionKind(id)}
      id={id}
      tabIndex={id ? -1 : undefined}
    >
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

function ContentLink({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href ? /^https?:\/\//i.test(href) : false;
  const externalRel = [props.rel, "noreferrer"].filter(Boolean).join(" ");

  return (
    <a
      {...props}
      data-link-kind={isExternal ? "external" : "internal"}
      href={href}
      rel={isExternal ? externalRel : props.rel}
      target={isExternal ? "_blank" : props.target}
    >
      {children}
      {isExternal ? (
        <>
          <span aria-hidden="true" className="external-link-mark">
            ↗
          </span>
          <span className="sr-only">（外部链接，在新窗口打开）</span>
        </>
      ) : null}
    </a>
  );
}

function ContentImage({ alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // Static export deliberately uses native responsive images; no image server exists.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} decoding="async" loading="lazy" />;
}

interface LearningFigureProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> {
  readonly alt: string;
  readonly caption: ReactNode;
}

function LearningFigure({ alt, caption, ...props }: LearningFigureProps) {
  return (
    <figure>
      <ContentImage {...props} alt={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const learningDocumentComponents: MDXComponents = {
  Figure: LearningFigure,
  a: ContentLink,
  figcaption: (props) => <figcaption {...props} />,
  figure: (props) => <figure {...props} />,
  h2: Heading2,
  h3: Heading3,
  img: ContentImage,
  pre: CodeBlock,
  table: ResponsiveTable,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...learningDocumentComponents, ...components };
}
