'use client'

import { RelationshipType, CareTemplate, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getTemplatesForRelationship, generateReminderText, getRecurrenceLabel } from '@/lib/templates'

interface CareActionsPanelProps {
  personName: string
  relationshipType: RelationshipType
  birthday?: string
  onSelectTemplate: (template: CareTemplate, generatedText: string) => void
  onEditRelationship?: () => void
}

export default function CareActionsPanel({
  personName,
  relationshipType,
  birthday,
  onSelectTemplate,
  onEditRelationship
}: CareActionsPanelProps) {
  const templates = getTemplatesForRelationship(relationshipType)

  const handleTemplateClick = (template: CareTemplate) => {
    const generatedText = generateReminderText(template, personName)
    onSelectTemplate(template, generatedText)
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header with relationship type */}
      <div className="px-4 py-3 bg-gradient-to-r from-lavender/20 to-transparent border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{RELATIONSHIP_EMOJI[relationshipType]}</span>
            <span className="text-sm font-medium text-gray-700">
              {RELATIONSHIP_LABELS[relationshipType]}
            </span>
          </div>
          {onEditRelationship && (
            <button
              onClick={onEditRelationship}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        {birthday && (
          <p className="text-xs text-gray-400 mt-1">
            🎂 Birthday: {new Date(birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Templates */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Suggested Actions
        </h3>

        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-lavender hover:bg-lavender/5 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{template.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {template.label}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {getRecurrenceLabel(template.recurrence)}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
