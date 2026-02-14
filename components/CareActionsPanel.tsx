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

// Group templates by their relationship type for display
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

  // Get templates not in suggested (to show as "other actions")
  const otherTemplates = allTemplates.filter(
    t => !suggestedTemplates.some(s => s.id === t.id)
  )

  const handleTemplateClick = (template: CareTemplate) => {
    const generatedText = generateReminderText(template, personName)
    onSelectTemplate(template, generatedText)
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header with relationship type */}
      <div className="px-5 py-4 bg-gradient-to-r from-lavender/30 to-mint/10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{RELATIONSHIP_EMOJI[relationshipType]}</span>
            <span className="text-base font-semibold text-gray-700">
              {RELATIONSHIP_LABELS[relationshipType]}
            </span>
          </div>
          {onEditRelationship && (
            <button
              onClick={onEditRelationship}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-3 py-1 rounded-lg hover:bg-white/50"
            >
              Change
            </button>
          )}
        </div>
        {birthday && (
          <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
            <span>🎂</span>
            <span>Birthday: {new Date(birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </p>
        )}
      </div>

      {/* Suggested Templates */}
      <div className="p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
          ✨ Suggested Actions
        </h3>

        <div className="space-y-2">
          {suggestedTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-lavender hover:bg-lavender/10 transition-all group hover:scale-[1.01]"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{template.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                      {template.label}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full flex-shrink-0 group-hover:bg-lavender/20">
                      {getRecurrenceLabel(template.recurrence)}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Toggle to show all actions */}
        {otherTemplates.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setShowAllActions(!showAllActions)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors border-t border-gray-100 pt-4"
            >
              <span>{showAllActions ? 'Hide' : 'Show'} all actions</span>
              <svg
                className={`w-4 h-4 transition-transform ${showAllActions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAllActions && (
              <div className="mt-4 space-y-4">
                {/* Group by relationship type */}
                {RELATIONSHIP_ORDER.filter(rt => rt !== relationshipType).map((rt) => {
                  const rtTemplates = otherTemplates.filter(t => t.id.startsWith(rt.replace('_', '-')))
                  if (rtTemplates.length === 0) return null

                  return (
                    <div key={rt}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">{RELATIONSHIP_EMOJI[rt]}</span>
                        <span className="text-xs font-medium text-gray-400 uppercase">
                          {RELATIONSHIP_LABELS[rt]} Actions
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {rtTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateClick(template)}
                            className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{template.emoji}</span>
                              <span className="text-gray-600">{template.label}</span>
                              <span className="ml-auto text-xs text-gray-300">
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
