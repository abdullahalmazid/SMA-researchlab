import React from "react";

/**
 * Message formatting without innerHTML: ```code blocks```, `inline code`,
 * clickable links, and line breaks. Everything else renders as plain text, so
 * a message can never inject markup.
 */
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

const highlight = (text: string, term: string, keyPrefix: string): React.ReactNode[] => {
  if (!term) return [text];
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const out: React.ReactNode[] = [];
  let from = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > from) out.push(text.slice(from, index));
    out.push(
      <mark key={`${keyPrefix}-m${index}`} className="rounded-sm bg-amber-200 px-0.5 text-inherit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    from = index + needle.length;
    index = lower.indexOf(needle, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
};

const renderInline = (text: string, term: string, keyPrefix: string): React.ReactNode[] =>
  text.split(/(`[^`\n]+`)/g).flatMap<React.ReactNode>((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return [
        <code key={key} className="rounded bg-black/10 px-1 py-px font-mono text-[0.88em]">
          {part.slice(1, -1)}
        </code>,
      ];
    }
    return part.split(URL_PATTERN).flatMap<React.ReactNode>((chunk, j) =>
      j % 2 === 1
        ? [
            <a
              key={`${key}-a${j}`}
              href={chunk}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-current/40 underline-offset-2 [overflow-wrap:anywhere] hover:decoration-current"
            >
              {chunk}
            </a>,
          ]
        : highlight(chunk, term, `${key}-t${j}`),
    );
  });

const RichText: React.FC<{ text: string; highlightTerm?: string }> = ({ text, highlightTerm = "" }) => (
  <>
    {text.split(/(```[\s\S]*?```)/g).map((block, i) =>
      block.startsWith("```") && block.endsWith("```") && block.length > 6 ? (
        <pre
          key={i}
          className="my-1 max-w-full overflow-x-auto whitespace-pre rounded-lg bg-black/10 px-2.5 py-2 font-mono text-[12.5px] leading-snug"
        >
          {block.slice(3, -3).replace(/^\w*\n/, "")}
        </pre>
      ) : (
        <span key={i} className="whitespace-pre-wrap break-words">
          {renderInline(block, highlightTerm, String(i))}
        </span>
      ),
    )}
  </>
);

export default RichText;
