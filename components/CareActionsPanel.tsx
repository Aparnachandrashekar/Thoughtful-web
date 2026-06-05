'use client'

import { useState } from 'react'
import { RelationshipType, CareTemplate, RELATIONSHIP_LABELS } from '@/lib/types'
import { getTemplatesForRelationship, getAllTemplates, generateReminderText, getRecurrenceLabel } from '@/lib/templates'
import TemplateOutlineIcon from '@/components/TemplateOutlineIcon'

interface CareActionsPanelProps {
  personName: string
  relationshipType: RelationshipType
  birthday?: string
  onSelectTemplate: (template: CareTemplate, generatedText: string) => void
  onEditRelationship?: () => void
}

const RELATIONSHIP_ORDER: RelationshipType[] = ['family', 'close_friend', 'friend', 'work', 'spouse', 'other']

export default function CareActionsPanel({
  personName,
  relationshipType,
  birthday,
  onSelectTemplate,
  onEditRelationship,
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
    <div className="bg-surface rounded-card overflow-hidden">
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/80">
        <div className="flex items-center justify-between">
          <span className="text-mobile-title sm:text-sm font-semibold text-ink">
            Suggested reminders
          </span>
          {onEditRelationship && (
            <button
              onClick={onEditRelationship}
              className="text-mobile-caption sm:text-xs text-ink-muted hover:text-accent transition-colors"
            >
              Change type
            </button>
          )}
        </div>
        {birthday && (
          <p className="text-mobile-secondary sm:text-xs text-ink-muted mt-1 font-light">
            Birthday {new Date(birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        {suggestedTemplates.map((template, i) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="w-full text-left px-4 py-3 sm:px-4 sm:py-3 rounded-card bg-white
                       hover:bg-white card-interactive transition-all duration-150
                       animate-fade-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          >
            <div className="flex items-start gap-3">
              <TemplateOutlineIcon templateId={template.id} className="text-accent" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-mobile-title sm:text-sm font-medium text-ink">{template.label}</span>
                  <span className="text-mobile-label sm:text-[10px] text-ink-faint flex-shrink-0">
                    {getRecurrenceLabel(template.recurrence)}
                  </span>
                </div>
                {template.description && (
                  <p className="text-mobile-secondary sm:text-xs text-ink-muted mt-0.5 font-light line-clamp-1">{template.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}

        {otherTemplates.length > 0 && (
          <button
            onClick={() => setShowAllActions(!showAllActions)}
            className="w-full py-2 text-mobile-caption sm:text-xs text-ink-muted hover:text-accent transition-colors"
          >
            {showAllActions ? 'Hide' : 'Show'} more templates
          </button>
        )}

        {showAllActions && (
          <div className="space-y-3 pt-2">
            {RELATIONSHIP_ORDER.filter(rt => rt !== relationshipType).map((rt) => {
              const rtTemplates = otherTemplates.filter(t => t.id.startsWith(rt.replace('_', '-')))
              if (rtTemplates.length === 0) return null
              return (
                <div key={rt}>
                  <p className="text-mobile-caption sm:text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    {RELATIONSHIP_LABELS[rt]}
                  </p>
                  <div className="space-y-1.5">
                    {rtTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="w-full text-left px-3 py-2.5 rounded-card bg-white text-mobile-caption sm:text-xs
                                   hover:shadow-card transition-all duration-150"
                      >
                        <div className="flex items-center gap-2.5">
                          <TemplateOutlineIcon templateId={template.id} size="sm" className="text-accent" />
                          <span className="text-ink font-medium">{template.label}</span>
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
    </div>
  )
}
