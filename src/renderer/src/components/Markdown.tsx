import { Box, Link } from "@chakra-ui/react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  isGitHubAttachmentUrl,
  toDisplayableImageSrc,
} from "../lib/githubImages";
import { highlightBlock, resolveLanguage } from "../lib/highlighter";
import { scrollbar } from "../lib/scrollbar";
import { tokenColors } from "../lib/syntaxColors";
import { useSyntaxThemes } from "../lib/syntaxTheme";
import AttachmentMedia from "./AttachmentMedia";

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

// Fenced code blocks arrive as `language-<lang>`; highlight the ones shiki
// knows (including diff). Untagged blocks render plain, like GitHub. Inline
// code (no className, no newlines) stays plain neutral text — it renders as
// a chip, and token colors just add noise at that size.
function Code({ className, children }: CodeProps) {
  const themes = useSyntaxThemes();
  const language = resolveLanguage(
    /language-([\w-]+)/.exec(className ?? "")?.[1],
  );
  const code =
    typeof children === "string" ? children.replace(/\n$/, "") : null;

  const html = code && language ? highlightBlock(code, language, themes) : null;

  if (html !== null) {
    return (
      <code
        className={className}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: highlightBlock escapes its input
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
  // Videos are block-level and capped so a screen recording doesn't push the
  // rest of the description off the page.
  "& video": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "30rem",
    borderRadius: "6px",
    borderWidth: "1px",
    borderColor: "var(--chakra-colors-border)",
    margin: "0.75em 0",
  },
  ...tokenColors,
  ...innerScrollbar,
} as const;

function ProseLink({ href, children }: { href?: string; children: ReactNode }) {
  return (
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
  );
}

// An autolinked bare URL — GitHub's markdown for an uploaded video — arrives
// as a link whose only child is the href itself. A link someone wrote by hand
// has different text and stays a link.
function bareUrlText(children: ReactNode): string | null {
  if (typeof children === "string") return children;
  if (
    Array.isArray(children) &&
    children.length === 1 &&
    typeof children[0] === "string"
  ) {
    return children[0];
  }
  return null;
}

// Bodies written on github.com embed videos as real <video> tags, which the
// default sanitize schema drops entirely. Allow them, with the attributes a
// player needs and nothing that could load or run anything else.
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "video", "source"],
  attributes: {
    ...defaultSchema.attributes,
    video: [
      "src",
      "poster",
      "controls",
      "width",
      "height",
      "loop",
      "muted",
      "playsInline",
      "autoPlay",
    ],
    source: ["src", "type"],
  },
};

export default function Markdown({ children, fontSize = "sm" }: Props) {
  return (
    <Box css={prose} fontSize={fontSize}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // GitHub allows inline HTML in markdown (bots lean on it for links),
        // so parse it — then sanitize, since comment HTML is untrusted.
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) => {
            // A bare attachment link is a video embed; anything else is a link.
            if (isGitHubAttachmentUrl(href) && bareUrlText(children) === href) {
              return (
                <AttachmentMedia
                  href={href as string}
                  fallback={<ProseLink href={href}>{children}</ProseLink>}
                />
              );
            }
            return <ProseLink href={href}>{children}</ProseLink>;
          },
          code: Code,
          // Private-repo attachments need the token, same as images.
          video: ({ src, children, ...rest }) => (
            <video {...rest} controls src={toDisplayableImageSrc(src)}>
              {children}
            </video>
          ),
          source: ({ src, ...rest }) => (
            <source {...rest} src={toDisplayableImageSrc(src)} />
          ),
          // Private-repo attachments need the main process to fetch them
          // with the GitHub token; other images load directly.
          img: ({ src, alt, ...rest }) => (
            <img {...rest} alt={alt} src={toDisplayableImageSrc(src)} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
