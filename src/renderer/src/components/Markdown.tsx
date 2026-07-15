import { Box, Link } from "@chakra-ui/react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { scrollbar } from "../lib/scrollbar";
import { tokenColors } from "../lib/syntaxColors";

interface Props {
  children: string;
  fontSize?: "sm" | "md";
}

// The extracted scrollbar styling, re-targeted at the horizontally scrolling
// elements inside the prose instead of the prose container itself.
const innerScrollbar = Object.fromEntries(
  Object.entries(scrollbar).map(([selector, style]) => [
    selector.replace("&", "& :is(pre, table)"),
    style,
  ]),
);

interface CodeProps {
  className?: string;
  children?: React.ReactNode;
}

// Candidates for auto-detection on untagged code blocks — kept narrow so
// hljs doesn't misfire on short snippets.
const autoLanguages = [
  "typescript",
  "javascript",
  "json",
  "bash",
  "diff",
  "xml",
  "css",
  "python",
  "sql",
  "yaml",
];

// Fenced code blocks arrive as `language-<lang>`; highlight the ones hljs
// knows (including diff). Untagged multi-line blocks get auto-detection.
// Inline code (no className, no newlines) stays plain neutral text — it
// renders as a chip, and token colors just add noise at that size.
function Code({ className, children }: CodeProps) {
  const language = /language-(\w+)/.exec(className ?? "")?.[1];
  const code =
    typeof children === "string" ? children.replace(/\n$/, "") : null;

  let html: string | null = null;
  if (code && language && hljs.getLanguage(language)) {
    html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } else if (code && !language && code.includes("\n")) {
    html = hljs.highlightAuto(code, autoLanguages).value;
  }

  if (html !== null) {
    return (
      <code
        className={className}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: hljs escapes its input
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <code className={className}>{children}</code>;
}

// Prose styles for rendered markdown, tuned for the dark theme. Colors come
// from Chakra CSS variables so they track the active palette.
const prose = {
  lineHeight: "1.6",
  color: "var(--chakra-colors-fg)",
  wordBreak: "break-word",
  "& > :first-child": { marginTop: 0 },
  "& > :last-child": { marginBottom: 0 },
  "& h1, & h2, & h3, & h4": {
    fontWeight: "600",
    lineHeight: "1.3",
    marginTop: "1.5em",
    marginBottom: "0.5em",
  },
  "& h1": { fontSize: "1.5em" },
  "& h2": { fontSize: "1.3em" },
  "& h3": { fontSize: "1.1em" },
  "& h4": { fontSize: "1em" },
  "& p": { margin: "1em 0" },
  "& ul": { paddingLeft: "1.5em", margin: "1em 0", listStyleType: "disc" },
  "& ol": { paddingLeft: "1.5em", margin: "1em 0", listStyleType: "decimal" },
  "& li": { margin: "0.35em 0" },
  "& li::marker": { color: "var(--chakra-colors-fg-muted)" },
  "& li > input[type='checkbox']": { marginRight: "0.5em" },
  // Inline code renders as a bordered chip so it stands out from prose.
  "& code": {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.85em",
    // Between fg and fg.muted — dimmer than prose without going full muted.
    color:
      "color-mix(in srgb, var(--chakra-colors-fg) 55%, var(--chakra-colors-fg-muted))",
    background: "var(--chakra-colors-bg-muted)",
    border: "1px solid var(--chakra-colors-border-emphasized)",
    padding: "0.1em 0.4em",
    borderRadius: "6px",
  },
  "& pre": {
    background: "var(--chakra-colors-bg-muted)",
    padding: "0.9em 1em",
    borderRadius: "8px",
    overflowX: "auto",
    margin: "0.75em 0",
  },
  "& pre code": {
    color: "inherit",
    background: "transparent",
    border: "none",
    padding: 0,
    fontSize: "0.85em",
  },
  "& blockquote": {
    borderLeftWidth: "3px",
    borderColor: "var(--chakra-colors-border-emphasized)",
    paddingLeft: "1em",
    margin: "0.75em 0",
    color: "var(--chakra-colors-fg-muted)",
  },
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
    margin: "0.75em 0",
    display: "block",
    overflowX: "auto",
  },
  "& th, & td": {
    borderWidth: "1px",
    borderColor: "var(--chakra-colors-border)",
    padding: "0.4em 0.7em",
    textAlign: "left",
  },
  "& th": { background: "var(--chakra-colors-bg-muted)", fontWeight: "600" },
  "& hr": {
    border: "none",
    borderTopWidth: "1px",
    borderColor: "var(--chakra-colors-border-muted)",
    margin: "1.25em 0",
  },
  // Chakra's reset makes img display:block; markdown images (status dots,
  // badges) must flow inline with text like they do on GitHub.
  "& img": {
    display: "inline-block",
    verticalAlign: "text-bottom",
    maxWidth: "100%",
    borderRadius: "6px",
  },
  ...tokenColors,
  ...innerScrollbar,
} as const;

export default function Markdown({ children, fontSize = "sm" }: Props) {
  return (
    <Box css={prose} fontSize={fontSize}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // GitHub allows inline HTML in markdown (bots lean on it for links),
        // so parse it — then sanitize, since comment HTML is untrusted.
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          a: ({ href, children }) => (
            <Link
              href={href}
              color="colorPalette.fg"
              textDecoration="underline"
              textDecorationColor="color-mix(in srgb, currentColor 40%, transparent)"
              textUnderlineOffset="3px"
              _hover={{ textDecorationColor: "currentColor" }}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </Link>
          ),
          code: Code,
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
