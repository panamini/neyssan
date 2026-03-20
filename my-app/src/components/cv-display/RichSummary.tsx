import React from 'react';
import type { IExperienceItem, IEducationItem, SectionType } from '../../types/cvDocument';
import { Briefcase, GraduationCap, Link } from 'lucide-react';
import { formatRangeFromItem } from '../../lib/date-utils';

interface RichSummaryProps {
  item: unknown;
  sectionType: SectionType;
}



export function RichSummary({ item, sectionType }: RichSummaryProps): JSX.Element {
  const safeItem = (item ?? {}) as Record<string, any>;

  // Only log when debug mode is enabled to reduce console spam
  const isDebug = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
  if (isDebug) {
    // eslint-disable-next-line no-console
    console.log("[RichSummary] props", { sectionType, item });
  }

  if (sectionType === 'experience') {
    const exp = safeItem as IExperienceItem;
    if (isDebug) {
      // eslint-disable-next-line no-console
      console.debug("[RichSummary] experience item fields", exp);
    }
    const range = formatRangeFromItem(exp);
    return (
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Briefcase className="cv-entry-icon" />
        </div>
        <div className="flex-1">
          <p className="font-medium [color:var(--ti)]">{exp.position}</p>
          <p className="text-sm [color:var(--tm2)]">
            {exp.company}
            {exp.location && <span> &middot; {exp.location}</span>}
          </p>
          {range && <p className="text-xs [color:var(--tm2)]">{range}</p>}
        </div>
      </div>
    );
  }

  if (sectionType === 'education') {
    const edu = safeItem as IEducationItem;
    if (isDebug) {
      // eslint-disable-next-line no-console
      console.debug("[RichSummary] education item fields", edu);
    }
    const range = formatRangeFromItem(edu);
    return (
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <GraduationCap className="cv-entry-icon" />
        </div>
        <div className="flex-1">
          <p className="font-medium [color:var(--ti)]">{edu.institution}</p>
          <p className="text-sm [color:var(--tm2)]">
            {edu.degree}
            {edu.fieldOfStudy && <span>, {edu.fieldOfStudy}</span>}
          </p>
          {range && <p className="text-xs [color:var(--tm2)]">{range}</p>}
        </div>
      </div>
    );
  }
  
  if (sectionType === 'contact') {
      const contactLinks = [
        { key: 'email', value: safeItem.email, icon: null },
        { key: 'phone', value: safeItem.phone, icon: null },
        { key: 'linkedin', value: safeItem.linkedin, icon: <Link className="inline-block w-3 h-3 ml-1" /> },
        { key: 'github', value: safeItem.github, icon: <Link className="inline-block w-3 h-3 ml-1" /> },
        { key: 'website', value: safeItem.website, icon: <Link className="inline-block w-3 h-3 ml-1" /> },
      ].filter(l => l.value);

      return (
        <div>
          <p className="text-lg font-bold">{safeItem.name}</p>
          <p className="text-sm [color:var(--tg2)]">{safeItem.label}</p>
          <div className="flex flex-wrap mt-1 text-sm gap-x-4 gap-y-1">
            {contactLinks.map(link => (
              <a href={link.value} key={link.key} className="[color:var(--tm2)] hover:underline">
                {link.value}{link.icon}
              </a>
            ))}
          </div>
        </div>
      )
  }

  return <p className="text-sm [color:var(--tm2)]">{(safeItem.title as string) ?? 'Details'}</p>;
}
