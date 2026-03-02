import React, { useEffect, useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type SyntaxModule = {
  Prism: typeof import('react-syntax-highlighter').Prism;
  style: Record<string, React.CSSProperties>;
};

let syntaxModulePromise: Promise<SyntaxModule> | null = null;

async function loadSyntaxModule(): Promise<SyntaxModule> {
  if (!syntaxModulePromise) {
    syntaxModulePromise = Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([syntaxHighlighterModule, styleModule]) => ({
      Prism: syntaxHighlighterModule.Prism,
      style: styleModule.vscDarkPlus as Record<string, React.CSSProperties>,
    }));
  }

  return syntaxModulePromise;
}

interface CodeBlockProps {
  language: string;
  value: string;
  className?: string;
}

export const CodeBlock = ({ language, value, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [syntaxModule, setSyntaxModule] = useState<SyntaxModule | null>(null);

  useEffect(() => {
    let mounted = true;

    void loadSyntaxModule()
      .then((module) => {
        if (mounted) {
          setSyntaxModule(module);
        }
      })
      .catch((error) => {
        console.error('[CodeBlock] Failed to load syntax highlighter:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedCode = (() => {
    if (!syntaxModule) {
      return (
        <pre className="perf-lazy-code m-0 p-4 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed text-slate-200">
          {String(value).replace(/\n$/, '')}
        </pre>
      );
    }

    const SyntaxHighlighter = syntaxModule.Prism;

    return (
      <SyntaxHighlighter
        language={language || 'text'}
        style={syntaxModule.style}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: 'inherit',
          lineHeight: 1.6,
        }}
        codeTagProps={{
          style: {
            fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
          },
        }}
        wrapLongLines
      >
        {String(value).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  })();

  return (
    <div
      className={twMerge(
        'rounded-md overflow-hidden my-4 border border-slate-700/50 shadow-sm bg-[#1e1e1e]',
        'group relative pointer-events-auto',
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 opacity-60">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          {language && (
            <span className="text-[10px] font-mono font-medium text-slate-400 ml-2 uppercase tracking-wider">
              {language}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Clipboard className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="relative group/code text-xs sm:text-sm">{highlightedCode}</div>
    </div>
  );
};
