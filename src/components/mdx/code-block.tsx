import {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { CodeCopyButton } from "./code-copy-button";

const languageLabels: Readonly<Record<string, string>> = {
  bash: "Shell",
  javascript: "JavaScript",
  js: "JavaScript",
  plaintext: "Plain text",
  powershell: "PowerShell",
  python: "Python",
  shell: "Shell",
  sh: "Shell",
  text: "Plain text",
  ts: "TypeScript",
  tsx: "TypeScript",
  typescript: "TypeScript",
};

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (!node) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }
  if (isValidElement<{ readonly children?: ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }
  return "";
}

function getCodeLanguage(children: ReactNode) {
  const codeElement = Children.toArray(children).find((child) =>
    isValidElement<{ readonly className?: string }>(child),
  );
  if (!isValidElement<{ readonly className?: string }>(codeElement)) {
    return { id: "text", label: languageLabels.text };
  }

  const language = codeElement.props.className?.match(/(?:^|\s)language-([\w-]+)/)?.[1];
  const id = language?.toLowerCase() ?? "text";
  return {
    id,
    label: languageLabels[id] ?? id.toUpperCase(),
  };
}

export function CodeBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const language = getCodeLanguage(children);
  const code = getTextContent(children).replace(/\n$/, "");

  return (
    <div className="code-block" data-code-language={language.id}>
      <div className="code-block-toolbar">
        <span className="code-language-label">{language.label}</span>
        <CodeCopyButton code={code} />
      </div>
      <pre {...props} aria-label={`${language.label} 代码`} tabIndex={0}>
        {children}
      </pre>
    </div>
  );
}
