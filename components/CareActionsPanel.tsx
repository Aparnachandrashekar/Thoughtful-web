'use client'

import { useState } from 'react'
import { RelationshipType, CareTemplate, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getTemplatesForRelationship, getAllTemplates, generateReminderText, getRecurrenceLabel } from '@/lib/templates'

interface CareActionsPanelProps {
  personName: string
  relationshipType: RelationshipType
  birthday?: string
  onSelectTemplate: (template: CareTemplate, generatedText: string) => void
  onEditRelationship?: () => void
}

const RELATIONSHIP_ORDER: RelationshipType[] = ['family', 'close_friend', 'friend', 'work', 'other']

export default function CareActionsPanel({
  personName,
  relationshipType,
  birthday,
  onSelectTemplate,
  onEditRelationship
}: CareActionsPanelProps) {
  const [showAllActions, setShowAllActions] = useState(false)

  const suggestedTemplates = getTemplatesForRelationship(relationshipType)
  const allTemplates = getAllTemplates()
  const otherTemplates = allTemplates.filter(
    t => !suggestedTemplates.some(s => s.id === t.id)
  )

  const handleTemplateClick = (template: CareTemplate) => {
    const generatedText = generateReminderText(template, personName)
    onSelectTemplate(template, generatedText)
  }

  return (
    <div className="bg-white border border-blush-light/60 rounded-2xl overflow-hidden
                    shadow-[0_2px_12px_rgba(212,117,106,0.06)]">
      {/* Header */}
      <div className="px-5 py-4 bg-blush-pale/60 border-b border-blush-light/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{RELATIONSHIP_EMOJI[relationshipType]}</span>
            <span className="text-sm font-medium text-terra-deep">
              {RELATIONSHIP_LABELS[relationshipType]}
            </span>
          </div>
          {onEditRelationship && (
            <button
              onClick={onEditRelationship}
              className="text-xs text-terra/50 hover:text-terra transition-colors
                         px-2.5 py-1 rounded-pill hover:bg-blush-light"
            >
              Change
            </button>
          )}
        </div>
        {birthday && (
          <p className="text-xs text-terra/55 mt-2 flex items-center gap-1.5 font-light">
            <span>🎂</span>
            <span>{new Date(birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </p>
        )}
      </div>

      {/* Templates */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-terra/40 uppercase tracking-[0.15em] mb-3">
          Suggested
        </h3>

        <div className="space-y-2">
          {suggestedTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="w-full text-left px-4 py-3 rounded-2xl
                         border border-blush-light/80 hover:border-terra/30 hover:bg-blush-pale/50
                         transition-all duration-200 group/t"
            >
              <div className="flex items-start gap-3">
                <span className="text-base flex-shrink-0 mt-0.5">{template.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#2D1810]">
                      {template.label}
                    </span>
                    <span className="text-[10px] text-terra/35 bg-blush-pale px-2 py-0.5 rounded-pill flex-shrink-0">
                      {getRecurrenceLabel(template.recurrence)}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-xs text-terra/40 mt-0.5 line-clamp-1 font-light">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Show all toggle */}
        {otherTemplates.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowAllActions(!showAllActions)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5
                         text-xs text-terra/40 hover:text-terra/60 transition-colors
                         border-t border-blush-light/60 mt-1"
            >
              <span>{showAllActions ? 'Hide' : 'Show'} all</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAllActions ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAllActions && (
              <div className="mt-4 space-y-4">
                {RELATIONSHIP_ORDER.filter(rt => rt !== relationshipType).map((rt) => {
                  const rtTemplates = otherTemplates.filter(t => t.id.startsWith(rt.replace('_', '-')))
                  if (rtTemplates.length === 0) return null
                  return (
                    <div key={rt}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">{RELATIONSHIP_EMOJI[rt]}</span>
                        <span className="text-xs font-medium text-terra/35 uppercase tracking-[0.1em]">
                          {RELATIONSHIP_LABELS[rt]}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {rtTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateClick(template)}
                            className="w-full text-left px-3 py-2.5 rounded-xl
                                       border border-blush-light/60 hover:border-terra/20 hover:bg-blush-pale/40
                                       transition-all duration-200 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span>{template.emoji}</span>
                              <span className="text-terra-deep/80">{template.label}</span>
                              <span className="ml-auto text-terra/30 font-light">
                                {getRecurrenceLabel(template.recurrence)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
