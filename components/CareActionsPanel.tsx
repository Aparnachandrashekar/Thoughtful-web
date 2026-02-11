'use client'

import { CARE_TEMPLATES, generateReminderText } from '@/lib/careTemplates'
import { CareTemplate } from '@/lib/types'

interface CareActionsPanelProps {
  personName: string
  onSelectTemplate: (template: CareTemplate, generatedText: string) => void
}

export default function CareActionsPanel({
  personName,
  onSelectTemplate
}: CareActionsPanelProps) {
  const handleTemplateClick = (template: CareTemplate) => {
    const generatedText = generateReminderText(template, personName)
    onSelectTemplate(template, generatedText)
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl p-4">
      <h3 className="text-sm font-medium text-gray-800 mb-3">
        Quick Actions
      </h3>

      <div className="space-y-2">
        {CARE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 hover:border-lavender hover:bg-lavender/10 transition-all text-left group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">
                {template.id === 'weekly-catchup' && '📞'}
                {template.id === 'birthday-gift' && '🎁'}
                {template.id === 'monthly-checkin' && '💬'}
              </span>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                {template.label}
              </span>
            </div>
            {template.recurrence && (
              <span className="text-xs text-gray-400 bg-sand/50 px-2 py-1 rounded-full">
                {template.recurrence}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
