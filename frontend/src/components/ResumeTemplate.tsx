import React from 'react'
import { Award, SquarePen, ChevronUp, ChevronDown, Trash2, GripVertical } from 'lucide-react'
import { Author, CaseStudy as CaseStudyType } from '../types'
import logoImg from '../img/red.png'

type MainSectionKey = 'summary' | 'technicalSkills' | 'experience' | 'projects' | 'education' | 'certifications'
type SidebarSectionKey = 'technicalSkills' | 'languages' | 'interests'

interface ResumeLayoutConfig {
  main?: MainSectionKey[]
  sidebar?: SidebarSectionKey[]
  hidden?: Array<MainSectionKey | SidebarSectionKey>
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Only render external links when href is clearly http(s)/mailto — avoids reload on empty or javascript: URLs. */
function isSafeExternalUrl(url: string | undefined): boolean {
  const s = url?.trim()
  if (!s) return false
  return /^https?:\/\/.+/i.test(s) || /^mailto:/i.test(s)
}

function normalizedProjectKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function parseTechStackBlocks(raw: string | undefined): { title: string; tags: string[] }[] {
  if (!raw?.trim()) return []
  const segments = raw.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
  const blocks: { title: string; tags: string[] }[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const lines = seg.split(/\n/).map(l => l.trim()).filter(Boolean)
    const firstLine = (lines[0] ?? '').replace(/^\s*[\d.]+\s*/, '').trim()
    const bulletItems = lines.slice(1).filter(l => l.startsWith('•')).map(l => l.replace(/^•\s*/, '').trim())
    const otherLines = lines.slice(1).filter(l => !l.startsWith('•'))
    const fromOther = otherLines.flatMap(line =>
      line.split(/[,;]|\s+and\s+/i).map(t => t.trim()).filter(Boolean)
    )
    let title = firstLine
    let tags = [...bulletItems, ...fromOther]

    if (lines.length === 1 && i + 1 < segments.length) {
      const nextSeg = segments[i + 1]
      const nextLines = nextSeg.split(/\n/).map(l => l.trim()).filter(Boolean)
      const nextBullets = nextLines.filter(l => l.startsWith('•')).map(l => l.replace(/^•\s*/, '').trim())
      const nextOther = nextLines.filter(l => !l.startsWith('•'))
      const nextFromOther = nextOther.flatMap(line =>
        line.split(/[,;]|\s+and\s+/i).map(t => t.trim()).filter(Boolean)
      )
      tags = [...nextBullets, ...nextFromOther]
      i++
    }
    const trimmedTags = tags.filter(Boolean)
    if (title || trimmedTags.length > 0) blocks.push({ title, tags: trimmedTags })
  }
  return blocks
}

function normalizeDisplayText(value: string | undefined): string {
  if (!value) return ''
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseEducationLine(line: string): {
  institution: string; degree: string; spec: string; year: string; grade: string
} {
  // Split on em-dash, en-dash, or hyphen surrounded by spaces
  const dashIdx = line.search(/\s+[—–-]\s+/)
  let institution = line.trim()
  let rest = ''
  if (dashIdx >= 0) {
    institution = line.substring(0, dashIdx).trim()
    rest        = line.substring(dashIdx).replace(/^\s*[—–-]\s*/, '').trim()
  }

  let degree = '', spec = '', year = '', grade = ''
  if (rest) {
    const segs = rest.split(',').map(s => s.trim()).filter(Boolean)
    degree = segs[0] ?? ''

    // Detect which segments are year / grade / spec
    const yearSeg  = segs.find(s => /\b20\d{2}\b|\b19\d{2}\b/.test(s)) ?? ''
    const gradeSeg = segs.find(s => /cgpa|gpa|%|grade/i.test(s) && s !== yearSeg) ?? ''
    const specSegs = segs.slice(1).filter(s => s !== yearSeg && s !== gradeSeg && s !== degree)

    if (yearSeg)  year  = yearSeg.match(/\b(20|19)\d{2}\b/)?.[0] ?? yearSeg
    if (gradeSeg) grade = gradeSeg.replace(/cgpa\s*[:\-]?\s*/i, 'CGPA: ').trim()
    if (!grade.startsWith('CGPA:') && /cgpa/i.test(gradeSeg)) grade = `CGPA: ${grade}`
    spec = specSegs.join(', ')

    // Spec inside parentheses in degree
    if (!spec && degree.includes('(')) {
      const m = degree.match(/^(.*?)\s*\((.*?)\)$/)
      if (m) { degree = m[1].trim(); spec = m[2].trim() }
    }
  }

  return { institution, degree, spec, year, grade }
}

function formatEducationInline(education: string): React.ReactNode {
  const lines = education.split(/\n/).map(s => s.trim()).filter(Boolean)
  if (lines.length === 0) return null

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {lines.map((line, i) => {
        const { institution, degree, spec, year, grade } = parseEducationLine(line)

        // Fallback: couldn't parse — show raw
        if (!degree && !institution) {
          return (
            <div key={i} className="text-[12px] text-slate-700 leading-snug">{line}</div>
          )
        }

        return (
          <div
            key={i}
            className="pl-[8px] border-l-[2px] border-primary/30"
            style={{ paddingBottom: i < lines.length - 1 ? 4 : 0 }}
          >
            {/* Degree + Institution */}
            <div className="text-[12px] font-semibold text-slate-800 leading-snug">
              {degree || institution}
              {degree && institution && (
                <span className="font-normal text-slate-500"> — {institution}</span>
              )}
            </div>
            {/* Spec */}
            {spec && (
              <div className="text-[11px] text-slate-500 leading-snug mt-[1px]">{spec}</div>
            )}
            {/* Year + Grade inline */}
            {(year || grade) && (
              <div className="flex items-center gap-2 mt-[2px]">
                {year  && <span className="text-[11px] text-slate-500">{year}</span>}
                {year && grade && <span className="text-[11px] text-slate-300">·</span>}
                {grade && <span className="text-[11px] font-medium text-primary/70">{grade}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Style tokens ──────────────────────────────────────────────────────────────
/** Keep skill bars constrained to 10-12 rows in final layout. */
const SKILL_BAR_MIN_DISPLAY = 10
const SKILL_BAR_MAX_DISPLAY = 12

/** Lowercase tags already listed in structured tech-stack blocks — avoids duplicate bullets in overflow box. */
function collectTechBlockTagsLower(blocks: { tags: string[] }[]): Set<string> {
  const seen = new Set<string>()
  for (const b of blocks) {
    for (const t of b.tags) {
      const k = t.trim().toLowerCase()
      if (k) seen.add(k)
    }
  }
  return seen
}

/** Prefer natural flow across page boundaries to avoid large whitespace gaps. */
const avoidBreak      = ''
const sectionBlock    = 'w-full mt-[6px]'
const noBreak: React.CSSProperties = { breakInside: 'auto', pageBreakInside: 'auto' }
const sectionTitle    = 'block w-full text-[19px] font-bold tracking-[0.08em] uppercase text-primary border-b-2 border-slate-300 pb-0.5 mb-1.5 text-left'
const bodyText        = 'text-[15px] text-slate-800 leading-snug'
const A4_WIDTH_MM = 210

// ── Component ─────────────────────────────────────────────────────────────────
export function ResumeTemplate({
  author,
  layoutConfig,
  editable,
  /** When true, page width fills parent up to A4 (on-screen); when false, fixed 210mm (measurement / exact layout). */
  containWidth = false,
  /** Preview only: stretch printable area to at least this height (full A4 × page count in px). Omit for intrinsic height (e.g. measurement). */
  previewMinHeightPx,
  onInlineInput,
  onMoveSection,
  onDeleteSection,
  onSectionDragStart,
  onSectionDragOver,
  onSectionDragEnd,
  onSectionDrop,
  dragOverSection,
  onDeleteExperienceLine,
  onDeleteProject,
}: {
  author: Author
  layoutConfig?: ResumeLayoutConfig
  editable?: boolean
  containWidth?: boolean
  previewMinHeightPx?: number
  onInlineInput?: (html: string) => void
  onMoveSection?: (scope: 'main' | 'sidebar', key: MainSectionKey | SidebarSectionKey, direction: -1 | 1) => void
  onDeleteSection?: (key: MainSectionKey | SidebarSectionKey) => void
  onSectionDragStart?: (scope: 'main' | 'sidebar', key: MainSectionKey | SidebarSectionKey) => void
  onSectionDragOver?: (scope: 'main' | 'sidebar', key: MainSectionKey | SidebarSectionKey) => void
  onSectionDragEnd?: () => void
  onSectionDrop?: (scope: 'main' | 'sidebar', key: MainSectionKey | SidebarSectionKey) => void
  dragOverSection?: { scope: 'main' | 'sidebar'; key: MainSectionKey | SidebarSectionKey } | null
  onDeleteExperienceLine?: (expIndex: number, lineIndex: number) => void
  onDeleteProject?: (projectIndex: number) => void
}) {
  const bio        = normalizeDisplayText(author.aboutMe ?? author.bio ?? '')
  const techBlocks = parseTechStackBlocks(author.techStack)

  // ── Projects (right column) ──────────────────────────────────────────────
  const caseStudiesRaw: CaseStudyType[] = author.caseStudies ?? []
  const seenTitles = new Set<string>()
  const caseStudiesDeduped = caseStudiesRaw.filter(cs => {
    const k = (cs.title ?? '').trim()
    if (!k || seenTitles.has(k)) return false
    seenTitles.add(k)
    return true
  })
  const caseStudyKeys = new Set(caseStudiesDeduped.map(cs => normalizedProjectKey(cs.title)))
  const resumeOnlyProjects: CaseStudyType[] = (author.projects ?? [])
    .filter(p => !caseStudyKeys.has(normalizedProjectKey(p.title)))
    .map(p => ({ title: p.title, description: p.description, technology: p.technology, link: p.link }))
  // Show ALL projects — multi-page layout handles overflow
  const allProjects = [...caseStudiesDeduped, ...resumeOnlyProjects]

  // ── Experience — rendered in main column
  // Show ALL experience entries — multi-page layout handles long lists
  const experiences = author.experience ?? []

  // ── Skills (sidebar) ─────────────────────────────────────────────────────
  const fromProfile = [...(author.expertise ?? []), ...(author.specializations ?? [])]
    .filter(Boolean).map(n => ({ name: String(n).trim(), level: 75 }))
  const skills =
    author.skills && author.skills.length > 0
      ? author.skills
      : fromProfile.length >= 4
        ? fromProfile
        : []
  const rankedForBars = [...skills].sort(
    (a, b) => (b.level ?? 70) - (a.level ?? 70),
  )
  const barNameLowerSeed = new Set(
    rankedForBars.map(s => String(s.name).trim().toLowerCase()).filter(Boolean),
  )
  const fillerCandidates: { name: string; level: number }[] = []
  for (const block of techBlocks) {
    for (const tag of block.tags) {
      const name = tag.trim()
      const key = name.toLowerCase()
      if (!name || barNameLowerSeed.has(key)) continue
      barNameLowerSeed.add(key)
      fillerCandidates.push({ name, level: 70 })
      if (fillerCandidates.length >= SKILL_BAR_MIN_DISPLAY) break
    }
    if (fillerCandidates.length >= SKILL_BAR_MIN_DISPLAY) break
  }
  const normalizedForBars =
    rankedForBars.length >= SKILL_BAR_MIN_DISPLAY
      ? rankedForBars
      : [...rankedForBars, ...fillerCandidates]
  const barSkills = normalizedForBars.slice(0, SKILL_BAR_MAX_DISPLAY)
  const overflowForBoxes = normalizedForBars.slice(SKILL_BAR_MAX_DISPLAY)
  const barNameLower = new Set(
    barSkills.map(s => String(s.name).trim().toLowerCase()).filter(Boolean),
  )
  const techBlocksForDisplay = techBlocks
    .map(block => ({
      ...block,
      tags: block.tags.filter(t => !barNameLower.has(t.trim().toLowerCase())),
    }))
    .filter(block => block.tags.length > 0)
  const existingTagLower = collectTechBlockTagsLower(techBlocksForDisplay)
  const seenOverflowLower = new Set<string>()
  const overflowTags: string[] = []
  for (const s of overflowForBoxes) {
    const name = String(s.name).trim()
    const key = name.toLowerCase()
    if (!key || existingTagLower.has(key) || seenOverflowLower.has(key)) continue
    seenOverflowLower.add(key)
    overflowTags.push(name)
  }
  const overflowTechBlock =
    overflowTags.length > 0
      ? [{ title: 'Tools & Technologies', tags: overflowTags }]
      : []
  const techBlocksMerged = [...techBlocksForDisplay, ...overflowTechBlock]

  // ── Interests (sidebar) ──────────────────────────────────────────────────
  const interests = (author.interests ?? []).filter(Boolean)
  const rawLanguagesFromAuthor = ((author as any).languages ?? []) as unknown[]
  const languagesFromAuthor = rawLanguagesFromAuthor
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
  const languageSupplement = (author.sectionIntegrity?.supplementSections ?? [])
    .find(section => (section?.title ?? '').trim().toLowerCase() === 'languages')
  const languagesFromSupplement = (languageSupplement?.body ?? '')
    .split(/\n|,|•|·|;/)
    .map(item => item.trim())
    .filter(Boolean)
  const languageSeen = new Set<string>()
  const languages = [...languagesFromAuthor, ...languagesFromSupplement].filter(item => {
    const key = item.toLowerCase()
    if (!key || languageSeen.has(key)) return false
    languageSeen.add(key)
    return true
  })

  // ── Education ────────────────────────────────────────────────────────────
  const educationNode = author.education?.trim()
    ? formatEducationInline(author.education.trim())
    : null

  // ── Certifications ───────────────────────────────────────────────────────
  const certs = author.certifications ?? []
  const supplementSections = (author.sectionIntegrity?.supplementSections ?? [])
    .filter(section => (section?.title ?? '').trim().toLowerCase() !== 'languages')
    .map(section => ({
      title: (section?.title ?? '').trim(),
      // Normalize raw extractor spacing so pre-wrap does not create near-empty pages.
      body: normalizeDisplayText(section?.body ?? ''),
    }))
    .filter(section => section.title && section.body)

  const hidden = new Set(layoutConfig?.hidden ?? [])
  const mainOrder: MainSectionKey[] = layoutConfig?.main ?? ['technicalSkills', 'experience', 'projects', 'education', 'certifications', 'summary']
  const sidebarOrder: SidebarSectionKey[] = layoutConfig?.sidebar ?? ['technicalSkills', 'languages', 'interests']
  const orderOf = <T extends string>(key: T, order: T[], fallback: number) => {
    const i = order.indexOf(key)
    return i >= 0 ? i : fallback
  }
  const mainOrderStyle = (key: MainSectionKey, fallback: number, style?: React.CSSProperties): React.CSSProperties => ({
    ...(style ?? {}),
    order: orderOf(key, mainOrder, fallback),
  })
  const sideOrderStyle = (key: SidebarSectionKey, fallback: number, style?: React.CSSProperties): React.CSSProperties => ({
    ...(style ?? {}),
    order: orderOf(key, sidebarOrder, fallback),
  })
  const isHidden = (key: MainSectionKey | SidebarSectionKey) => hidden.has(key)
  const sectionDropClass = (scope: 'main' | 'sidebar', key: MainSectionKey | SidebarSectionKey): string =>
    dragOverSection?.scope === scope && dragOverSection?.key === key
      ? 'ring-2 ring-red-300 ring-offset-1'
      : ''
  const sectionTools = (
    scope: 'main' | 'sidebar',
    key: MainSectionKey | SidebarSectionKey,
  ) => editable ? (
    <div
      contentEditable={false}
      className="absolute right-1 top-1 z-20 hidden group-hover:flex items-center gap-1 rounded-md border border-slate-300 bg-white/95 px-1 py-0.5 shadow"
    >
      <SquarePen className="w-3 h-3 text-slate-500" />
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          onSectionDragStart?.(scope, key)
        }}
        className="p-0.5 rounded hover:bg-slate-100 cursor-grab active:cursor-grabbing"
        title="Drag section"
      >
        <GripVertical className="w-3 h-3 text-slate-600" />
      </button>
      <button type="button" onClick={() => onMoveSection?.(scope, key, -1)} className="p-0.5 rounded hover:bg-slate-100" title="Move up">
        <ChevronUp className="w-3 h-3 text-slate-600" />
      </button>
      <button type="button" onClick={() => onMoveSection?.(scope, key, 1)} className="p-0.5 rounded hover:bg-slate-100" title="Move down">
        <ChevronDown className="w-3 h-3 text-slate-600" />
      </button>
      <button type="button" onClick={() => onDeleteSection?.(key)} className="p-0.5 rounded hover:bg-red-50" title="Remove section">
        <Trash2 className="w-3 h-3 text-red-600" />
      </button>
    </div>
  ) : null

  const pageOuterStyle: React.CSSProperties = containWidth
    ? {
        width: '100%',
        maxWidth: `${A4_WIDTH_MM}mm`,
        boxSizing: 'border-box',
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '14pt',
      }
    : {
        width: `${A4_WIDTH_MM}mm`,
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '14pt',
      }

  const printableStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    width: containWidth ? '100%' : `${A4_WIDTH_MM}mm`,
    maxWidth: containWidth ? `${A4_WIDTH_MM}mm` : undefined,
    minHeight: previewMinHeightPx !== undefined ? `${previewMinHeightPx}px` : 'min-content',
  }

  return (
    <div
      id="resume-document-template"
      className="bg-white text-gray-900 antialiased"
      style={pageOuterStyle}
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={editable ? (e) => onInlineInput?.((e.currentTarget as HTMLDivElement).outerHTML) : undefined}
    >
      {/*
        On-screen preview: optional min-height = N × full A4 (297 mm) so each sheet is a complete page.
        Omit previewMinHeightPx for intrinsic/content-only height (measurement).
      */}
      <div id="resume-printable-area" className="bg-white" style={printableStyle}>
        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>

          {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
          <aside
            style={{ width: '32%', flexShrink: 0, borderRight: '1px solid #f1f5f9' }}
            className="bg-white px-4 py-2.5 flex flex-col items-start text-left"
          >

            {/* Logo / Avatar block */}
            <div
              className={`w-full ${avoidBreak}`}
              style={{ maxWidth: 220, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 34 }}
            >
              <div className="grid gap-2 w-full" style={{ gridTemplateColumns: author.avatar ? '1fr 1fr' : '132px' }}>
                {author.avatar && (
                  <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-gray-200 border border-gray-100 shadow-sm">
                    <img src={author.avatar} alt={author.name} className="w-full h-full object-cover" loading="eager" />
                  </div>
                )}
                <div
                  className="flex items-center justify-center bg-transparent"
                  style={{ width: 132, height: 132, position: 'relative' }}
                >
                  <img
                    src={logoImg}
                    alt="Company Logo"
                    className="object-contain"
                    style={{ width: '88%', height: '88%', zIndex: 2 }}
                    loading="eager"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#111827',
                      fontWeight: 800,
                      fontSize: 16,
                      letterSpacing: '0.02em',
                      zIndex: 1,
                    }}
                  >
                    
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Skills — entire skills story lives in left sidebar only */}
            {!isHidden('technicalSkills') && (barSkills.length > 0 || techBlocksMerged.length > 0) && (
              <div
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('sidebar', 'technicalSkills')}`}
                style={sideOrderStyle('technicalSkills', 0)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('sidebar', 'technicalSkills')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('sidebar', 'technicalSkills') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('sidebar', 'technicalSkills') }}
              >
                {sectionTools('sidebar', 'technicalSkills')}
                <div className={sectionTitle}>Technical Skills</div>

                {barSkills.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {barSkills.map((s, i) => {
                      const pct = Math.max(10, Math.min(100, s.level ?? 70))
                      return (
                        <div
                          key={`bar-${i}`}
                          className="resume-skill-row"
                          style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 6,
                          }}>
                            <span style={{
                              fontSize: 11,
                              color: '#1f2937',
                              fontWeight: 500,
                              lineHeight: 1.35,
                              flex: '1 1 auto',
                              minWidth: 0,
                              wordBreak: 'break-word',
                            }}>{s.name}</span>
                            <span style={{
                              fontSize: 10,
                              color: '#475569',
                              flex: '0 0 auto',
                              fontVariantNumeric: 'tabular-nums',
                              lineHeight: 1.35,
                              paddingTop: 1,
                              alignSelf: 'flex-start',
                            }}>{pct}%</span>
                          </div>
                          {/*
                            Div tracks (not SVG): html2canvas often mis-draws/stretch SVG bars into the label row,
                            which breaks PDF vs on-screen parity. Explicit column gap keeps bar below wrapped text.
                          */}
                          <div
                            style={{
                              height: 6,
                              width: '100%',
                              borderRadius: 9999,
                              backgroundColor: '#f1f5f9',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              maxWidth: '100%',
                              borderRadius: 9999,
                              backgroundColor: '#c0392b',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {techBlocksMerged.length > 0 && (
                  <div
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-1.5 mt-2"
                    style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                  >
                    {techBlocksMerged.map((block, bi) => (
                      <div key={bi} className="px-0.5 py-0.5" style={{ ...noBreak }}>
                        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider leading-tight mb-0.5">
                          {block.title}
                        </div>
                        <div className="space-y-0.5">
                          {block.tags.map((tag, ti) => (
                            <div key={ti} className="flex items-baseline text-[11px] text-slate-800 leading-snug">
                              <span className="text-primary shrink-0 text-[10px] leading-none mr-1.5" aria-hidden>•</span>
                              <span style={{ wordBreak: 'break-word' }}>{tag.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Interests — only if they exist */}
            {languages.length > 0 && (
              <div
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('sidebar', 'languages')}`}
                style={sideOrderStyle('languages', 1)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('sidebar', 'languages')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('sidebar', 'languages') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('sidebar', 'languages') }}
              >
                {sectionTools('sidebar', 'languages')}
                <div className={sectionTitle}>Languages</div>
                <div
                  className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-1.5 mt-1.5"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
                >
                  {languages.map((lang, idx) => (
                    <div
                      key={`lang-${idx}`}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium leading-snug text-slate-700"
                      style={{ wordBreak: 'break-word' }}
                    >
                      {lang}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interests — only if they exist */}
            {!isHidden('interests') && interests.length > 0 && (
              <div
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('sidebar', 'interests')}`}
                style={sideOrderStyle('interests', 2)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('sidebar', 'interests')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('sidebar', 'interests') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('sidebar', 'interests') }}
              >
                {sectionTools('sidebar', 'interests')}
                <div className={sectionTitle}>Interests</div>
                <div className="flex flex-wrap w-full mt-1">
                  {interests.map((it, i) => (
                    <div key={i} className="flex items-baseline text-[11px] text-slate-700 font-medium leading-snug w-[50%] mb-1 pr-2">
                      <span className="text-primary shrink-0 text-[12px] leading-none mr-1.5" aria-hidden>•</span>
                      <span style={{ wordBreak: 'break-word' }}>{it}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </aside>

          {/* ── RIGHT MAIN ────────────────────────────────────────────────── */}
          <main
            style={{ flex: 1, minWidth: 0 }}
            className="px-4 py-2.5 flex flex-col text-left"
          >

            {/* Header band */}
            {!isHidden('summary') && (
            <section
              className={`w-full rounded-lg bg-[#fcf5f6] border border-primary/10 group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'summary')}`}
              style={mainOrderStyle('summary', 0, { padding: 8 })}
              draggable={editable}
              onDragStart={(e) => {
                if (!editable) return
                e.dataTransfer.effectAllowed = 'move'
                onSectionDragStart?.('main', 'summary')
              }}
              onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'summary') }}
              onDragEnd={() => onSectionDragEnd?.()}
              onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'summary') }}
            >
              {sectionTools('main', 'summary')}
              <div className="text-[11px] font-bold text-primary tracking-[0.1em] uppercase mb-0.5">
                {author.role ?? 'Professional'}
              </div>
              <h1 className="leading-tight font-semibold text-slate-900" style={{ fontSize: 18 }}>
                {author.name}
              </h1>

              {/* Professional summary — preserve line breaks from source */}
              {bio && (
                <div
                  className="mt-1 text-[12px] text-slate-700"
                  style={{ lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {bio}
                </div>
              )}

            </section>
            )}

            {/* Experience — primary column reads top-to-bottom like standard CVs */}
            {false && !isHidden('technicalSkills') && (barSkills.length > 0 || techBlocksMerged.length > 0 || interests.length > 0) && (
              <section
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'technicalSkills')}`}
                style={mainOrderStyle('technicalSkills', 0)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('main', 'technicalSkills')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'technicalSkills') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'technicalSkills') }}
              >
                {sectionTools('main', 'technicalSkills')}
                <div className={sectionTitle}>Technical Skills</div>

                {barSkills.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {barSkills.map((s, i) => {
                      const pct = Math.max(10, Math.min(100, s.level ?? 70))
                      return (
                        <div key={`main-bar-${i}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-700 font-medium">{s.name}</span>
                            <span className="text-[9px] text-slate-400">{pct}%</span>
                          </div>
                          <div style={{ height: 6, width: '100%', borderRadius: 9999, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, maxWidth: '100%', borderRadius: 9999, backgroundColor: '#c0392b' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {techBlocksMerged.length > 0 && (
                  <div className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-1.5 mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {techBlocksMerged.map((block, bi) => (
                      <div key={bi} className="rounded border border-slate-200 bg-white px-2 py-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight mb-0.5">
                          {block.title}
                        </div>
                        <div className="space-y-0.5">
                          {block.tags.map((tag, ti) => (
                            <div key={ti} className="flex items-baseline text-[10px] text-slate-700 leading-snug">
                              <span className="text-primary shrink-0 text-[10px] leading-none mr-1.5" aria-hidden>•</span>
                              <span style={{ wordBreak: 'break-word' }}>{tag.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {interests.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold text-slate-700 mb-1">Interests</div>
                    <div className="flex flex-wrap">
                      {interests.map((it, i) => (
                        <div key={i} className="flex items-baseline text-[10px] text-slate-700 leading-snug w-[33.33%] mb-1 pr-2">
                          <span className="text-primary shrink-0 text-[11px] leading-none mr-1.5" aria-hidden>•</span>
                          <span style={{ wordBreak: 'break-word' }}>{it}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Experience — primary column reads top-to-bottom like standard CVs */}
            {!isHidden('experience') && experiences.length > 0 && (
              <section
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'experience')}`}
                style={mainOrderStyle('experience', 1)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('main', 'experience')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'experience') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'experience') }}
              >
                {sectionTools('main', 'experience')}
                <div className={sectionTitle}>Professional Experience</div>
                <div className="flex flex-col">
                  {experiences.map((exp, i) => (
                    <div
                      key={i}
                      className="resume-experience-item pb-[4px] mb-[4px] border-b border-gray-100 last:border-b-0 last:pb-0 last:mb-0"
                    >
                      <div className="resume-experience-lead" style={{ breakInside: 'auto', pageBreakInside: 'auto' }}>
                        <div className={avoidBreak} style={noBreak}>
                        <div className="resume-experience-heading text-[12px] font-bold text-slate-900 leading-tight">
                            {exp.role}
                          </div>

                          <div className="flex items-center flex-wrap gap-x-1 mt-[2px]">
                            {exp.company && (
                            <span className="text-[11px] text-primary font-semibold">{exp.company}</span>
                            )}
                            {exp.company && (exp.period ?? exp.duration) && (
                            <span className="text-[11px] text-slate-400">·</span>
                            )}
                            {(exp.period ?? exp.duration) && (
                            <span className="text-[11px] text-slate-700">{exp.period ?? exp.duration}</span>
                            )}
                          </div>

                          {(exp.location || exp.type) && (
                            <div className="text-[11px] text-slate-600 mt-[1px]">
                              {[exp.type, exp.location].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>

                        {(exp.highlights ?? []).length > 0 && (
                          <div className="mt-[4px] flex flex-col gap-[2px]">
                            {(exp.highlights ?? []).slice(0, 3).map((h, j) => (
                              <div key={j} className="resume-experience-bullet flex items-start group/line">
                                <span
                                  className="text-primary shrink-0 leading-none mr-[5px] mt-[2px]"
                                  style={{ fontSize: 9 }}
                                  aria-hidden
                                >▸</span>
                                <span
                                  className="text-[12px] text-slate-800 leading-[1.45]"
                                  style={{ whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}
                                >
                                  {normalizeDisplayText(h)}
                                </span>
                                {editable && (
                                  <button
                                    type="button"
                                    contentEditable={false}
                                    onClick={() => onDeleteExperienceLine?.(i, j)}
                                    className="ml-1 hidden group-hover/line:inline-flex p-0.5 rounded hover:bg-red-50"
                                    title="Delete line"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {(exp.highlights ?? []).length > 3 && (
                        <div className="mt-[4px] flex flex-col gap-[2px]">
                          {(exp.highlights ?? []).slice(3).map((h, j) => (
                            <div key={j} className="resume-experience-bullet flex items-start group/line">
                              <span
                                className="text-primary shrink-0 leading-none mr-[5px] mt-[2px]"
                                style={{ fontSize: 9 }}
                                aria-hidden
                              >▸</span>
                              <span
                                className="text-[12px] text-slate-800 leading-[1.45]"
                                style={{ whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}
                              >
                                {normalizeDisplayText(h)}
                              </span>
                              {editable && (
                                <button
                                  type="button"
                                  contentEditable={false}
                                  onClick={() => onDeleteExperienceLine?.(i, j + 3)}
                                  className="ml-1 hidden group-hover/line:inline-flex p-0.5 rounded hover:bg-red-50"
                                  title="Delete line"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education — only if it exists */}
            {false && !isHidden('education') && educationNode && (
              <section
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'education')}`}
                style={mainOrderStyle('education', 3)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('main', 'education')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'education') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'education') }}
              >
                {sectionTools('main', 'education')}
                <div className={sectionTitle}>Education</div>
                <div className={bodyText}>{educationNode}</div>
              </section>
            )}

            {/* Verbatim fallback blocks when structured JSON missed a detected source section */}

            {/* Certifications — only if they exist */}
            {false && !isHidden('certifications') && certs.length > 0 && (
              <section
                className={`${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'certifications')}`}
                style={mainOrderStyle('certifications', 5)}
                draggable={editable}
                onDragStart={(e) => {
                  if (!editable) return
                  e.dataTransfer.effectAllowed = 'move'
                  onSectionDragStart?.('main', 'certifications')
                }}
                onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'certifications') }}
                onDragEnd={() => onSectionDragEnd?.()}
                onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'certifications') }}
              >
                {sectionTools('main', 'certifications')}
                <div className={sectionTitle}>Certifications</div>
                <div
                  className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-1.5"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
                >
                  {certs.map((c, i) => {
                    const certUrl = c.url?.trim()
                    const canLink = certUrl !== undefined && isSafeExternalUrl(certUrl)
                    const inner = (
                      <>
                        <Award className="w-[11px] h-[11px] text-primary shrink-0 mt-[1px]" aria-hidden />
                        <span style={{ wordBreak: 'break-word' }}>{c.name}</span>
                      </>
                    )
                    const base =
                      'flex items-start gap-1 rounded border border-slate-200 bg-white py-1 px-2 text-[10px] font-medium leading-snug text-slate-700'
                    return canLink ? (
                      <a
                        key={i}
                        href={certUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${base} hover:bg-primary/5`}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className={base}>
                        {inner}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

          </main>
        </div>

        {/* Projects rendered full-width to avoid right-column-only starts and left-side whitespace. */}
        {!isHidden('projects') && allProjects.length > 0 && (
          <section
            className={`w-full px-4 pb-2.5 mt-[6px] group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'projects')}`}
            draggable={editable}
            onDragStart={(e) => {
              if (!editable) return
              e.dataTransfer.effectAllowed = 'move'
              onSectionDragStart?.('main', 'projects')
            }}
            onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'projects') }}
            onDragEnd={() => onSectionDragEnd?.()}
            onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'projects') }}
          >
            {sectionTools('main', 'projects')}
            <div className={sectionTitle}>Projects</div>
            <div className="flex flex-col">
              {allProjects.map((p, i) => (
                <div
                  key={i}
                  className="resume-project-item pb-[4px] border-b border-gray-100 last:border-b-0 last:pb-0 mb-[4px] last:mb-0"
                >
                  <div className={avoidBreak} style={noBreak}>
                    <div className="flex items-center gap-2 flex-wrap group/project-row">
                      {p.link && isSafeExternalUrl(p.link) ? (
                        <a
                          href={p.link.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-bold text-slate-900 hover:underline leading-tight"
                        >
                          {p.title}
                        </a>
                      ) : (
                        <span className="text-[12px] font-bold text-slate-900 leading-tight">{p.title}</span>
                      )}
                      {p.link && isSafeExternalUrl(p.link) && (
                        <a
                          href={p.link.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary font-semibold hover:underline shrink-0"
                        >
                          Live →
                        </a>
                      )}
                      {editable && (
                        <button
                          type="button"
                          contentEditable={false}
                          onClick={() => onDeleteProject?.(i)}
                          className="hidden group-hover/project-row:inline-flex p-0.5 rounded hover:bg-red-50"
                          title="Delete project"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      )}
                    </div>

                    {p.technology && (
                      <div className="mt-[2px]">
                        <div className="text-[11px] font-semibold text-slate-700">Stack:</div>
                        <div
                          className="text-[11px] text-slate-800 leading-[1.4]"
                          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textIndent: 0, marginLeft: 0, paddingLeft: 0 }}
                        >
                          {normalizeDisplayText(p.technology)}
                        </div>
                      </div>
                    )}
                  </div>

                  {p.description && (
                    <div
                      className="text-[11px] text-slate-800 mt-[3px] leading-[1.45]"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textIndent: 0, marginLeft: 0, paddingLeft: 0 }}
                    >
                      {normalizeDisplayText(p.description)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <hr className="mt-[4px] border-t border-slate-200" />
          </section>
        )}

        {/* Continuation sections after full-width projects */}
        {!isHidden('education') && educationNode && (
          <section
            className={`w-full px-4 pb-2.5 ${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'education')}`}
            draggable={editable}
            onDragStart={(e) => {
              if (!editable) return
              e.dataTransfer.effectAllowed = 'move'
              onSectionDragStart?.('main', 'education')
            }}
            onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'education') }}
            onDragEnd={() => onSectionDragEnd?.()}
            onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'education') }}
          >
            {sectionTools('main', 'education')}
            <div className={sectionTitle}>Education</div>
            <div className={bodyText}>{educationNode}</div>
          </section>
        )}

        {!isHidden('certifications') && certs.length > 0 && (
          <section
            className={`w-full px-4 pb-2.5 ${sectionBlock} group relative ${editable ? 'cursor-move' : ''} ${sectionDropClass('main', 'certifications')}`}
            draggable={editable}
            onDragStart={(e) => {
              if (!editable) return
              e.dataTransfer.effectAllowed = 'move'
              onSectionDragStart?.('main', 'certifications')
            }}
            onDragOver={(e) => { if (!editable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSectionDragOver?.('main', 'certifications') }}
            onDragEnd={() => onSectionDragEnd?.()}
            onDrop={(e) => { e.preventDefault(); onSectionDrop?.('main', 'certifications') }}
          >
            {sectionTools('main', 'certifications')}
            <div className={sectionTitle}>Certifications</div>
            <div
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-1.5"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
            >
              {certs.map((c, i) => {
                const certUrl = c.url?.trim()
                const canLink = certUrl !== undefined && isSafeExternalUrl(certUrl)
                const inner = (
                  <>
                    <Award className="w-[11px] h-[11px] text-primary shrink-0 mt-[1px]" aria-hidden />
                    <span style={{ wordBreak: 'break-word' }}>{c.name}</span>
                  </>
                )
                const base =
                  'flex items-start gap-1 rounded border border-slate-200 bg-white py-1 px-2 text-[10px] font-medium leading-snug text-slate-700'
                return canLink ? (
                  <a
                    key={i}
                    href={certUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${base} hover:bg-primary/5`}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={i} className={base}>
                    {inner}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Source fallback sections: render any source-only content that was not mapped into structured JSON. */}
        {supplementSections.length > 0 && (
          <section className="w-full px-4 pb-2.5 mt-[6px]">
            {supplementSections.map((section, idx) => (
              <div
                key={`supplement-${idx}`}
                className="resume-supplement-item mb-[6px] last:mb-0 pb-[4px] border-b border-gray-100 last:border-b-0"
              >
                <div className={sectionTitle}>{section.title}</div>
                <div
                  className="text-[12px] text-slate-800 leading-[1.5]"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {section.body}
                </div>
              </div>
            ))}
          </section>
        )}

      </div>
    </div>
  )
}
