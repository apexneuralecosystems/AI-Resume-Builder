import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  FileText, Upload, Zap, ChevronLeft, ChevronRight, Download,
  Trash2, AlertCircle, CheckCircle2, Loader2, FileSearch,
  Sparkles, RotateCcw, FilePlus2, Eye, X, Printer, Send, MessageSquare, Bot, CornerDownLeft,
} from 'lucide-react'
import axios from 'axios'
import mammoth from 'mammoth'
import { ResumeFile, Author } from './types'
import { ResumeTemplate } from './components/ResumeTemplate'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ResumeFile['status'] }) {
  const map = {
    pending:    'bg-slate-500/20 text-slate-400',
    processing: 'bg-amber-400/20 text-amber-400',
    done:       'bg-emerald-400/20 text-emerald-400',
    error:      'bg-red-400/20 text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${map[status]}`}>
      {status === 'processing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

interface DropZoneProps {
  dark: boolean
  dragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
  icon: React.ElementType
  heading: React.ReactNode
  hint: string
  primary?: boolean
}

function DropZone({ dark, dragOver, onDragOver, onDragLeave, onDrop, onClick, icon: Icon, heading, hint, primary }: DropZoneProps) {
  const idle = dark
    ? 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
  const active = dark ? 'border-red-500/50 bg-red-500/5' : 'border-red-400/50 bg-red-50'

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-200 group ${dragOver ? active : idle}`}
    >
      {primary && !dragOver && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-600/5 via-transparent to-transparent pointer-events-none" />
      )}
      <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
        primary
          ? 'bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-900/30'
          : dark ? 'bg-white/5' : 'bg-slate-100'
      }`}>
        <Icon className={`w-5 h-5 ${primary ? 'text-white' : dark ? 'text-slate-400' : 'text-slate-500'}`} />
      </div>
      <p className={`text-sm font-semibold leading-snug mb-1 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{heading}</p>
      <p className={`text-[11px] leading-snug ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>
    </div>
  )
}

function getOutputResumeHeadings(author: Author): string[] {
  const headings: string[] = []

  if ((author.aboutMe ?? author.bio ?? '').trim()) headings.push('Professional Summary')
  if ((author.skills?.length ?? 0) > 0 || (author.expertise?.length ?? 0) > 0 || (author.specializations?.length ?? 0) > 0 || (author.techStack ?? '').trim()) {
    headings.push('Technical Skills')
  }
  if ((author.interests?.length ?? 0) > 0) headings.push('Interests')
  if ((author.experience?.length ?? 0) > 0) headings.push('Professional Experience')
  if ((author.caseStudies?.length ?? 0) > 0 || (author.projects?.length ?? 0) > 0) headings.push('Projects')
  if ((author.education ?? '').trim()) headings.push('Education')
  if ((author.certifications?.length ?? 0) > 0) headings.push('Certifications')

  const supplements = author.sectionIntegrity?.supplementSections ?? []
  for (const sup of supplements) {
    if (sup?.title?.trim()) headings.push(`${sup.title.trim()} (Source excerpt)`)
  }

  return headings
}

function ResumeDiagnosticsPanels({
  exportErrors,
  renderAuthor,
  sourceHeadings,
  outputHeadings,
  previewPages,
  a4WidthPx,
  dark,
  txt,
  txtM,
  txtS,
  variant,
  uncappedWidth = false,
  showExportErrors = true,
  showHeadingsComparison = true,
  showSectionCheck = true,
  showPreviewPages = true,
}: {
  exportErrors: string[]
  renderAuthor: Author
  sourceHeadings: string[]
  outputHeadings: string[]
  previewPages: number
  a4WidthPx: number
  dark: boolean
  txt: string
  txtM: string
  txtS: string
  /** Narrow left rail stacks heading cards vertically; stacked mode uses responsive grid below A4-wide preview */
  variant: 'rail' | 'stacked'
  /** When stacked, drop A4 max-width so the block can fill the editor column beside the assistant rail */
  uncappedWidth?: boolean
  /** Hide individual panels (toolbar may show a subset). */
  showExportErrors?: boolean
  showHeadingsComparison?: boolean
  showSectionCheck?: boolean
  showPreviewPages?: boolean
}) {
  const rail = variant === 'rail'
  const capStyle = rail || uncappedWidth ? undefined : { maxWidth: a4WidthPx }
  const innerGridClass = rail
    ? 'flex flex-col gap-2.5'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'

  return (
    <>
      {showExportErrors && exportErrors.length > 0 && (
        <div
          className={`w-full rounded-xl border px-3 py-2.5 text-left ${dark ? 'bg-red-950/30 border-red-700/40 text-red-100' : 'bg-red-50 border-red-200 text-red-900'}`}
          style={capStyle}
        >
          <div className="text-xs font-bold">Fix before export</div>
          <ul className="text-[11px] mt-1 space-y-0.5">
            {exportErrors.map((e, i) => (
              <li key={`exp-err-${i}`}>- {e}</li>
            ))}
          </ul>
        </div>
      )}
      {showHeadingsComparison && renderAuthor.sectionIntegrity && (
        <div
          className={`w-full rounded-xl border px-3 py-2.5 text-left ${
            dark ? 'bg-white/[0.03] border-white/[0.10]' : 'bg-white border-slate-200'
          }`}
          style={capStyle}
        >
          <div className={`text-xs font-bold ${txt}`}>Headings: uploaded resume vs output resume</div>
          <div className={`mt-2 ${innerGridClass}`}>
            <div className={`rounded-lg border p-2 ${dark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
              <div className={`text-[10px] font-semibold mb-1 ${txtM}`}>Uploaded Resume Headings</div>
              {sourceHeadings.length > 0 ? (
                <ul className={`text-[11px] leading-snug space-y-0.5 ${txt}`}>
                  {sourceHeadings.map((h, idx) => (
                    <li key={`src-h-${idx}`}>• {h}</li>
                  ))}
                </ul>
              ) : (
                <p className={`text-[11px] ${txtS}`}>No detected source headings.</p>
              )}
            </div>
            <div className={`rounded-lg border p-2 ${dark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
              <div className={`text-[10px] font-semibold mb-1 ${txtM}`}>Output Resume Headings</div>
              {outputHeadings.length > 0 ? (
                <ul className={`text-[11px] leading-snug space-y-0.5 ${txt}`}>
                  {outputHeadings.map((h, idx) => (
                    <li key={`out-h-${idx}`}>• {h}</li>
                  ))}
                </ul>
              ) : (
                <p className={`text-[11px] ${txtS}`}>No output headings available.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {showSectionCheck && renderAuthor.sectionIntegrity && !renderAuthor.sectionIntegrity.allStructuredSectionsMatchSource && (
        <div
          className={`w-full flex gap-2 rounded-xl border px-3 py-2.5 text-left ${
            dark ? 'bg-amber-950/40 border-amber-600/30 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
          style={capStyle}
        >
          <AlertCircle className={`shrink-0 w-4 h-4 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-700'}`} />
          <div className="min-w-0">
            <div className="text-xs font-bold">Section check — source vs parsed output</div>
            <p className={`text-[11px] mt-1 leading-snug ${dark ? 'text-amber-200/90' : 'text-amber-900/80'}`}>
              These headings were found in your uploaded resume but structured fields were empty or incomplete:{' '}
              <span className="font-semibold">
                {(renderAuthor.sectionIntegrity.issues ?? []).map(i => i.title).filter(Boolean).join(', ') ||
                  'see highlighted sections below'}
              </span>
              . The resume preview below adds highlighted &quot;Source excerpt&quot; blocks so nothing is dropped before you export.
            </p>
          </div>
        </div>
      )}
      {showPreviewPages && (
        <div className={`w-full text-[10px] ${txtS}`} style={capStyle}>
          Preview pages: <span className={`font-semibold ${txtM}`}>{previewPages}</span> (full A4 height, 297 mm per sheet — no extra blank pages)
        </div>
      )}
    </>
  )
}

type MainSectionKey = 'summary' | 'technicalSkills' | 'experience' | 'projects' | 'education' | 'certifications'
type SidebarSectionKey = 'technicalSkills' | 'languages' | 'interests'
type SectionScope = 'main' | 'sidebar'
type LayoutConfig = {
  main: MainSectionKey[]
  sidebar: SidebarSectionKey[]
  hidden: Array<MainSectionKey | SidebarSectionKey>
}
type EditSnapshot = { author: Author; layout: LayoutConfig; textBoxes: CanvasTextBox[] }
type EditHistory = { past: EditSnapshot[]; future: EditSnapshot[] }
type InlineHtmlMap = Record<string, string>
type CanvasTextBox = { id: string; x: number; y: number; text: string; kind: 'heading' | 'text' | 'points'; width: number }
type CanvasTextBoxesById = Record<string, CanvasTextBox[]>
type PromptSectionKey = MainSectionKey | SidebarSectionKey | null

const DEFAULT_LAYOUT: LayoutConfig = {
  main: ['summary', 'experience', 'projects', 'education', 'certifications'],
  sidebar: ['technicalSkills', 'languages', 'interests'],
  hidden: [],
}

const MAIN_SECTIONS: { key: MainSectionKey; label: string }[] = [
  { key: 'summary', label: 'Summary Header' },
  { key: 'experience', label: 'Professional Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'education', label: 'Education' },
  { key: 'certifications', label: 'Certifications' },
]

const SIDEBAR_SECTIONS: { key: SidebarSectionKey; label: string }[] = [
  { key: 'technicalSkills', label: 'Technical Skills' },
  { key: 'languages', label: 'Languages' },
  { key: 'interests', label: 'Interests' },
]

function cloneAuthor(author: Author): Author {
  return JSON.parse(JSON.stringify(author)) as Author
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function autosaveKey(resumeName: string): string {
  return `resumeforge.edits.v1.${resumeName.toLowerCase().replace(/\s+/g, '_')}`
}

function promptChatStorageKey(resumeInternalId: string): string {
  return `resumeforge.promptchat.v1.${resumeInternalId}`
}

type PromptChatTurn = { role: 'user' | 'assistant'; content: string }

async function extractJdPlainTextForChat(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return (await file.text()).trim()
  if (lower.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer })
    return (value ?? '').trim()
  }
  return `[Uploaded JD: ${file.name} — use .txt or .docx here for full text in chat, or rely on JD from the original parse (verbatimJobDescriptionText).]`
}

function setEditableAttrOnHtml(html: string, editable: boolean): string {
  const attr = editable ? 'true' : 'false'
  if (/contenteditable=\"(true|false)\"/i.test(html)) {
    return html.replace(/contenteditable=\"(true|false)\"/i, `contenteditable="${attr}"`)
  }
  return html.replace('id="resume-document-template"', `id="resume-document-template" contenteditable="${attr}"`)
}

function validateResumeForExport(author: Author): string[] {
  const errs: string[] = []
  if (!(author.name ?? '').trim()) errs.push('Name is empty')
  if (!(author.role ?? '').trim()) errs.push('Role is empty')

  const hasSummary = Boolean((author.aboutMe ?? author.bio ?? '').trim())
  const hasExp = (author.experience?.length ?? 0) > 0
  const hasProjects = (author.projects?.length ?? 0) > 0 || (author.caseStudies?.length ?? 0) > 0
  if (!hasSummary && !hasExp && !hasProjects) {
    errs.push('Add at least one section: summary, experience, or projects')
  }
  return errs
}

function snapPercent(value: number, guides: Array<{ id: number; axis: 'x' | 'y'; pos: number }>, axis: 'x' | 'y'): number {
  const candidates = guides.filter(g => g.axis === axis).map(g => g.pos)
  candidates.push(0, 25, 50, 75, 100)
  let best = value
  let bestDiff = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const d = Math.abs(value - c)
    if (d < bestDiff) {
      bestDiff = d
      best = c
    }
  }
  // snap threshold
  return bestDiff <= 2.5 ? best : value
}

function mapPromptSectionKey(raw: string): PromptSectionKey {
  const k = raw.toLowerCase().trim()
  if (k.includes('summary') || k.includes('profile') || k.includes('objective')) return 'summary'
  if (k.includes('experience') || k.includes('employment') || k.includes('work history')) return 'experience'
  if (k.includes('project')) return 'projects'
  if (k.includes('education') || k.includes('academic')) return 'education'
  if (k.includes('cert')) return 'certifications'
  if (k.includes('technical skill')) return 'technicalSkills'
  if (k.includes('skill')) return 'technicalSkills'
  if (k.includes('language')) return 'languages'
  if (k.includes('interest') || k.includes('hobby')) return 'interests'
  if (k.includes('supplement') || k.includes('source') || k.includes('achievement')) return null
  return null
}

/** Resolve layout section key from phrases like "hide projects" or "remove section: education". */
function inferHideSectionKeyFromPrompt(fullCommand: string): PromptSectionKey {
  const trimmed = fullCommand.trim()
  const lowered = trimmed.toLowerCase()
  const stripped = trimmed.replace(/^(hide|remove|disable|delete|show)\s*(the)?\s*(section)?\s*[:\s-]*/i, '').trim()
  const fromColon = /\bsection\s*[:\s-]+\s*(.+)$/i.exec(lowered)?.[1]?.trim() ?? ''
  return mapPromptSectionKey(stripped || fromColon || fullCommand)
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const dark = false
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jdExtractedText, setJdExtractedText] = useState('')
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editedById, setEditedById] = useState<Record<string, Author>>({})
  const [layoutById, setLayoutById] = useState<Record<string, LayoutConfig>>({})
  const [historyById, setHistoryById] = useState<Record<string, EditHistory>>({})
  const [inlineHtmlById, setInlineHtmlById] = useState<InlineHtmlMap>({})
  const [textBoxesById, setTextBoxesById] = useState<CanvasTextBoxesById>({})
  const [jsonDraft, setJsonDraft] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [exportErrors, setExportErrors] = useState<string[]>([])
  const [fontSizePt, setFontSizePt] = useState('12')
  const [selectionClipboardHtml, setSelectionClipboardHtml] = useState('')
  const [showRulerGuides, setShowRulerGuides] = useState(true)
  const [draggingLine, setDraggingLine] = useState<{ expIndex: number; lineIndex: number } | null>(null)
  const [draggingGuideId, setDraggingGuideId] = useState<number | null>(null)
  const [activeGuideId, setActiveGuideId] = useState<number | null>(null)
  const [customGuides, setCustomGuides] = useState<Array<{ id: number; axis: 'x' | 'y'; pos: number }>>([])
  const [nextGuideId, setNextGuideId] = useState(1)
  const [placingTextBox, setPlacingTextBox] = useState(false)
  const [placingTextBoxKind, setPlacingTextBoxKind] = useState<'heading' | 'text' | 'points'>('text')
  const [draggingTextBoxId, setDraggingTextBoxId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [resizingTextBoxId, setResizingTextBoxId] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; width: number }>({ x: 0, width: 40 })
  const [promptDraft, setPromptDraft] = useState('')
  const [promptFeedback, setPromptFeedback] = useState<string | null>(null)
  const [promptApplying, setPromptApplying] = useState(false)
  const [promptChatById, setPromptChatById] = useState<Record<string, PromptChatTurn[]>>({})
  const [activeLineTarget, setActiveLineTarget] = useState('line1')
  const [dragging, setDragging] = useState<{ scope: SectionScope; key: MainSectionKey | SidebarSectionKey } | null>(null)
  const [dragOverSection, setDragOverSection] = useState<{ scope: SectionScope; key: MainSectionKey | SidebarSectionKey } | null>(null)
  const [jdDrag, setJdDrag] = useState(false)
  const [resumeDrag, setResumeDrag] = useState(false)

  const jdRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)
  const mockRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const textBoxDraftRef = useRef<Record<string, string>>({})
  const [previewPages, setPreviewPages] = useState(1)

  const selected = resumeFiles.find(r => r.id === selectedId)
  const previewAuthor = selected ? (editedById[selected.id] ?? selected.result) : undefined
  const activeLayout = selected ? (layoutById[selected.id] ?? DEFAULT_LAYOUT) : DEFAULT_LAYOUT
  const done = resumeFiles.filter(r => r.status === 'done')
  const pendingCount = resumeFiles.filter(r => r.status === 'pending' || r.status === 'error').length
  const selectedDoneIdx = done.findIndex(r => r.id === selectedId)
  const sourceHeadings = selected?.result?.sectionIntegrity?.sourceSectionsDetected ?? []
  const outputHeadings = previewAuthor ? getOutputResumeHeadings(previewAuthor) : []
  const MM_TO_PX = 96 / 25.4
  const A4_WIDTH_PX = Math.round(210 * MM_TO_PX)
  const PAGE_HEIGHT_PX = Math.round(297 * MM_TO_PX)
  const PREVIEW_PAGE_GAP_PX = 14
  const PRINT_TOP_MARGIN_MM = 6
  const PRINT_BOTTOM_SAFE_ZONE_MM = 6
  const PRINTABLE_PAGE_HEIGHT_PX = Math.round((297 - PRINT_TOP_MARGIN_MM - PRINT_BOTTOM_SAFE_ZONE_MM) * MM_TO_PX)
  const canUndo = Boolean(selected && (historyById[selected.id]?.past.length ?? 0) > 0)
  const canRedo = Boolean(selected && (historyById[selected.id]?.future.length ?? 0) > 0)

  const inlineHtml = selected ? inlineHtmlById[selected.id] : undefined
  const selectedTextBoxes = selected
    ? (textBoxesById[selected.id] ?? []).map(tb => ({
        ...tb,
        width: Number.isFinite(tb.width) && tb.width > 0 ? tb.width : (tb.kind === 'heading' ? 42 : 48),
      }))
    : []

  // ── drag handlers ──
  const handleJdDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setJdDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) setJdFile(f)
  }, [])

  const handleResumeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setResumeDrag(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  function addFiles(files: File[]) {
    setResumeFiles(prev => [
      ...prev,
      ...files.map(f => ({ id: uid(), file: f, name: f.name, status: 'pending' as const })),
    ])
  }

  async function extractDocxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer })
    return value?.trim() ?? ''
  }

  function buildFallbackMockFromFile(file: File, rawText?: string): Author {
    const inferredName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Mock Candidate'
    const cleaned = (rawText ?? '').replace(/\s+/g, ' ').trim()
    return {
      id: `mock-${uid()}`,
      name: inferredName,
      role: 'Mock Resume (Editable)',
      aboutMe: cleaned
        ? cleaned.slice(0, 420)
        : 'Mock profile loaded without AI parsing. Use canvas tools and inline edit to format content as needed.',
      skills: [
        { name: 'Communication', level: 70 },
        { name: 'Problem Solving', level: 70 },
      ],
      interests: ['Data', 'Engineering'],
      experience: [
        {
          role: 'Role from mock upload',
          company: 'Company Name',
          period: 'YYYY - YYYY',
          highlights: [
            `Source file: ${file.name}`,
            'Edit this section directly in canvas tools.',
          ],
        },
      ],
      projects: [
        {
          title: 'Mock Project',
          description: 'Replace with actual project details from your uploaded document.',
        },
      ],
      education: 'Add education details from uploaded file',
      certifications: [],
      sectionIntegrity: {
        sourceSectionsDetected: ['Technical Skills', 'Professional Experience', 'Projects', 'Education'],
        gapsCount: 0,
        allStructuredSectionsMatchSource: true,
        issues: [],
        supplementSections: [],
      },
    }
  }

  async function loadMockResumeFromFile(file: File) {
    try {
      const lower = file.name.toLowerCase()
      let mock: Author
      if (lower.endsWith('.json')) {
        const raw = await file.text()
        const parsed = JSON.parse(raw) as Partial<Author>
        mock = {
          id: parsed.id ?? `mock-${uid()}`,
          name: parsed.name ?? 'Mock Candidate',
          ...parsed,
        } as Author
      } else if (lower.endsWith('.txt')) {
        const raw = await file.text()
        mock = buildFallbackMockFromFile(file, raw)
      } else if (lower.endsWith('.docx')) {
        const raw = await extractDocxText(file)
        mock = buildFallbackMockFromFile(file, raw)
      } else if (lower.endsWith('.pdf') || lower.endsWith('.doc')) {
        // PDF/DOC are loaded in manual editable mode without external parsing APIs.
        mock = buildFallbackMockFromFile(file)
      } else {
        alert('Unsupported file for mock upload. Use PDF, DOC, DOCX, TXT, or JSON.')
        return
      }

      const rf: ResumeFile = {
        id: uid(),
        file,
        name: file.name,
        status: 'done',
        result: mock,
      }
      setResumeFiles(prev => [...prev, rf])
      setSelectedId(rf.id)
      setEditorOpen(false)
    } catch (e) {
      alert('Could not load mock file. For JSON, upload a valid resume JSON object; for PDF/DOC/DOCX/TXT, we load editable mock mode.')
    }
  }

  useEffect(() => {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const selectedResult = selected.result
    let loadedAuthor: Author | null = null
    let loadedLayout: LayoutConfig | null = null
    try {
      const raw = localStorage.getItem(autosaveKey(selected.name))
      if (raw) {
        const parsed = JSON.parse(raw) as { author?: Author; layout?: LayoutConfig; inlineHtml?: string; textBoxes?: CanvasTextBox[] }
        if (parsed?.author) loadedAuthor = parsed.author
        if (parsed?.layout) loadedLayout = parsed.layout
        if (parsed?.inlineHtml) {
          setInlineHtmlById(prev => ({ ...prev, [selected.id]: setEditableAttrOnHtml(parsed.inlineHtml as string, editorOpen) }))
        }
        if (Array.isArray(parsed?.textBoxes)) {
          setTextBoxesById(prev => ({ ...prev, [selected.id]: parsed.textBoxes as CanvasTextBox[] }))
        }
      }
    } catch {
      // ignore malformed local storage
    }

    setEditedById(prev => {
      if (prev[selected.id]) return prev
      const baseAuthor = loadedAuthor ?? cloneAuthor(selectedResult)
      const next = { ...prev, [selected.id]: baseAuthor }
      setJsonDraft(JSON.stringify(next[selected.id], null, 2))
      return next
    })
    setLayoutById(prev => (prev[selected.id] ? prev : { ...prev, [selected.id]: loadedLayout ?? { ...DEFAULT_LAYOUT } }))
    setHistoryById(prev => (prev[selected.id] ? prev : { ...prev, [selected.id]: { past: [], future: [] } }))
  }, [selected])

  useEffect(() => {
    let cancelled = false
    if (!jdFile) {
      setJdExtractedText('')
      return
    }
    ;(async () => {
      try {
        const extracted = await extractJdPlainTextForChat(jdFile)
        if (!cancelled) setJdExtractedText(extracted)
      } catch {
        if (!cancelled) setJdExtractedText(`[Could not read JD file: ${jdFile.name}]`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jdFile])

  useEffect(() => {
    if (!selectedId) return
    try {
      const raw = localStorage.getItem(promptChatStorageKey(selectedId))
      if (!raw) {
        setPromptChatById(prev => ({ ...prev, [selectedId]: [] }))
        return
      }
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        setPromptChatById(prev => ({ ...prev, [selectedId]: [] }))
        return
      }
      const turns: PromptChatTurn[] = []
      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue
        const r = (row as { role?: string; content?: unknown }).role
        const c = (row as { content?: unknown }).content
        if ((r === 'user' || r === 'assistant') && typeof c === 'string' && c.trim()) {
          turns.push({ role: r, content: c })
        }
      }
      setPromptChatById(prev => ({ ...prev, [selectedId]: turns }))
    } catch {
      setPromptChatById(prev => ({ ...prev, [selectedId]: [] }))
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    const turns = promptChatById[selectedId]
    if (turns === undefined) return
    try {
      localStorage.setItem(promptChatStorageKey(selectedId), JSON.stringify(turns))
    } catch {
      // storage full / disabled
    }
  }, [selectedId, promptChatById])

  useEffect(() => {
    if (!selected || !previewAuthor) {
      setPreviewPages(1)
      return
    }
    const updatePages = () => {
      // Do not run page-break heuristics on the live preview DOM — wrong offsetParent math caused
      // false breaks and huge blank gaps; print/export clones still run keepExperienceHeadingWithContent.
      const el = measureRef.current?.querySelector('#resume-printable-area') as HTMLElement | null
      const h = el?.scrollHeight ?? PAGE_HEIGHT_PX
      // Match print preview pagination by using printable content height
      // (A4 height minus top/bottom @page margins).
      setPreviewPages(Math.max(1, Math.ceil(h / PRINTABLE_PAGE_HEIGHT_PX)))
    }
    updatePages()
    const t = window.setTimeout(updatePages, 120)
    return () => window.clearTimeout(t)
  }, [selected, previewAuthor, activeLayout, editorOpen, inlineHtml, PRINTABLE_PAGE_HEIGHT_PX])

  useEffect(() => {
    if (!selected || !previewAuthor) return
    try {
      localStorage.setItem(
        autosaveKey(selected.name),
        JSON.stringify({ author: previewAuthor, layout: activeLayout, inlineHtml, textBoxes: selectedTextBoxes })
      )
    } catch {
      // local storage may be blocked; ignore
    }
  }, [selected, previewAuthor, activeLayout, inlineHtml, selectedTextBoxes])

  useEffect(() => {
    if (!selected) return
    const current = inlineHtmlById[selected.id]
    if (!current) return
    setInlineHtmlById(prev => ({ ...prev, [selected.id]: setEditableAttrOnHtml(current, editorOpen) }))
  }, [editorOpen, selected?.id])

  useEffect(() => {
    if (!selected || !previewAuthor) return
    setJsonDraft(JSON.stringify(previewAuthor, null, 2))
  }, [selected?.id, previewAuthor])

  useEffect(() => {
    if (!editorOpen || activeGuideId == null) return
    const onKey = (e: KeyboardEvent) => {
      const g = customGuides.find(x => x.id === activeGuideId)
      if (!g) return
      const step = e.shiftKey ? 2 : 0.5
      let nextPos = g.pos
      if (g.axis === 'x') {
        if (e.key === 'ArrowLeft') nextPos = g.pos - step
        else if (e.key === 'ArrowRight') nextPos = g.pos + step
        else return
      } else {
        if (e.key === 'ArrowUp') nextPos = g.pos - step
        else if (e.key === 'ArrowDown') nextPos = g.pos + step
        else return
      }
      e.preventDefault()
      const snapped = snapPercent(Math.max(0, Math.min(100, nextPos)), customGuides.filter(x => x.id !== g.id), g.axis)
      setCustomGuides(prev => prev.map(x => x.id === g.id ? { ...x, pos: snapped } : x))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, activeGuideId, customGuides])

  useEffect(() => {
    if (!draggingTextBoxId || !selected) return
    const onMove = (e: MouseEvent) => {
      const host = canvasRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      const x = Math.max(0, Math.min(96, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100))
      const y = Math.max(0, Math.min(98, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100))
      setTextBoxesById(prev => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map(tb => (tb.id === draggingTextBoxId ? { ...tb, x, y } : tb)),
      }))
    }
    const onUp = () => setDraggingTextBoxId(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingTextBoxId, dragOffset.x, dragOffset.y, selected])

  useEffect(() => {
    if (!resizingTextBoxId || !selected) return
    const onMove = (e: MouseEvent) => {
      const host = canvasRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      const deltaPct = ((e.clientX - resizeStart.x) / rect.width) * 100
      const nextWidth = Math.max(12, Math.min(90, resizeStart.width + deltaPct))
      setTextBoxesById(prev => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map(tb => (tb.id === resizingTextBoxId ? { ...tb, width: nextWidth } : tb)),
      }))
    }
    const onUp = () => setResizingTextBoxId(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingTextBoxId, resizeStart.x, resizeStart.width, selected])

  function applyJsonEdits() {
    if (!selected || selected.status !== 'done' || !selected.result) return
    try {
      const parsed = JSON.parse(jsonDraft)
      if (!parsed || typeof parsed !== 'object') throw new Error('JSON must be an object')
      const merged: Author = { ...cloneAuthor(selected.result), ...(parsed as Partial<Author>) }
      commitSnapshot(merged, activeLayout)
    } catch (e: any) {
      setJsonError(e?.message || 'Invalid JSON')
    }
  }

  function commitSnapshot(nextAuthor: Author, nextLayout: LayoutConfig) {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const currentAuthor = previewAuthor ?? cloneAuthor(selected.result)
    const currentLayout = activeLayout
    const currentTextBoxes = selectedTextBoxes
    setHistoryById(prev => {
      const cur = prev[selected.id] ?? { past: [], future: [] }
      const nextPast = [...cur.past, { author: cloneAuthor(currentAuthor), layout: { ...currentLayout }, textBoxes: currentTextBoxes.map(tb => ({ ...tb })) }]
      return { ...prev, [selected.id]: { past: nextPast.slice(-50), future: [] } }
    })
    setEditedById(prev => ({ ...prev, [selected.id]: nextAuthor }))
    setLayoutById(prev => ({ ...prev, [selected.id]: nextLayout }))
    setInlineHtmlById(prev => {
      if (!prev[selected.id]) return prev
      const next = { ...prev }
      delete next[selected.id]
      return next
    })
    setJsonDraft(JSON.stringify(nextAuthor, null, 2))
    setJsonError(null)
    setExportErrors([])
  }

  function commitTextBoxesSnapshot(nextTextBoxes: CanvasTextBox[]) {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const currentAuthor = previewAuthor ?? cloneAuthor(selected.result)
    const currentLayout = activeLayout
    const currentTextBoxes = selectedTextBoxes
    setHistoryById(prev => {
      const cur = prev[selected.id] ?? { past: [], future: [] }
      const nextPast = [...cur.past, { author: cloneAuthor(currentAuthor), layout: { ...currentLayout }, textBoxes: currentTextBoxes.map(tb => ({ ...tb })) }]
      return { ...prev, [selected.id]: { past: nextPast.slice(-50), future: [] } }
    })
    setTextBoxesById(prev => ({ ...prev, [selected.id]: nextTextBoxes.map(tb => ({ ...tb })) }))
  }

  function undoEdit() {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const selectedResult = selected.result
    setHistoryById(prev => {
      const cur = prev[selected.id]
      if (!cur || cur.past.length === 0) return prev
      const snap = cur.past[cur.past.length - 1]
      const currentAuthor = previewAuthor ?? cloneAuthor(selectedResult)
      const currentLayout = activeLayout
      const currentTextBoxes = selectedTextBoxes
      setEditedById(a => ({ ...a, [selected.id]: cloneAuthor(snap.author) }))
      setLayoutById(l => ({ ...l, [selected.id]: { ...snap.layout } }))
      setTextBoxesById(t => ({ ...t, [selected.id]: (snap.textBoxes ?? []).map(tb => ({ ...tb })) }))
      setJsonDraft(JSON.stringify(snap.author, null, 2))
      return {
        ...prev,
        [selected.id]: {
          past: cur.past.slice(0, -1),
          future: [{ author: cloneAuthor(currentAuthor), layout: { ...currentLayout }, textBoxes: currentTextBoxes.map(tb => ({ ...tb })) }, ...cur.future].slice(0, 50),
        },
      }
    })
  }

  function redoEdit() {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const selectedResult = selected.result
    setHistoryById(prev => {
      const cur = prev[selected.id]
      if (!cur || cur.future.length === 0) return prev
      const snap = cur.future[0]
      const currentAuthor = previewAuthor ?? cloneAuthor(selectedResult)
      const currentLayout = activeLayout
      const currentTextBoxes = selectedTextBoxes
      setEditedById(a => ({ ...a, [selected.id]: cloneAuthor(snap.author) }))
      setLayoutById(l => ({ ...l, [selected.id]: { ...snap.layout } }))
      setTextBoxesById(t => ({ ...t, [selected.id]: (snap.textBoxes ?? []).map(tb => ({ ...tb })) }))
      setJsonDraft(JSON.stringify(snap.author, null, 2))
      return {
        ...prev,
        [selected.id]: {
          past: [...cur.past, { author: cloneAuthor(currentAuthor), layout: { ...currentLayout }, textBoxes: currentTextBoxes.map(tb => ({ ...tb })) }].slice(-50),
          future: cur.future.slice(1),
        },
      }
    })
  }

  /** Ref updated each render — global ⌘/Ctrl+Z redo shortcuts call latest undo/redo. */
  const editorShortcutsRef = useRef({
    active: false,
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},
  })
  editorShortcutsRef.current = {
    active: Boolean(editorOpen && selected?.status === 'done'),
    canUndo,
    canRedo,
    undo: undoEdit,
    redo: redoEdit,
  }

  useEffect(() => {
    function onDocKeyDown(e: KeyboardEvent) {
      const x = editorShortcutsRef.current
      if (!x.active) return
      const t = e.target
      if (t instanceof HTMLElement) {
        const inAssistant = t.closest('[aria-label="Resume assistant"]')
        if (
          inAssistant &&
          (t instanceof HTMLInputElement ||
            t instanceof HTMLTextAreaElement ||
            t instanceof HTMLSelectElement ||
            t.isContentEditable)
        ) {
          return
        }
      }
      const meta = e.ctrlKey || e.metaKey
      if (!meta) return

      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        if (!x.canUndo) return
        e.preventDefault()
        x.undo()
        return
      }
      const redoChord = (k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey)
      if (redoChord) {
        if (!x.canRedo) return
        e.preventDefault()
        x.redo()
      }
    }
    window.addEventListener('keydown', onDocKeyDown, true)
    return () => window.removeEventListener('keydown', onDocKeyDown, true)
  }, [])

  function patchPreviewAuthor(patch: (prev: Author) => Author) {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const selectedResult = selected.result
    const base = previewAuthor ?? cloneAuthor(selectedResult)
    const nextAuthor = patch(base)
    commitSnapshot(nextAuthor, activeLayout)
  }

  function updateField<K extends keyof Author>(key: K, value: Author[K]) {
    patchPreviewAuthor(prev => ({ ...prev, [key]: value }))
  }

  function updateExperienceHighlights(index: number, raw: string) {
    patchPreviewAuthor(prev => {
      const exp = [...(prev.experience ?? [])]
      const row = exp[index]
      if (!row) return prev
      exp[index] = {
        ...row,
        highlights: raw.split('\n').map(s => s.trim()).filter(Boolean),
      }
      return { ...prev, experience: exp }
    })
  }

  function updateExperienceHighlightAt(expIndex: number, bulletIndex: number, value: string) {
    patchPreviewAuthor(prev => {
      const exp = [...(prev.experience ?? [])]
      const row = exp[expIndex]
      if (!row) return prev
      const highlights = [...(row.highlights ?? [])]
      if (bulletIndex < 0 || bulletIndex >= highlights.length) return prev
      highlights[bulletIndex] = value
      exp[expIndex] = { ...row, highlights }
      return { ...prev, experience: exp }
    })
  }

  function addExperienceRow() {
    patchPreviewAuthor(prev => {
      const list = [...(prev.experience ?? [])]
      list.push({
        role: 'New Role',
        company: 'Company',
        period: '',
        highlights: ['New highlight'],
      })
      return { ...prev, experience: list }
    })
  }

  function removeExperienceRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.experience ?? [])]
      if (index < 0 || index >= list.length) return prev
      list.splice(index, 1)
      return { ...prev, experience: list }
    })
  }

  function addExperienceHighlight(expIndex: number) {
    patchPreviewAuthor(prev => {
      const exp = [...(prev.experience ?? [])]
      const row = exp[expIndex]
      if (!row) return prev
      const highlights = [...(row.highlights ?? []), 'New highlight']
      exp[expIndex] = { ...row, highlights }
      return { ...prev, experience: exp }
    })
  }

  function removeExperienceHighlight(expIndex: number, bulletIndex: number) {
    patchPreviewAuthor(prev => {
      const exp = [...(prev.experience ?? [])]
      const row = exp[expIndex]
      if (!row) return prev
      const highlights = [...(row.highlights ?? [])]
      if (bulletIndex < 0 || bulletIndex >= highlights.length) return prev
      highlights.splice(bulletIndex, 1)
      exp[expIndex] = { ...row, highlights }
      return { ...prev, experience: exp }
    })
  }

  function moveExperienceHighlight(expIndex: number, from: number, to: number) {
    patchPreviewAuthor(prev => {
      const exp = [...(prev.experience ?? [])]
      const row = exp[expIndex]
      if (!row) return prev
      const lines = [...(row.highlights ?? [])]
      if (from < 0 || from >= lines.length || to < 0 || to >= lines.length || from === to) return prev
      const [moved] = lines.splice(from, 1)
      lines.splice(to, 0, moved)
      exp[expIndex] = { ...row, highlights: lines }
      return { ...prev, experience: exp }
    })
  }

  function updateProjectDescription(index: number, raw: string) {
    patchPreviewAuthor(prev => {
      const projects = [...(prev.projects ?? [])]
      const row = projects[index]
      if (!row) return prev
      projects[index] = { ...row, description: raw }
      return { ...prev, projects }
    })
  }

  function addProjectRow() {
    patchPreviewAuthor(prev => {
      const projects = [...(prev.projects ?? [])]
      projects.push({
        title: 'New Project',
        description: 'Describe the project impact and outcome.',
        technology: '',
        link: '',
      })
      return { ...prev, projects }
    })
  }

  function removeProjectRow(index: number) {
    patchPreviewAuthor(prev => {
      const projects = [...(prev.projects ?? [])]
      if (index < 0 || index >= projects.length) return prev
      projects.splice(index, 1)
      return { ...prev, projects }
    })
  }

  function moveExperienceRow(index: number, direction: -1 | 1) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.experience ?? [])]
      const snapDown = customGuides.some(g => g.axis === 'y' && g.pos >= 60)
      const snapUp = customGuides.some(g => g.axis === 'y' && g.pos <= 40)
      const step = direction > 0 && snapDown ? 2 : direction < 0 && snapUp ? 2 : 1
      const next = index + (direction * step)
      if (index < 0 || index >= list.length || next < 0 || next >= list.length) return prev
      const [item] = list.splice(index, 1)
      list.splice(next, 0, item)
      return { ...prev, experience: list }
    })
  }

  function duplicateExperienceRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.experience ?? [])]
      const item = list[index]
      if (!item) return prev
      list.splice(index + 1, 0, { ...item, highlights: [...(item.highlights ?? [])] })
      return { ...prev, experience: list }
    })
  }

  function moveProjectRow(index: number, direction: -1 | 1) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.projects ?? [])]
      const snapDown = customGuides.some(g => g.axis === 'y' && g.pos >= 60)
      const snapUp = customGuides.some(g => g.axis === 'y' && g.pos <= 40)
      const step = direction > 0 && snapDown ? 2 : direction < 0 && snapUp ? 2 : 1
      const next = index + (direction * step)
      if (index < 0 || index >= list.length || next < 0 || next >= list.length) return prev
      const [item] = list.splice(index, 1)
      list.splice(next, 0, item)
      return { ...prev, projects: list }
    })
  }

  function duplicateProjectRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.projects ?? [])]
      const item = list[index]
      if (!item) return prev
      list.splice(index + 1, 0, { ...item })
      return { ...prev, projects: list }
    })
  }

  function addSkillRow() {
    patchPreviewAuthor(prev => ({
      ...prev,
      skills: [...(prev.skills ?? []), { name: 'New Skill', level: 70 }],
    }))
  }

  function removeSkillRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.skills ?? [])]
      if (index < 0 || index >= list.length) return prev
      list.splice(index, 1)
      return { ...prev, skills: list }
    })
  }

  function addInterestRow() {
    patchPreviewAuthor(prev => ({ ...prev, interests: [...(prev.interests ?? []), 'New interest'] }))
  }

  function removeInterestRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.interests ?? [])]
      if (index < 0 || index >= list.length) return prev
      list.splice(index, 1)
      return { ...prev, interests: list }
    })
  }

  function addCertificationRow() {
    patchPreviewAuthor(prev => ({
      ...prev,
      certifications: [...(prev.certifications ?? []), { name: 'New Certification', url: '' }],
    }))
  }

  function removeCertificationRow(index: number) {
    patchPreviewAuthor(prev => {
      const list = [...(prev.certifications ?? [])]
      if (index < 0 || index >= list.length) return prev
      list.splice(index, 1)
      return { ...prev, certifications: list }
    })
  }

  function resetEdits() {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const base = cloneAuthor(selected.result)
    setEditedById(prev => ({ ...prev, [selected.id]: base }))
    setLayoutById(prev => ({ ...prev, [selected.id]: { ...DEFAULT_LAYOUT } }))
    setHistoryById(prev => ({ ...prev, [selected.id]: { past: [], future: [] } }))
    setInlineHtmlById(prev => {
      const next = { ...prev }
      delete next[selected.id]
      return next
    })
    setJsonDraft(JSON.stringify(base, null, 2))
    setJsonError(null)
    setExportErrors([])
  }

  function toggleHiddenSection(key: MainSectionKey | SidebarSectionKey) {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const cur = activeLayout
    const hidden = cur.hidden.includes(key) ? cur.hidden.filter(k => k !== key) : [...cur.hidden, key]
    const nextLayout: LayoutConfig = { ...cur, hidden }
    commitSnapshot(previewAuthor ?? cloneAuthor(selected.result), nextLayout)
  }

  function dropSection(scope: SectionScope, targetKey: MainSectionKey | SidebarSectionKey) {
    if (!selected || selected.status !== 'done' || !selected.result || !dragging || dragging.scope !== scope || dragging.key === targetKey) return
    const cur = activeLayout
    let nextLayout: LayoutConfig | null = null
    if (scope === 'main') {
      const from = cur.main.indexOf(dragging.key as MainSectionKey)
      const to = cur.main.indexOf(targetKey as MainSectionKey)
      if (from >= 0 && to >= 0) nextLayout = { ...cur, main: reorder(cur.main, from, to) }
    } else {
      const from = cur.sidebar.indexOf(dragging.key as SidebarSectionKey)
      const to = cur.sidebar.indexOf(targetKey as SidebarSectionKey)
      if (from >= 0 && to >= 0) nextLayout = { ...cur, sidebar: reorder(cur.sidebar, from, to) }
    }
    if (nextLayout) commitSnapshot(previewAuthor ?? cloneAuthor(selected.result), nextLayout)
  }

  function moveSectionByStep(scope: SectionScope, key: MainSectionKey | SidebarSectionKey, direction: -1 | 1) {
    if (!selected || selected.status !== 'done' || !selected.result) return
    const cur = activeLayout
    let nextLayout: LayoutConfig | null = null
    if (scope === 'main') {
      const from = cur.main.indexOf(key as MainSectionKey)
      const to = from + direction
      if (from >= 0 && to >= 0 && to < cur.main.length) {
        nextLayout = { ...cur, main: reorder(cur.main, from, to) }
      }
    } else {
      const from = cur.sidebar.indexOf(key as SidebarSectionKey)
      const to = from + direction
      if (from >= 0 && to >= 0 && to < cur.sidebar.length) {
        nextLayout = { ...cur, sidebar: reorder(cur.sidebar, from, to) }
      }
    }
    if (nextLayout) commitSnapshot(previewAuthor ?? cloneAuthor(selected.result), nextLayout)
  }

  function hideSectionDirect(key: MainSectionKey | SidebarSectionKey) {
    if (activeLayout.hidden.includes(key)) return
    toggleHiddenSection(key)
  }

  // ── process ──
  async function processAll() {
    const queue = resumeFiles.filter(r => r.status === 'pending' || r.status === 'error')
    if (!queue.length) return
    setProcessing(true)
    for (const rf of queue) {
      setResumeFiles(prev => prev.map(r => r.id === rf.id ? { ...r, status: 'processing' } : r))
      setSelectedId(rf.id)
      try {
        const fd = new FormData()
        fd.append('resume', rf.file)
        if (jdFile) fd.append('jd', jdFile)
        const { data } = await axios.post<Author>('/api/parse-resume', fd)
        setResumeFiles(prev => prev.map(r => r.id === rf.id ? { ...r, status: 'done', result: data } : r))
        setInlineHtmlById(prev => {
          const next = { ...prev }
          delete next[rf.id]
          return next
        })
        setSelectedId(rf.id)
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err.message || 'Processing failed'
        setResumeFiles(prev => prev.map(r => r.id === rf.id ? { ...r, status: 'error', error: msg } : r))
      }
    }
    setProcessing(false)
  }

  function remove(id: string) {
    const fileName = resumeFiles.find(r => r.id === id)?.name
    if (fileName) {
      try { localStorage.removeItem(autosaveKey(fileName)) } catch { /* ignore */ }
    }
    setResumeFiles(prev => prev.filter(r => r.id !== id))
    setEditedById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setLayoutById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setInlineHtmlById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setTextBoxesById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setHistoryById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setPromptChatById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try { localStorage.removeItem(promptChatStorageKey(id)) } catch { /* ignore */ }
    if (selectedId === id) {
      const rem = resumeFiles.filter(r => r.id !== id && r.status === 'done')
      setSelectedId(rem.length ? rem[0].id : null)
    }
  }

  function reset() {
    for (const rf of resumeFiles) {
      try { localStorage.removeItem(autosaveKey(rf.name)) } catch { /* ignore */ }
    }
    setResumeFiles([]); setJdFile(null); setJdExtractedText(''); setSelectedId(null)
    setEditedById({})
    setLayoutById({})
    setHistoryById({})
    setInlineHtmlById({})
    setTextBoxesById({})
    setPromptChatById({})
    setJsonDraft('')
    setJsonError(null)
    setExportErrors([])
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('resumeforge.promptchat.v1.'))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
  }

  function selectionInsideResume(): boolean {
    const root = previewRef.current?.querySelector('#resume-document-template')
    if (!root) return false
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    const node = sel.anchorNode
    return !!node && root.contains(node)
  }

  function applyTextCommand(command: string, value?: string) {
    if (!editorOpen || !selectionInsideResume()) return
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(command, false, value)
    const root = previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null
    if (root && selected) {
      setInlineHtmlById(prev => ({ ...prev, [selected.id]: root.outerHTML }))
    }
  }

  function applySelectionInlineStyle(styleName: keyof CSSStyleDeclaration, value: string) {
    if (!editorOpen || !selectionInsideResume()) return
    const sel = window.getSelection()
    const target = sel?.anchorNode?.nodeType === Node.TEXT_NODE
      ? sel.anchorNode?.parentElement
      : (sel?.anchorNode as HTMLElement | null)
    if (!target) return
    ;(target.style as any)[styleName] = value
    const root = previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null
    if (root && selected) {
      setInlineHtmlById(prev => ({ ...prev, [selected.id]: root.outerHTML }))
    }
  }

  function captureSelectionToClipboard() {
    if (!editorOpen || !selectionInsideResume()) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0).cloneRange()
    const frag = range.cloneContents()
    const wrap = document.createElement('div')
    wrap.appendChild(frag)
    const html = wrap.innerHTML.trim()
    if (!html) return
    setSelectionClipboardHtml(html)
  }

  function pasteSelectionFromClipboard() {
    if (!editorOpen || !selectionInsideResume() || !selectionClipboardHtml) return
    document.execCommand('insertHTML', false, selectionClipboardHtml)
    const root = previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null
    if (root && selected) {
      setInlineHtmlById(prev => ({ ...prev, [selected.id]: root.outerHTML }))
    }
  }

  function deleteSelectedText() {
    if (!editorOpen || !selectionInsideResume()) return
    document.execCommand('delete')
    const root = previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null
    if (root && selected) {
      setInlineHtmlById(prev => ({ ...prev, [selected.id]: root.outerHTML }))
    }
  }

  function applySelectionFontSizePt() {
    if (!editorOpen || !selectionInsideResume()) return
    const parsed = Number.parseFloat(fontSizePt)
    if (!Number.isFinite(parsed) || parsed < 8 || parsed > 32) return
    applySelectionInlineStyle('fontSize', `${parsed}pt`)
  }

  function addTextBoxAt(clientX: number, clientY: number, host: HTMLElement, kind: 'heading' | 'text' | 'points') {
    if (!selected) return
    const rect = host.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = Math.max(0, Math.min(96, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(98, ((clientY - rect.top) / rect.height) * 100))
    const next: CanvasTextBox = {
      id: `tb-${uid()}`,
      x,
      y,
      kind,
      width: kind === 'heading' ? 42 : 48,
      text: kind === 'heading' ? 'New Heading' : kind === 'points' ? '• Point 1\n• Point 2' : 'Type text',
    }
    commitTextBoxesSnapshot([...(selectedTextBoxes ?? []), next])
  }

  function updateTextBox(id: string, patch: Partial<CanvasTextBox>) {
    if (!selected) return
    commitTextBoxesSnapshot((selectedTextBoxes ?? []).map(tb => (tb.id === id ? { ...tb, ...patch } : tb)))
  }

  function removeTextBox(id: string) {
    if (!selected) return
    commitTextBoxesSnapshot((selectedTextBoxes ?? []).filter(tb => tb.id !== id))
  }

  async function applyPromptEdits() {
    const command = promptDraft.trim()
    if (!command || !selected || !previewAuthor || promptApplying) return
    const applyLocalPromptFallback = () => {
      const lower = command.toLowerCase()
      let changed = false
      if ((lower.includes('remove') || lower.includes('delete')) && lower.includes('skill')) {
        patchPreviewAuthor(prev => {
          const skills = [...(prev.skills ?? [])]
          if (skills.length <= 1) return prev
          const removeCount = lower.includes('some') ? Math.min(2, skills.length - 1) : 1
          return { ...prev, skills: skills.slice(0, skills.length - removeCount) }
        })
        changed = true
      } else if (/(set|update|change).*(summary|about)/i.test(command)) {
        const value = command.replace(/^(set|update|change)\s*(the)?\s*(summary|about)[:\s-]*/i, '').trim()
        if (value) {
          updateField('aboutMe', value)
          changed = true
        }
      } else if (/(add|insert|include).*skill/i.test(command)) {
        let value = ''
        const afterColon = /skill[s]?\s*:\s*(.+)$/i.exec(command)?.[1]?.trim()
        const afterQuoted = /skill[s]?\s+['"]([^'"]+)['"]/i.exec(command)?.[1]?.trim()
        if (afterColon) value = afterColon
        else if (afterQuoted) value = afterQuoted
        else {
          value = command.replace(/^(add|insert|include)\s*(a)?\s*skill[s]?\s*/i, '').replace(/^[:\s-]+/, '').trim()
        }
        if (value) {
          const levelMatch = /(\d{1,3})\s*%/.exec(lower)
          const level = levelMatch ? Math.min(100, Math.max(10, parseInt(levelMatch[1], 10))) : 70
          patchPreviewAuthor(prev => ({ ...prev, skills: [...(prev.skills ?? []), { name: value, level }] }))
          changed = true
        }
      } else if (/(hide|remove|disable|delete)\s*(section)?\b/i.test(lower) || /^hide\b/i.test(lower.trim())) {
        const key = inferHideSectionKeyFromPrompt(command)
        if (key && !activeLayout.hidden.includes(key)) {
          commitSnapshot(previewAuthor, { ...activeLayout, hidden: [...activeLayout.hidden, key] })
          changed = true
        }
      }
      return changed
    }
    const resumeId = selected.id
    const priorMessages = (promptChatById[resumeId] ?? []).slice(-24)
    const jdMerged = [jdExtractedText.trim(), (previewAuthor.verbatimJobDescriptionText ?? '').trim()].filter(Boolean).join('\n\n---\n\n')
    const resumeMerged = (previewAuthor.verbatimResumeText ?? '').trim()

    setPromptApplying(true)
    setPromptFeedback(null)
    try {
      const { data } = await axios.post<{
        updatedAuthor?: Partial<Author>
        updatedLayout?: Partial<LayoutConfig>
        assistantMessage?: string
      }>('/api/prompt-edit', {
        author: previewAuthor,
        prompt: command,
        layout: activeLayout,
        messages: priorMessages,
        jd_text: jdMerged || undefined,
        resume_text: resumeMerged || undefined,
      })
      const mergedFromServer = data?.updatedAuthor
      if (!mergedFromServer || typeof mergedFromServer !== 'object') {
        throw new Error('Server returned invalid updatedAuthor payload')
      }
      const base = cloneAuthor(previewAuthor)
      const nextAuthor: Author = { ...base, ...(mergedFromServer as Partial<Author>) } as Author
      const ul = data.updatedLayout as Partial<LayoutConfig> | undefined
      const nextLayout: LayoutConfig =
        ul && typeof ul === 'object'
          ? {
              main: (Array.isArray(ul.main) ? ul.main : activeLayout.main) as MainSectionKey[],
              sidebar: (Array.isArray(ul.sidebar) ? ul.sidebar : activeLayout.sidebar) as SidebarSectionKey[],
              hidden: (Array.isArray(ul.hidden) ? ul.hidden : activeLayout.hidden) as Array<
                MainSectionKey | SidebarSectionKey
              >,
            }
          : activeLayout
      commitSnapshot(nextAuthor, nextLayout)
      const assistantReply =
        typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()
          ? data.assistantMessage.trim()
          : 'Updated the resume JSON from your request.'
      setPromptChatById(prev => ({
        ...prev,
        [resumeId]: [...(prev[resumeId] ?? []), { role: 'user', content: command }, { role: 'assistant', content: assistantReply }],
      }))
      setPromptFeedback('Applied prompt — preview and JSON updated.')
      setPromptDraft('')
      setJsonError(null)
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err && 'response' in err ? (err as { response?: { status?: number } }).response?.status : undefined
      const changed = applyLocalPromptFallback()
      if (changed) {
        const localAssist =
          status === 404
            ? 'Applied your request locally (API unreachable — edits used offline rules only).'
            : 'Applied your request locally using offline-style rules.'
        setPromptChatById(prev => ({
          ...prev,
          [resumeId]: [...(prev[resumeId] ?? []), { role: 'user', content: command }, { role: 'assistant', content: localAssist }],
        }))
        setPromptFeedback(
          status === 404
            ? 'Applied prompt locally (API unavailable — check backend running).'
            : 'Applied prompt locally (offline-style rules).'
        )
        setPromptDraft('')
      } else {
        let msg = err instanceof Error ? err.message : 'Prompt edit failed'
        const ax = typeof err === 'object' && err && 'response' in err ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : undefined
        if (typeof ax === 'string') msg = ax
        setPromptFeedback(`Prompt apply failed: ${msg}`)
      }
    } finally {
      setPromptApplying(false)
    }
  }

  function clearPromptChatForSelection() {
    if (!selectedId) return
    setPromptChatById(prev => ({ ...prev, [selectedId]: [] }))
  }

  /** Y position of element relative to #resume-printable-area top (offsetTop is wrong here — offsetParent chain). */
  function getTopWithinPrintableArea(root: HTMLElement, el: HTMLElement): number {
    const printable = root.querySelector('#resume-printable-area') as HTMLElement | null
    if (!printable) {
      return el.offsetTop
    }
    const pr = printable.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    return er.top - pr.top + printable.scrollTop
  }

  function posModPage(y: number, pageH: number): number {
    const m = y % pageH
    return m < 0 ? m + pageH : m
  }

  function applyBottomSafeZoneBreaks(root: HTMLElement) {
    const pageContentHeightPx = PRINTABLE_PAGE_HEIGHT_PX
    // Allow using the page end when 3-4 lines can still fit.
    const minUsableLinesPx = 40
    const blockSelectors = ['.resume-experience-item', '.resume-project-item']
    const blocks = root.querySelectorAll<HTMLElement>(blockSelectors.join(','))
    blocks.forEach((block) => {
      if (block.offsetHeight >= pageContentHeightPx * 0.7) return
      const startInPage = posModPage(getTopWithinPrintableArea(root, block), pageContentHeightPx)
      const remainingSpacePx = pageContentHeightPx - startInPage
      if (remainingSpacePx < minUsableLinesPx) {
        block.style.breakBefore = 'page'
        ;(block.style as CSSStyleDeclaration).pageBreakBefore = 'always'
      }
    })
  }

  function keepExperienceHeadingWithContent(root: HTMLElement) {
    const pageContentHeightPx = PRINTABLE_PAGE_HEIGHT_PX
    const expBlocks = root.querySelectorAll<HTMLElement>('.resume-experience-item')
    expBlocks.forEach((block) => {
      block.style.breakBefore = 'auto'
      ;(block.style as CSSStyleDeclaration).pageBreakBefore = 'auto'

      const heading = block.querySelector<HTMLElement>('.resume-experience-heading')
      if (!heading) return

      const blockStart = posModPage(getTopWithinPrintableArea(root, block), pageContentHeightPx)
      const remainingPx = pageContentHeightPx - blockStart

      const firstBullet = block.querySelector<HTMLElement>('.resume-experience-bullet')
      const headingHeight = Math.max(heading.offsetHeight || 0, 18)
      const bulletHeight = Math.max(firstBullet?.offsetHeight || 0, 20)
      const requiredPx = headingHeight + bulletHeight + 10

      // Only force a new page when truly near the bottom of a virtual sheet (avoid false positives).
      if (remainingPx < requiredPx && remainingPx >= 0 && blockStart > pageContentHeightPx * 0.55) {
        block.style.breakBefore = 'page'
        ;(block.style as CSSStyleDeclaration).pageBreakBefore = 'always'
      }
    })
  }

  function normalizePrintWhitespace(root: HTMLElement) {
    // Collapse excessive line breaks that often come from PDF/DOC extraction artifacts.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node = walker.nextNode()
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) textNodes.push(node as Text)
      node = walker.nextNode()
    }
    textNodes.forEach((textNode) => {
      const value = textNode.nodeValue ?? ''
      const normalized = value
        .replace(/\r\n?/g, '\n')
        .replace(/\f/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
      if (normalized !== value) textNode.nodeValue = normalized
    })
  }

  function hasMeaningfulText(el: HTMLElement): boolean {
    return (el.innerText ?? '').replace(/\s+/g, ' ').trim().length > 0
  }

  function trimTrailingEmptyPrintSpace(root: HTMLElement) {
    const printable = (root.querySelector('#resume-printable-area') as HTMLElement | null) ?? root
    const removableSelectors = [
      '.resume-supplement-item',
      '.resume-project-item',
      '.resume-experience-item',
      'section',
      'hr',
      'br',
    ]

    const getRemainderPx = () => printable.scrollHeight % PRINTABLE_PAGE_HEIGHT_PX

    // If the final page is mostly empty, remove trailing empty-ish blocks first.
    for (let i = 0; i < 40; i++) {
      const remainderPx = getRemainderPx()
      const nearEmptyTail = remainderPx > 0 && remainderPx < 120
      if (!nearEmptyTail) break

      const nodes = printable.querySelectorAll<HTMLElement>(removableSelectors.join(','))
      let removed = false
      for (let idx = nodes.length - 1; idx >= 0; idx--) {
        const el = nodes[idx]
        if (!el || !el.parentElement) continue
        const isSelfClosingSpacer = el.tagName === 'HR' || el.tagName === 'BR'
        const emptyBlock = !hasMeaningfulText(el) && el.querySelector('img,svg,canvas') === null
        if (isSelfClosingSpacer || emptyBlock) {
          el.remove()
          removed = true
          break
        }
      }
      if (!removed) break
    }
  }

  async function exportPdf() {
    if (!renderAuthor) return
    const errs = validateResumeForExport(renderAuthor)
    if (errs.length > 0) {
      setExportErrors(errs)
      alert(`Fix these before export:\n- ${errs.join('\n- ')}`)
      return
    }
    setExportErrors([])

    const hasInlineEdits = Boolean(selected && inlineHtmlById[selected.id])
    const shell =
      (hasInlineEdits
        ? (previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null)
        : (measureRef.current?.querySelector('#resume-document-template') as HTMLElement | null)) ??
      (previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null) ??
      (measureRef.current?.querySelector('#resume-document-template') as HTMLElement | null)
    if (!shell) return

    const rawName = selected?.result?.name ?? 'Resume'
    const safeName =
      rawName
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 120) || 'Resume'

    setPdfExporting(true)
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${A4_WIDTH_PX}px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden`
    const capture = shell.cloneNode(true) as HTMLElement
    // Enforce visible breathing space in downloaded PDF pages.
    capture.style.boxSizing = 'border-box'
    capture.style.paddingTop = `${PRINT_TOP_MARGIN_MM}mm`
    capture.style.paddingBottom = `${PRINT_BOTTOM_SAFE_ZONE_MM}mm`
    host.appendChild(capture)
    document.body.appendChild(host)

    try {
      await document.fonts?.ready
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      void capture.offsetHeight
      normalizePrintWhitespace(capture)
      trimTrailingEmptyPrintSpace(capture)
      keepExperienceHeadingWithContent(capture)
      applyBottomSafeZoneBreaks(capture)

      const { default: html2pdf } = await import('html2pdf.js')
      const widthPx = Math.max(capture.scrollWidth, capture.clientWidth)
      await html2pdf()
        .set({
          margin: [PRINT_TOP_MARGIN_MM, 0, PRINT_BOTTOM_SAFE_ZONE_MM, 0],
          filename: `${safeName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollY: -window.scrollY,
            scrollX: -window.scrollX,
            windowWidth: widthPx,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['css'] },
        })
        .from(capture)
        .save()
    } catch (e) {
      console.error(e)
      alert('Could not build the PDF at high quality. Please try again with a shorter resume, or use Print as backup.')
    } finally {
      document.body.removeChild(host)
      setPdfExporting(false)
    }
  }

  function printResume() {
    if (!renderAuthor) return
    const errs = validateResumeForExport(renderAuthor)
    if (errs.length > 0) {
      setExportErrors(errs)
      alert(`Fix these before print:\n- ${errs.join('\n- ')}`)
      return
    }
    setExportErrors([])

    // If the user edited inline content, print from live preview first so edits are preserved.
    // Otherwise prefer measurement tree for stable pagination.
    const hasInlineEdits = Boolean(selected && inlineHtmlById[selected.id])
    const shell =
      (hasInlineEdits
        ? (previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null)
        : (measureRef.current?.querySelector('#resume-document-template') as HTMLElement | null)) ??
      (previewRef.current?.querySelector('#resume-document-template') as HTMLElement | null) ??
      (measureRef.current?.querySelector('#resume-document-template') as HTMLElement | null)
    if (!shell) return

    const capture = shell.cloneNode(true) as HTMLElement
    const measureHost = document.createElement('div')
    measureHost.setAttribute('aria-hidden', 'true')
    measureHost.style.cssText = `position:fixed;left:-99999px;top:0;width:${A4_WIDTH_PX}px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden`
    document.body.appendChild(measureHost)
    measureHost.appendChild(capture)
    // Force layout before cloning print HTML.
    void capture.offsetHeight
    normalizePrintWhitespace(capture)
    trimTrailingEmptyPrintSpace(capture)
    keepExperienceHeadingWithContent(capture)
    const resumeHtml = capture.outerHTML
    document.body.removeChild(measureHost)

    const win = window.open('', '_blank')
    if (!win) {
      alert('Please allow pop-ups for this site, then click Print again.')
      return
    }

    let allCSS = ''
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        allCSS += Array.from(sheet.cssRules).map(r => r.cssText).join('\n')
      } catch {
        // Ignore cross-origin stylesheets.
      }
    })

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${(selected?.result?.name ?? 'Resume').replace(/[<>]/g, '')}</title>
  <style>${allCSS}</style>
  <style>
    @page { size: A4 portrait; margin: ${PRINT_TOP_MARGIN_MM}mm 0 ${PRINT_BOTTOM_SAFE_ZONE_MM}mm 0; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      width: 210mm;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    body {
      margin-left: auto;
      margin-right: auto;
    }
    #resume-document-template {
      width: 210mm !important;
      max-width: 210mm !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    #resume-printable-area {
      min-height: auto !important;
      height: auto !important;
    }
    /* Prevent large blank gaps by allowing browser print engine to split blocks naturally. */
    #resume-document-template section,
    #resume-document-template section > div,
    #resume-document-template article,
    #resume-document-template p,
    #resume-document-template li {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    /* Allow natural splitting; JS pass only moves starts when <3-4 lines fit. */
    #resume-document-template .resume-experience-item,
    #resume-document-template .resume-experience-item > div,
    #resume-document-template .resume-project-item,
    #resume-document-template .resume-project-item > div,
    #resume-document-template li {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    #resume-document-template p,
    #resume-document-template li {
      orphans: 1;
      widows: 1;
    }
    #resume-document-template .resume-skill-row {
      margin-bottom: 7px !important;
    }
    #resume-document-template .resume-skill-row:last-child {
      margin-bottom: 0 !important;
    }
    #resume-document-template section:last-of-type,
    #resume-document-template .resume-project-item:last-child,
    #resume-document-template .resume-experience-item:last-child {
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
      border-bottom: 0 !important;
    }
    #resume-document-template, #resume-document-template * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>${resumeHtml}</body>
