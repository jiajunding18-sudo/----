import type { MDXComponents } from "mdx/types";

const learningDocumentComponents: MDXComponents = {
  pre: (props) => <pre {...props} tabIndex={0} />,
  table: (props) => <table {...props} tabIndex={0} />,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...learningDocumentComponents, ...components };
}
