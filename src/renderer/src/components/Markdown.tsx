import { Box, Link } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

// Prose styles for rendered markdown, tuned for the dark theme. Colors come
// from Chakra CSS variables so they track the active palette.
const prose = {
  fontSize: "sm",
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
  "& code": {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.85em",
    background: "var(--chakra-colors-bg-muted)",
    padding: "0.15em 0.4em",
    borderRadius: "4px",
  },
  "& pre": {
    background: "var(--chakra-colors-bg-muted)",
    padding: "0.9em 1em",
    borderRadius: "8px",
    overflowX: "auto",
    margin: "0.75em 0",
  },
  "& pre code": {
    background: "transparent",
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
  "& img": { maxWidth: "100%", borderRadius: "6px" },
} as const;

export default function Markdown({ children }: Props) {
  return (
    <Box css={prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <Link
              href={href}
              color="colorPalette.fg"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </Link>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
