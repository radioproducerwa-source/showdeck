'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { toEditorHtml } from '../lib/richText'

type Props = {
  value: string
  onChange: (html: string) => void
  onFocus?: () => void
  placeholder?: string
  minHeight?: number
  className?: string
}

function ToolbarButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      // onMouseDown prevents the editor losing selection before the command runs
      onMouseDown={e => { e.preventDefault(); onClick() }}
      aria-label={label}
      title={label}
      className={`w-8 h-8 rounded-md text-sm flex items-center justify-center transition-colors ${
        active ? 'bg-[#0d0d0f] text-white' : 'text-[#6b6b7a] hover:bg-[#eef0f3] hover:text-[#0d0d0f]'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value, onChange, onFocus, placeholder, minHeight = 96, className = '',
}: Props) {
  const [focused, setFocused] = useState(false)
  // Keep the latest onChange without re-creating the editor
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const editor = useEditor({
    // Rendered only on the client; avoids an SSR hydration mismatch
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
      }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChangeRef.current(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'showdeck-prose outline-none w-full',
        style: `min-height:${minHeight}px`,
      },
    },
  })

  // Pull in external changes (imports, duplicate-last-week) without clobbering typing
  useEffect(() => {
    if (!editor) return
    const incoming = toEditorHtml(value)
    const current = editor.getHTML()
    const currentNormalised = current === '<p></p>' ? '' : current
    if (incoming !== currentNormalised && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) {
    return <div className={`px-4 py-3 text-sm text-[#b8bac2] ${className}`} style={{ minHeight }}>{placeholder}</div>
  }

  const isEmpty = editor.isEmpty

  return (
    <div className={className}>
      {focused && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#eef0f3] bg-[#fafbfc] sticky top-0 z-10">
          <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="italic font-serif">I</span>
          </ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span className="underline">U</span>
          </ToolbarButton>
          <span className="w-px h-5 bg-[#e2e4e8] mx-1" />
          <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" /><path d="M9 6h11" />
              <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" /><path d="M9 12h11" />
              <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" /><path d="M9 18h11" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6h11M9 12h11M9 18h11" />
              <text x="1.5" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
              <text x="1.5" y="14.5" fontSize="7" fill="currentColor" stroke="none">2</text>
              <text x="1.5" y="21" fontSize="7" fill="currentColor" stroke="none">3</text>
            </svg>
          </ToolbarButton>
        </div>
      )}
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="absolute top-3 left-4 text-sm text-[#b8bac2] pointer-events-none select-none m-0">
            {placeholder}
          </p>
        )}
        <div
          onFocus={() => { setFocused(true); onFocus?.() }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false) }}
          className="px-4 py-3"
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
