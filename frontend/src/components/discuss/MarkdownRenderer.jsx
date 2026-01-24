import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    pre: [...(defaultSchema.attributes?.pre || []), "className"],
  },
};

export default function MarkdownRenderer({ value }) {
  if (!value) return null;

  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-[#0A0A08] prose-pre:border prose-pre:border-[#1A1814] prose-pre:rounded-lg prose-code:text-[#E8E4D9] prose-a:text-[#F59E0B]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        skipHtml
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
