import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Descriptions saved before the rich editor existed are plain text with \n line breaks.
function toEditorHtml(value: string): string {
  if (!value) return '';
  if (/<\/?(p|ul|ol|li|br|strong|em|b|i)\b/i.test(value)) return value;
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return value.split(/\r?\n/).map((line) => `<p>${escape(line)}</p>`).join('');
}

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

export function RichTextEditor({ id, value, onChange, disabled }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false,
        strike: false, underline: false, link: false,
      }),
    ],
    content: toEditorHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'rich-content min-h-[96px] px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  if (!editor) return null;

  const tools = [
    { label: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Bullet list', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div className={`rounded-md border border-input bg-background ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-1 border-b border-input p-1">
        {tools.map(({ label, icon: Icon, active, run }) => (
          <Button
            key={label}
            type="button"
            variant={active ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={run}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
        <span className="ml-auto pr-2 text-xs text-muted-foreground hidden sm:inline">Shift+Enter for a line break</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
