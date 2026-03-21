import React from 'react';
import type { IExperienceItem, IEducationItem, SectionType } from '../../types/cvDocument';
import { Link } from 'lucide-react';
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
      <div className="cv-entry-summary">
        <div className="cv-entry-summary__main">
          <p className="cv-entry-title cv-entry-title--truncate">{exp.position}</p>
          <p className="cv-entry-subtitle cv-entry-subtitle--truncate">
            {exp.company}
            {exp.location && <span> · {exp.location}</span>}
          </p>
        </div>
        {range ? <p className="cv-entry-date">{range}</p> : null}
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
      <div className="cv-entry-summary">
        <div className="cv-entry-summary__main">
          <p className="cv-entry-title cv-entry-title--truncate">{edu.degree || edu.institution}</p>
          <p className="cv-entry-subtitle cv-entry-subtitle--truncate">
            {edu.institution}
            {edu.fieldOfStudy && <span> · {edu.fieldOfStudy}</span>}
          </p>
        </div>
        {range ? <p className="cv-entry-date">{range}</p> : null}
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
        <div className="cv-preview-stack">
          <p className="cv-profile-name">{safeItem.name}</p>
          <p className="cv-profile-role">{safeItem.label}</p>
          <div className="cv-contact-links">
            {contactLinks.map(link => (
              <a href={link.value} key={link.key} className="cv-contact-link">
                {link.value}{link.icon}
              </a>
            ))}
          </div>
        </div>
      )
  }

  return <p className="text-sm [color:var(--tm2)]">{(safeItem.title as string) ?? 'Details'}</p>;
}