</html>`)
    win.document.close()
    let hasPrinted = false
    const doPrint = () => {
      if (hasPrinted) return
      hasPrinted = true
      win.focus()
      win.print()
    }
    win.addEventListener('load', () => setTimeout(doPrint, 300))
    setTimeout(doPrint, 1400)
  }

  // ── theme tokens ──
  const D = dark
  const bg      = D ? 'bg-[#0b0b14]'                         : 'bg-slate-100'
  const sidebar  = D ? 'bg-[#10101e] border-white/[0.06]'    : 'bg-white border-slate-200'
  const hdr     = D ? 'bg-[#0b0b14]/80 border-white/[0.06]' : 'bg-white/80 border-slate-200'
  const preview  = D ? 'bg-[#0b0b14]'                        : 'bg-slate-200/60'
  const navBar   = D ? 'bg-[#10101e] border-white/[0.06]'   : 'bg-white border-slate-200'
  const sep      = D ? 'border-white/[0.06]'                 : 'border-slate-200'
  const txt      = D ? 'text-slate-100'                      : 'text-slate-900'
  const txtM     = D ? 'text-slate-400'                      : 'text-slate-500'
  const txtS     = D ? 'text-slate-500'                      : 'text-slate-400'
  const card     = D ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
  const cardSel  = D ? 'bg-red-500/10 border-red-500/30'     : 'bg-red-50 border-red-300/50'
  const cardHov  = D ? 'hover:bg-white/[0.05] hover:border-white/[0.14]' : 'hover:bg-white hover:border-slate-300'
  const iconBg   = D ? 'bg-white/[0.06]'                     : 'bg-slate-100'
  const emptyBox = D ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
  const renderAuthor = previewAuthor ?? selected?.result
  const renderResumeNode = (editableMode: boolean, opts?: { forMeasure?: boolean }) => {
    // Match print output: do not force preview to stretched page height.
    const sheetMinPx = undefined
    /* Saved HTML snapshot bypasses React template — only use it in editable canvas mode. */
    if (inlineHtml && editableMode) {
      return (
        <div
          className="mx-auto box-border w-full bg-white"
          style={{ maxWidth: A4_WIDTH_PX, ...(sheetMinPx ? { minHeight: sheetMinPx } : {}) }}
        >
          <div dangerouslySetInnerHTML={{ __html: setEditableAttrOnHtml(inlineHtml, editableMode) }} />
        </div>
      )
    }
    if (!renderAuthor) return null
    return (
      <ResumeTemplate
        author={renderAuthor}
        layoutConfig={activeLayout}
        editable={editableMode}
        containWidth={!opts?.forMeasure}
        previewMinHeightPx={sheetMinPx}
        onSectionDragStart={(scope, key) => {
          if (!editableMode) return
          setDragging({ scope, key })
          setDragOverSection(null)
        }}
        onSectionDragOver={(scope, key) => {
          if (!editableMode || !dragging) return
          setDragOverSection({ scope, key })
        }}
        onSectionDragEnd={() => {
          setDragging(null)
          setDragOverSection(null)
        }}
        onSectionDrop={(scope, key) => {
          if (!editableMode) return
          dropSection(scope, key)
          setDragging(null)
          setDragOverSection(null)
        }}
        dragOverSection={dragOverSection}
        onMoveSection={(scope, key, direction) => {
          if (!editableMode) return
          moveSectionByStep(scope, key, direction)
        }}
        onDeleteSection={(key) => {
          if (!editableMode) return
          hideSectionDirect(key)
        }}
        onDeleteExperienceLine={(expIndex, lineIndex) => {
          if (!editableMode) return
          removeExperienceHighlight(expIndex, lineIndex)
        }}
        onDeleteProject={(projectIndex) => {
          if (!editableMode) return
          removeProjectRow(projectIndex)
        }}
        onInlineInput={(html) => {
          if (!selected || !editableMode) return
          setInlineHtmlById(prev => ({ ...prev, [selected.id]: html }))
        }}
      />
    )
  }

  return (
    <div className={`flex h-screen min-h-0 flex-col overflow-hidden transition-colors duration-300 ${bg}`}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className={`no-print sticky top-0 z-50 shrink-0 border-b backdrop-blur-xl transition-colors duration-300 ${hdr}`}>
        {/* subtle gradient glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 via-transparent to-violet-600/5 pointer-events-none" />
        <div className="relative max-w-screen-2xl mx-auto px-5 h-16 flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-900/40 shrink-0">
              <FileText className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div className="leading-none">
              <div className={`font-bold text-[15px] tracking-tight ${txt}`}>Resume Builder</div>
              <div className={`text-[10px] font-medium ${txtS}`}>AI parsing, editor · PDF export</div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2.5">
            {/* file stats */}
            {resumeFiles.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${card} ${txtM}`}>
                  {resumeFiles.length} file{resumeFiles.length !== 1 ? 's' : ''}
                </span>
                {done.length > 0 && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                    {done.length} done
                  </span>
                )}
              </div>
            )}

            {/* OpenRouter (Anthropic Claude) badge */}
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border font-semibold text-[10px] ${
              D ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-600'
            }`}>
              <Sparkles className="w-3 h-3" />
              OpenRouter · Claude
            </div>

            {/* Download PDF */}
            {selected?.status === 'done' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(v => !v)
                    if (selected?.result) setJsonDraft(JSON.stringify(previewAuthor ?? selected.result, null, 2))
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    editorOpen
                      ? (D ? 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700')
                      : (D ? 'bg-white/[0.03] border-white/[0.12] text-slate-200 hover:bg-white/[0.06]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50')
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  {editorOpen ? 'Close Editor' : 'Edit Output'}
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={pdfExporting}
                  title="Download a PDF that matches the on-screen preview (colors, bars, layout)."
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold shadow-md shadow-red-900/30 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
                >
                  {pdfExporting ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {pdfExporting ? 'Building PDF…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={printResume}
                  title="Open browser print dialog for this resume preview."
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    D
                      ? 'bg-white/[0.04] border-white/[0.14] text-slate-200 hover:bg-white/[0.08]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  Print
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 min-h-0 overflow-hidden">

        {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
        {!editorOpen && (
        <aside className={`no-print w-[360px] shrink-0 border-r flex flex-col transition-colors duration-300 overflow-hidden ${sidebar}`}>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

            {/* ── JD section ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${iconBg}`}>
                    <FileSearch className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className={`text-sm font-bold ${txt}`}>Job Description</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${D ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    Optional
                  </span>
                </div>
                {jdFile && (
                  <button onClick={() => setJdFile(null)} className={`p-1 rounded-lg transition-colors ${txtM} hover:text-red-400 hover:bg-red-500/10`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {jdFile ? (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${D ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${D ? 'bg-emerald-800/40' : 'bg-emerald-100'}`}>
                    <FileText className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${D ? 'text-emerald-300' : 'text-emerald-700'}`}>{jdFile.name}</div>
                    <div className={`text-[10px] mt-0.5 ${D ? 'text-emerald-600' : 'text-emerald-500'}`}>{(jdFile.size / 1024).toFixed(1)} KB · JD loaded</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              ) : (
                <>
                  <DropZone
                    dark={D} dragOver={jdDrag}
                    onDragOver={e => { e.preventDefault(); setJdDrag(true) }}
                    onDragLeave={() => setJdDrag(false)}
                    onDrop={handleJdDrop}
                    onClick={() => jdRef.current?.click()}
                    icon={FileSearch}
                    heading={<>Drop JD or <span className="text-red-400">browse</span></>}
                    hint="PDF, DOC, DOCX — tailors resume to match the role"
                  />
                  <input ref={jdRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                    onChange={e => { if (e.target.files?.[0]) setJdFile(e.target.files[0]); e.target.value = '' }} />
                </>
              )}
            </div>

            {/* divider */}
            <div className={`border-t ${sep}`} />

            {/* ── Resume upload ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <FilePlus2 className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <span className={`text-sm font-bold ${txt}`}>Resumes</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">Required</span>
                </div>
                {resumeFiles.length > 0 && (
                  <button onClick={reset} className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${txtS} hover:text-red-400`}>
                    <RotateCcw className="w-3 h-3" /> Reset all
                  </button>
                )}
              </div>

              <DropZone
                dark={D} dragOver={resumeDrag}
                onDragOver={e => { e.preventDefault(); setResumeDrag(true) }}
                onDragLeave={() => setResumeDrag(false)}
                onDrop={handleResumeDrop}
                onClick={() => resumeRef.current?.click()}
                icon={Upload}
                heading={<>Drop files or <span className="text-red-400">browse</span></>}
                hint="Multiple resumes — PDF, DOC, DOCX supported"
                primary
              />
              <input ref={resumeRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" multiple
                onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
            </div>

            {/* ── File list ── */}
            {resumeFiles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className={`flex items-center justify-between mb-1`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${txtS}`}>Files</span>
                  <span className={`text-[10px] font-semibold tabular-nums ${txtS}`}>{resumeFiles.length}</span>
                </div>

                {resumeFiles.map(rf => {
                  const isSel = selectedId === rf.id && rf.status === 'done'
                  return (
                    <div
                      key={rf.id}
                      onClick={() => rf.status === 'done' && setSelectedId(rf.id)}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                        isSel ? cardSel : `${card} ${cardHov} border`
                      } ${rf.status === 'done' ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {/* left accent bar */}
                      {isSel && (
                        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-red-500" />
                      )}

                      {/* icon */}
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                        rf.status === 'done'      ? 'bg-emerald-500/10' :
                        rf.status === 'processing'? 'bg-amber-400/10'   :
                        rf.status === 'error'     ? 'bg-red-500/10'     :
                        iconBg
                      }`}>
                        {rf.status === 'pending'    && <FileText className={`w-4 h-4 ${txtM}`} />}
                        {rf.status === 'processing' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                        {rf.status === 'done'       && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {rf.status === 'error'      && <AlertCircle className="w-4 h-4 text-red-400" />}
                      </div>

                      {/* text */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold truncate leading-snug ${txt}`}>{rf.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <StatusBadge status={rf.status} />
                          {rf.status === 'done' && rf.result?.name && (
                            <span className={`text-[10px] truncate max-w-[100px] ${txtS}`}>{rf.result.name}</span>
                          )}
                          {rf.status === 'error' && (
                            <span className="text-[10px] text-red-400 truncate max-w-[140px]">{rf.error}</span>
                          )}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {rf.status === 'done' && (
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedId(rf.id) }}
                            className={`p-1.5 rounded-lg transition-colors ${iconBg} ${txtM} hover:text-white`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); remove(rf.id) }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Process button ── */}
            {resumeFiles.length > 0 && (
              <button
                onClick={processAll}
                disabled={processing || pendingCount === 0}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 select-none ${
                  processing || pendingCount === 0
                    ? `${D ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
                    : 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/25 hover:from-red-700 hover:to-red-600 active:scale-[0.98]'
                }`}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                ) : pendingCount === 0 ? (
                  <><CheckCircle2 className="w-4 h-4" /> All Processed</>
                ) : (
                  <><Zap className="w-4 h-4" /> Process {pendingCount} Resume{pendingCount !== 1 ? 's' : ''}</>
                )}
              </button>
            )}

            {/* ── Mock resume upload (no API/Claude) ── */}
            <input
              ref={mockRef}
              type="file"
              accept=".json,.pdf,.doc,.docx,.txt,application/json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0]
                if (!f) return
                await loadMockResumeFromFile(f)
                e.currentTarget.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => mockRef.current?.click()}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                D
                  ? 'border-white/[0.12] text-slate-200 hover:bg-white/[0.05]'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Upload Mock Resume (PDF/DOCX/JSON, No API)
            </button>

            {/* ── Empty hint ── */}
            {resumeFiles.length === 0 && (
              <div className={`rounded-xl border p-4 text-center ${emptyBox}`}>
                <p className={`text-[11px] leading-relaxed ${txtS}`}>
                  Upload one or more resumes above.<br />
                  Add a JD to tailor the output to a specific role.
                </p>
              </div>
            )}

          </div>
        </aside>
        )}

        {/* ── PREVIEW PANEL ─────────────────────────────────────────────────── */}
        <main className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-colors duration-300 ${preview}`}>

          {/* Resume navigator (only when >1 done) */}
          {done.length > 1 && (
            <div className={`no-print flex items-center justify-between px-5 py-2.5 border-b transition-colors ${navBar}`}>
              <button
                disabled={selectedDoneIdx <= 0}
                onClick={() => setSelectedId(done[selectedDoneIdx - 1].id)}
                className={`flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-25 ${txtM} hover:text-red-400`}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              <div className="flex items-center gap-1.5">
                {done.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`rounded-full transition-all duration-200 ${
                      r.id === selectedId
                        ? 'w-4 h-2 bg-red-500'
                        : `w-2 h-2 ${D ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-300 hover:bg-slate-400'}`
                    }`}
                  />
                ))}
              </div>

              <button
                disabled={selectedDoneIdx >= done.length - 1}
                onClick={() => setSelectedId(done[selectedDoneIdx + 1].id)}
                className={`flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-25 ${txtM} hover:text-red-400`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Resume preview */}
          {selected?.status === 'done' && renderAuthor ? (
            <div
              ref={previewRef}
              className={
                editorOpen
                  ? `relative flex min-h-0 min-w-0 flex-1 basis-0 flex-row gap-0 overflow-hidden border-t px-2 py-2 sm:px-3 ${sep}`
                  : 'min-h-0 flex-1 basis-0 overflow-auto px-6 py-5'
              }
            >
              {editorOpen ? (
                <div className="flex h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-hidden max-lg:max-h-full max-lg:flex-1 max-lg:overflow-y-auto lg:max-h-full lg:flex-row lg:gap-3 lg:items-stretch lg:overflow-hidden">
                  <aside
                    aria-label="Resume assistant"
                    className={`no-print order-3 flex min-w-0 flex-col overflow-hidden border-t border-t-slate-300 max-lg:min-h-[min(36vh,280px)] lg:order-1 lg:h-full lg:max-h-full lg:min-h-0 lg:w-[min(17rem,min(26vw,320px))] lg:max-w-[min(28vw,380px)] lg:shrink-0 lg:border-r lg:border-t-0 lg:border-r-slate-300 ${D ? 'border-t-white/[0.10] lg:border-r-white/[0.10] bg-[#0a0f18]' : 'border-t-slate-200 lg:border-r-slate-200 bg-slate-50'}`}
                  >
                    <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
                      <div className={`shrink-0 px-3 pt-3 pb-2 border-b ${D ? 'border-white/[0.08]' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className={`shrink-0 rounded-xl p-2 shadow-sm ${D ? 'bg-sky-500/20 text-sky-200' : 'bg-white text-sky-700 border border-sky-100'}`}>
                              <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <h3 className={`text-[13px] font-bold leading-tight tracking-tight ${txt}`}>Resume assistant</h3>
                              <p className={`mt-1 text-[10px] leading-snug ${txtS}`}>
                                JD + resume context on each send — only the résumé preview scrolls here.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={clearPromptChatForSelection}
                            disabled={!(promptChatById[selected?.id ?? '']?.length)}
                            title="Clear conversation"
                            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-35 ${
                              D ? 'border-white/[0.14] text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            <span className="hidden sm:inline">Clear</span>
                          </button>
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 basis-0 overflow-hidden px-3 py-3">
                        <div className="flex flex-col gap-3">
                          {(promptChatById[selected?.id ?? ''] ?? []).length === 0 ? (
                            <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 px-3 text-center ${D ? 'border-white/[0.14] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                              <div className={`mb-2 rounded-full p-3 ${D ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                                <Bot className={`h-7 w-7 ${txtM}`} strokeWidth={1.5} aria-hidden />
                              </div>
                              <p className={`text-xs font-semibold ${txt}`}>Ask for targeted edits</p>
                              <p className={`mt-1.5 max-w-[240px] text-[10px] leading-relaxed ${txtS}`}>
                                Skills, bullets, sections, or JD alignment — conversation is remembered for this resume.
                              </p>
                            </div>
                          ) : (
                            (promptChatById[selected?.id ?? ''] ?? []).map((turn, idx) => (
                              <div
                                key={`${turn.role}-${idx}`}
                                className={`flex gap-2.5 ${turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                              >
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    turn.role === 'user'
                                      ? 'bg-sky-600 text-[10px] font-bold text-white'
                                      : D
                                        ? 'bg-slate-700 text-slate-100'
                                        : 'bg-slate-200 text-slate-700'
                                  }`}
                                  aria-hidden
                                >
                                  {turn.role === 'user' ? 'You' : <Bot className="h-4 w-4" strokeWidth={2} />}
                                </div>
                                <div
                                  className={`max-w-[calc(100%-2.75rem)] min-w-0 rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed break-words shadow-sm ${
                                    turn.role === 'user'
                                      ? D
                                        ? 'border border-sky-500/30 bg-sky-950/90 text-sky-50'
                                        : 'bg-sky-600 text-white'
                                      : D
                                        ? 'border border-white/[0.10] bg-white/[0.08] text-slate-100'
                                        : 'border border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  {turn.content}
                                </div>
                              </div>
                            ))
                          )}
                          <div className="h-px w-full shrink-0" aria-hidden />
                        </div>
                      </div>
                      <div className={`shrink-0 border-t p-3 pt-2 ${D ? 'border-white/[0.08] bg-black/20' : 'border-slate-200 bg-white'}`}>
                        {promptFeedback && <p className={`mb-2 text-[10px] ${txtS}`}>{promptFeedback}</p>}
                        <div
                          className={`flex items-end gap-2.5 rounded-2xl border px-3 py-2.5 shadow-sm ring-1 ring-black/[0.04] ${
                            D ? 'border-white/[0.12] bg-white/[0.06]' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <textarea
                            value={promptDraft}
                            rows={3}
                            onChange={(e) => setPromptDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                applyPromptEdits()
                              }
                            }}
                            placeholder="Describe changes to apply to the resume…"
                            aria-label="Message to resume assistant"
                            className={`max-h-[140px] min-w-0 w-full flex-1 resize-none border-0 bg-transparent text-[12px] leading-relaxed outline-none ring-0 ${
                              D ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={applyPromptEdits}
                            disabled={promptApplying || !promptDraft.trim()}
                            aria-label={promptApplying ? 'Sending' : 'Send message'}
                            title="Send"
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all disabled:pointer-events-none disabled:opacity-40 ${
                              D
                                ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/40 hover:bg-sky-400'
                                : 'bg-slate-900 text-white shadow-md hover:bg-slate-800'
                            }`}
                          >
                            {promptApplying ? (
                              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                            ) : (
                              <Send className="h-5 w-5" strokeWidth={2} aria-hidden />
                            )}
                          </button>
                        </div>
                        <p className={`mt-2 flex items-center gap-1.5 text-[9px] ${txtS}`}>
                          <CornerDownLeft className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                          <span>
                            <span className="font-semibold">Enter</span> to send · <span className="font-semibold">Shift+Enter</span> new line
                          </span>
                        </p>
                      </div>
                    </div>
                  </aside>

                  <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-2">
                  <div className="flex min-h-0 flex-1 flex-basis-0 flex-col items-stretch overflow-y-auto overscroll-y-contain px-1 py-2 sm:px-2">
                <div
                  ref={canvasRef}
                  className="relative mx-auto box-border w-full max-w-full shrink-0 cursor-text overflow-x-hidden rounded bg-white shadow-md shadow-slate-300/50"
                  style={{ maxWidth: A4_WIDTH_PX, outline: '1px solid rgba(0,0,0,0.08)' }}
                  onClick={(e) => {
                    if (!placingTextBox) return
                    addTextBoxAt(e.clientX, e.clientY, e.currentTarget as HTMLDivElement, placingTextBoxKind)
                    setPlacingTextBox(false)
                  }}
                >
                  {renderResumeNode(true)}
                  {Array.from({ length: Math.max(0, previewPages - 1) }).map((_, i) => {
                    const y = (i + 1) * PRINTABLE_PAGE_HEIGHT_PX
                    return (
                      <React.Fragment key={`editor-page-guide-${i}`}>
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: y,
                            borderTop: '1px dashed rgba(148,163,184,0.6)',
                            pointerEvents: 'none',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: y + 1,
                            height: PREVIEW_PAGE_GAP_PX,
                            background: D ? 'rgba(15,23,42,0.16)' : 'rgba(226,232,240,0.5)',
                            borderTop: '1px solid rgba(148,163,184,0.35)',
                            borderBottom: '1px solid rgba(148,163,184,0.35)',
                            pointerEvents: 'none',
                          }}
                        />
                      </React.Fragment>
                    )
                  })}
                  {selectedTextBoxes.map(tb => (
                    <div
                      key={tb.id}
                      data-role="canvas-textbox"
                      className={`group absolute z-30 bg-transparent border border-transparent shadow-none p-0 ${
                        tb.kind === 'points' ? 'min-w-[220px]' : 'min-w-[100px]'
                      }`}
                      style={{ left: `${tb.x}%`, top: `${tb.y}%`, width: `${tb.width}%`, maxWidth: '90%' }}
                    >
                      <div className="mb-1 hidden group-hover:flex items-center justify-end gap-1" contentEditable={false}>
                        <button
                          type="button"
                          className="text-[10px] rounded border border-slate-200 px-1 py-0.5 cursor-move"
                          onMouseDown={(e) => {
                            const wrapper = e.currentTarget.closest('[data-role="canvas-textbox"]') as HTMLDivElement | null
                            const content = wrapper?.querySelector('[data-role="textbox-content"]') as HTMLDivElement | null
                            const baseRect = (content ?? wrapper)?.getBoundingClientRect()
                            if (!baseRect) return
                            setDragOffset({ x: e.clientX - baseRect.left, y: e.clientY - baseRect.top })
                            setDraggingTextBoxId(tb.id)
                          }}
                        >
                          Move
                        </button>
                        <button type="button" className="text-[10px] rounded border border-red-200 px-1 py-0.5 text-red-600" onClick={() => removeTextBox(tb.id)}>Remove</button>
                      </div>
                      <div
                        contentEditable={false}
                        className="absolute top-0 right-0 h-full w-2 cursor-ew-resize hidden group-hover:block"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          setResizeStart({ x: e.clientX, width: tb.width })
                          setResizingTextBoxId(tb.id)
                        }}
                        title="Resize horizontally"
                      />
                      <div
                        data-role="textbox-content"
                        contentEditable
                        suppressContentEditableWarning
                        className={`outline-none ${tb.kind === 'heading' ? 'font-bold uppercase tracking-[0.08em]' : 'text-slate-800'}`}
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontFamily: "'Times New Roman', Times, serif",
                          fontSize: tb.kind === 'heading' ? '16px' : '12px',
                          lineHeight: tb.kind === 'heading' ? 1.25 : 1.45,
                          color: tb.kind === 'heading' ? '#c0392b' : '#334155',
                          borderBottom: tb.kind === 'heading' ? '2px solid #cbd5e1' : undefined,
                          paddingBottom: tb.kind === 'heading' ? '2px' : undefined,
                          minWidth: tb.kind === 'heading' ? '180px' : undefined,
                          paddingLeft: tb.kind === 'points' ? '2px' : undefined,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={() => {
                          const editableValue = tb.kind === 'points'
                            ? tb.text.split('\n').map(line => line.replace(/^\s*[•\-]\s*/, '').trim()).join('\n')
                            : tb.text
                          textBoxDraftRef.current[tb.id] = editableValue
                          const el = document.querySelector(`[data-role="textbox-content"][data-id="${tb.id}"]`) as HTMLDivElement | null
                          if (el && tb.kind === 'points') el.textContent = editableValue
                        }}
                        onInput={(e) => {
                          const raw = e.currentTarget.textContent ?? ''
                          textBoxDraftRef.current[tb.id] = raw
                        }}
                        onBlur={() => {
                          const draft = textBoxDraftRef.current[tb.id]
                          if (typeof draft === 'string') {
                            const normalized = tb.kind === 'points'
                              ? draft
                                  .split('\n')
                                  .map(line => line.replace(/^\s*[•\-]\s*/, '').trim())
                                  .filter(Boolean)
                                  .map(line => `• ${line}`)
                                  .join('\n')
                              : draft
                            if (normalized !== tb.text) {
                              updateTextBox(tb.id, { text: normalized })
                            }
                          }
                        }}
                        data-id={tb.id}
                      >
                        {tb.text}
                      </div>
                    </div>
                  ))}
                  {(showRulerGuides || customGuides.length > 0) && (
                    <div className="absolute inset-0 pointer-events-none">
                      {showRulerGuides && (
                        <>
                          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(59,130,246,0.45)' }} />
                          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed rgba(59,130,246,0.45)' }} />
                        </>
                      )}
                      {customGuides.map(g => (
                        g.axis === 'x' ? (
                          <div key={`guide-x-wrap-${g.id}`} style={{ position: 'absolute', left: `${g.pos}%`, top: 0, bottom: 0, pointerEvents: 'auto' }}>
                            <div
                              style={{ position: 'absolute', inset: 0, borderLeft: activeGuideId === g.id ? '2px solid rgba(16,185,129,0.9)' : '1px solid rgba(34,197,94,0.75)', cursor: 'ew-resize' }}
                              onMouseDown={() => { setDraggingGuideId(g.id); setActiveGuideId(g.id) }}
                              onMouseMove={(e) => {
                                if (draggingGuideId !== g.id) return
                                const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect()
                                const raw = ((e.clientX - rect.left) / rect.width) * 100
                                const snapped = snapPercent(Math.max(0, Math.min(100, raw)), customGuides.filter(x => x.id !== g.id), 'x')
                                setCustomGuides(prev => prev.map(x => x.id === g.id ? { ...x, pos: snapped } : x))
                              }}
                              onMouseUp={() => setDraggingGuideId(null)}
                              onMouseLeave={() => setDraggingGuideId(null)}
                              onDoubleClick={() => {
                                setCustomGuides(prev => prev.filter(x => x.id !== g.id))
                                if (activeGuideId === g.id) setActiveGuideId(null)
                              }}
                            />
                            <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, fontWeight: 700, color: '#047857', background: 'rgba(255,255,255,0.95)', padding: '0 3px', borderRadius: 2 }}>
                              X {g.pos.toFixed(1)}%
                            </div>
                          </div>
                        ) : (
                          <div key={`guide-y-wrap-${g.id}`} style={{ position: 'absolute', left: 0, right: 0, top: `${g.pos}%`, pointerEvents: 'auto' }}>
                            <div
                              style={{ position: 'absolute', left: 0, right: 0, borderTop: activeGuideId === g.id ? '2px solid rgba(16,185,129,0.9)' : '1px solid rgba(34,197,94,0.75)', cursor: 'ns-resize' }}
                              onMouseDown={() => { setDraggingGuideId(g.id); setActiveGuideId(g.id) }}
                              onMouseMove={(e) => {
                                if (draggingGuideId !== g.id) return
                                const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect()
                                const raw = ((e.clientY - rect.top) / rect.height) * 100
                                const snapped = snapPercent(Math.max(0, Math.min(100, raw)), customGuides.filter(x => x.id !== g.id), 'y')
                                setCustomGuides(prev => prev.map(x => x.id === g.id ? { ...x, pos: snapped } : x))
                              }}
                              onMouseUp={() => setDraggingGuideId(null)}
                              onMouseLeave={() => setDraggingGuideId(null)}
                              onDoubleClick={() => {
                                setCustomGuides(prev => prev.filter(x => x.id !== g.id))
                                if (activeGuideId === g.id) setActiveGuideId(null)
                              }}
                            />
                            <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, fontWeight: 700, color: '#047857', background: 'rgba(255,255,255,0.95)', padding: '0 3px', borderRadius: 2 }}>
                              Y {g.pos.toFixed(1)}%
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
                  </div>
                  </div>

                  <nav
                    className={`no-print order-1 flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t lg:order-3 lg:h-full lg:max-h-full lg:min-h-0 lg:border-l lg:border-t-0 lg:w-[length:var(--resume-editor-toolbar-strip-width,5cm)] lg:min-w-[length:var(--resume-editor-toolbar-strip-width,5cm)] lg:max-w-[length:var(--resume-editor-toolbar-strip-width,5cm)] ${
                      D ? 'border-slate-700/60 bg-[#070b14] lg:border-white/[0.12]' : 'border-slate-200 bg-slate-50 lg:border-slate-200'
                    }`}
                    aria-label="Resume editor toolbar"
                  >
                    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 py-2 ${sep}`}>
                      {(exportErrors.length > 0 || renderAuthor.sectionIntegrity) && (
                        <div
                          className="mb-2 min-h-0 max-h-[min(42vh,360px)] flex-1 basis-0 overflow-y-auto overscroll-y-contain pr-0.5 lg:max-h-none"
                          aria-label="Heading comparison and export checks"
                        >
                          <ResumeDiagnosticsPanels
                            exportErrors={exportErrors}
                            renderAuthor={renderAuthor}
                            sourceHeadings={sourceHeadings}
                            outputHeadings={outputHeadings}
                            previewPages={previewPages}
                            a4WidthPx={A4_WIDTH_PX}
                            dark={D}
                            txt={txt}
                            txtM={txtM}
                            txtS={txtS}
                            variant="rail"
                            showPreviewPages={false}
                          />
                        </div>
                      )}
                      <div className={`min-h-0 shrink-0 rounded-xl border px-2 py-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-1 lg:py-1 ${
                        D ? 'border-white/[0.10] lg:border-transparent' : 'border-slate-200 lg:border-transparent'
                      }`}
                      >
                        <div className="toolbar-vstrip-inner flex flex-wrap items-center justify-center gap-1 lg:flex lg:flex-col lg:items-stretch lg:[&_button]:w-full lg:[&_button]:justify-center lg:[&_button]:px-1.5 lg:[&_button]:py-1 lg:[&_button]:text-[10px] lg:[&_button]:leading-tight">
                          <span className={`w-full shrink-0 text-center text-[9px] font-medium leading-snug lg:mb-1 lg:text-left lg:text-[10px] ${txtS}`}>
                            Add blocks on canvas · <span className={`font-semibold ${txtM}`}>Ctrl+Z</span> undo ·{' '}
                            <span className={`font-semibold ${txtM}`}>Ctrl+Shift+Z</span> or <span className={`font-semibold ${txtM}`}>Ctrl+Y</span> redo
                          </span>
                          <button
                            type="button"
                            title="Place a heading (click on résumé)"
                            onClick={() => {
                              setPlacingTextBox(true)
                              setPlacingTextBoxKind('heading')
                              setFontSizePt('14')
                            }}
                            className={`rounded border px-2 py-1 text-[11px] lg:text-[10px] ${placingTextBox && placingTextBoxKind === 'heading' ? 'border-red-600 bg-red-600 text-white' : `${D ? 'border-white/[0.14] text-slate-200' : 'border-slate-300 text-slate-800'}`}`}
                          >
                            Add heading
                          </button>
                          <button
                            type="button"
                            title="Place a paragraph (click on résumé)"
                            onClick={() => {
                              setPlacingTextBox(true)
                              setPlacingTextBoxKind('text')
                              setFontSizePt('12')
                            }}
                            className={`rounded border px-2 py-1 text-[11px] lg:text-[10px] ${placingTextBox && placingTextBoxKind === 'text' ? 'border-red-600 bg-red-600 text-white' : `${D ? 'border-white/[0.14] text-slate-200' : 'border-slate-300 text-slate-800'}`}`}
                          >
                            Paragraph
                          </button>
                          <button
                            type="button"
                            title="Place bullet list (click on résumé)"
                            onClick={() => {
                              setPlacingTextBox(true)
                              setPlacingTextBoxKind('points')
                              setFontSizePt('12')
                            }}
                            className={`rounded border px-2 py-1 text-[11px] lg:text-[10px] ${placingTextBox && placingTextBoxKind === 'points' ? 'border-red-600 bg-red-600 text-white' : `${D ? 'border-white/[0.14] text-slate-200' : 'border-slate-300 text-slate-800'}`}`}
                          >
                            Bullet points
                          </button>
                          <button
                            type="button"
                            title="Undo (Ctrl or ⌘ + Z)"
                            onClick={undoEdit}
                            disabled={!canUndo}
                            className={`rounded border px-2 py-1 text-[11px] disabled:opacity-40 lg:text-[10px] ${D ? 'border-white/[0.14] text-slate-200' : 'border-slate-300 text-slate-800'}`}
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            title="Redo (Ctrl or ⌘ + Shift + Z, or Ctrl + Y)"
                            onClick={redoEdit}
                            disabled={!canRedo}
                            className={`rounded border px-2 py-1 text-[11px] disabled:opacity-40 lg:text-[10px] ${D ? 'border-white/[0.14] text-slate-200' : 'border-slate-300 text-slate-800'}`}
                          >
                            Redo
                          </button>
                        </div>
                      </div>
                    </div>
                  </nav>
                </div>

              ) : (
                <div className="relative flex w-full flex-col items-center">
                  <div className="no-print w-full flex flex-col items-center px-4 sm:px-0 max-w-full">
                    <ResumeDiagnosticsPanels
                      exportErrors={exportErrors}
                      renderAuthor={renderAuthor}
                      sourceHeadings={sourceHeadings}
                      outputHeadings={outputHeadings}
                      previewPages={previewPages}
                      a4WidthPx={A4_WIDTH_PX}
                      dark={D}
                      txt={txt}
                      txtM={txtM}
                      txtS={txtS}
                      variant="stacked"
                    />
                  </div>
                  <div className="relative mx-auto box-border w-full border border-slate-200 bg-white" style={{ maxWidth: A4_WIDTH_PX }}>
                    {renderResumeNode(false)}
                    {Array.from({ length: Math.max(0, previewPages - 1) }).map((_, i) => {
                      const y = (i + 1) * PRINTABLE_PAGE_HEIGHT_PX
                      return (
                        <React.Fragment key={`page-guide-${i}`}>
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: y,
                              borderTop: '1px dashed rgba(148,163,184,0.6)',
                              pointerEvents: 'none',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: y + 1,
                              height: PREVIEW_PAGE_GAP_PX,
                              background: D ? 'rgba(15,23,42,0.16)' : 'rgba(226,232,240,0.5)',
                              borderTop: '1px solid rgba(148,163,184,0.35)',
                              borderBottom: '1px solid rgba(148,163,184,0.35)',
                              pointerEvents: 'none',
                            }}
                          />
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>
              )}
              <div ref={measureRef} style={{ position: 'absolute', left: -99999, top: 0, visibility: 'hidden', pointerEvents: 'none' }} aria-hidden>
                {renderResumeNode(false, { forMeasure: true })}
              </div>
            </div>
          ) : (
            /* ── Empty / loading state ── */
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {processing ? (
                <div className="text-center">
                  {/* animated ring */}
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
                    <div className={`w-20 h-20 rounded-full border-2 border-red-500/30 flex items-center justify-center ${D ? 'bg-red-500/5' : 'bg-red-50'}`}>
                      <Loader2 className="w-9 h-9 text-red-500 animate-spin" />
                    </div>
                  </div>
                  <h2 className={`text-xl font-bold mb-2 ${txt}`}>Analyzing Resume</h2>
                  <p className={`text-sm max-w-[260px] text-center leading-relaxed ${txtM}`}>
                    OpenRouter (Claude) is parsing and structuring
                    {jdFile ? ' — tailored to your JD' : ' the resume content'}…
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  {/* decorative circles */}
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${D ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-100'}`}>
                      <FileText className={`w-9 h-9 ${txtS}`} />
                    </div>
                  </div>
                  <h2 className={`text-xl font-bold mb-2 ${txt}`}>Resume Preview</h2>
                  <p className={`text-sm max-w-[260px] text-center leading-relaxed ${txtM}`}>
                    {resumeFiles.length === 0
                      ? 'Upload resume files on the left to get started'
                      : pendingCount > 0
                        ? `Hit "Process ${pendingCount} Resume${pendingCount !== 1 ? 's' : ''}" to analyze with AI`
                        : 'Select a processed resume from the list to preview it'}
                  </p>

                  {resumeFiles.length === 0 && (
                    <button
                      onClick={() => resumeRef.current?.click()}
                      className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold shadow-md shadow-red-900/25 hover:opacity-90 active:scale-95 transition-all mx-auto"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Resume
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
