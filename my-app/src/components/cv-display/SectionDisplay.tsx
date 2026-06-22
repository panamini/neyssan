import React, { useCallback } from 'react';
import type { CvSection, ISkillItem, ILanguageItem } from '../../types/cvDocument';
import BlockRenderer from '../cv-editor/BlockRenderer';
import SkillsDisplay from './SkillsDisplay';
import LanguagesDisplay from './LanguagesDisplay';
import { StrictExtractButton } from '../StrictExtractButton';
import { useCvLibrary } from '../../contexts/CvLibraryContext';
import { formatRangeFromItem } from '../../lib/date-utils';
import { remirrorJsonToString } from '../../lib/utils';
import { splitResponsibilitiesIntoBullets } from '../../lib/resumeResponsibilityAuthority';
import { isExperienceRenderable, isEducationRenderable } from '../../utils/cv/renderGuards';

interface SectionDisplayProps {
  section: CvSection;
}

export function SectionDisplay({ section }: SectionDisplayProps): JSX.Element {
  const { currentCv, importCv } = useCvLibrary();

  const isSkills = String(section.type) === 'skills';
  const skillItems: ISkillItem[] =
    isSkills && Array.isArray(section.structuredContent)
      ? (section.structuredContent as ISkillItem[])
      : [];

  const isLanguages = String(section.type) === 'languages';
  const languageItems: ILanguageItem[] =
    isLanguages && Array.isArray(section.structuredContent)
      ? (section.structuredContent as ILanguageItem[])
      : [];

  const structuredList = Array.isArray(section.structuredContent)
    ? (section.structuredContent as any[])
    : [];
  const isExperience = String(section.type) === 'experience';
  const isEducation = String(section.type) === 'education';
  const isProjects = String(section.type) === 'projects';
  const renderableStructured = isExperience
    ? structuredList.filter((item) => isExperienceRenderable(item))
    : isEducation
    ? structuredList.filter((item) => isEducationRenderable(item))
    : isProjects
    ? structuredList.filter((item) => {
        const title = typeof item?.title === 'string' ? item.title.trim() : '';
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        const descriptionValue = item?.description ?? item?.summary ?? item?.content;
        const description =
          typeof descriptionValue === 'string'
            ? descriptionValue.trim()
            : descriptionValue && typeof descriptionValue === 'object'
            ? remirrorJsonToString(descriptionValue).trim()
            : '';
        return Boolean(title || name || description);
      })
    : [];
  const hasRenderableStructured = renderableStructured.length > 0;
  const hasBlocks = Array.isArray(section.blocks) && section.blocks.length > 0;

  const toTrimmedString = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  const toStructuredPlainText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      try {
        return remirrorJsonToString(value as any).trim();
      } catch {
        return '';
      }
    }
    return '';
  };

  const renderExperienceItem = (rawItem: any, index: number): React.ReactNode => {
    const key = String(rawItem?.id ?? index);
    const company = toTrimmedString(rawItem?.company);
    const position = toTrimmedString(rawItem?.position);
    const location = toTrimmedString(rawItem?.location);
    const title = position || company || 'Experience entry';
    const subtitleParts: string[] = [];
    if (company && company !== title) subtitleParts.push(company);
    if (location) subtitleParts.push(location);
    const subtitle = subtitleParts.join(' • ');
    const responsibilityBullets = Array.isArray(rawItem?.responsibilityBullets)
      ? (rawItem.responsibilityBullets as unknown[])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      : splitResponsibilitiesIntoBullets(typeof rawItem?.responsibilities === 'string' ? rawItem.responsibilities : undefined);
    const achievements = Array.isArray(rawItem?.achievements)
      ? (rawItem.achievements as unknown[])
          .map((value) =>
            typeof value === 'string'
              ? value.trim()
              : typeof (value as any)?.text === 'string'
              ? (value as any).text.trim()
              : ''
          )
          .filter(Boolean)
      : [];
    const bulletSource = responsibilityBullets.length > 0 ? responsibilityBullets : achievements;
    const bulletList = bulletSource.slice(0, 5);
    const remainingCount = Math.max(bulletSource.length - bulletList.length, 0);
    const dates = formatRangeFromItem(rawItem);

    return (
      <article key={key} className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold [color:var(--ti)] truncate">{title}</h3>
            {subtitle ? (
              <p className="text-xs [color:var(--tm2)] truncate">{subtitle}</p>
            ) : null}
          </div>
          <span className="text-xs [color:var(--tm2)] shrink-0">{dates}</span>
        </div>
        {bulletList.length > 0 ? (
          <ul className="ml-4 space-y-1 text-xs list-disc [color:var(--ti)]">
            {bulletList.map((line, bulletIdx) => (
              <li key={`${key}-bullet-${bulletIdx}`} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {remainingCount > 0 ? (
          <p className="ml-4 text-[11px] [color:var(--tm2)]">+{remainingCount} more point(s)</p>
        ) : null}
      </article>
    );
  };

  const renderEducationItem = (rawItem: any, index: number): React.ReactNode => {
    const key = String(rawItem?.id ?? index);
    const institution = toTrimmedString(rawItem?.institution);
    const degree = toTrimmedString(rawItem?.degree);
    const field = toTrimmedString(rawItem?.fieldOfStudy);
    const title = degree || institution || field || 'Education entry';
    const subtitleParts: string[] = [];
    if (institution && institution !== title) subtitleParts.push(institution);
    if (field && field !== title) subtitleParts.push(field);
    const subtitle = subtitleParts.join(' • ');
    const descriptionRaw = rawItem?.description;
    const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : '';
    const hasObjectDescription = !description && descriptionRaw && typeof descriptionRaw === 'object';
    const truncatedDescription = description.length > 220 ? `${description.slice(0, 217).trimEnd()}…` : description;
    const achievements = Array.isArray(rawItem?.achievements)
      ? (rawItem.achievements as unknown[])
          .map((value) =>
            typeof value === 'string'
              ? value.trim()
              : typeof (value as any)?.text === 'string'
              ? (value as any).text.trim()
              : ''
          )
          .filter(Boolean)
      : [];
    const dates = formatRangeFromItem(rawItem);

    return (
      <article key={key} className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold [color:var(--ti)] truncate">{title}</h3>
            {subtitle ? (
              <p className="text-xs [color:var(--tm2)] truncate">{subtitle}</p>
            ) : null}
          </div>
          <span className="text-xs [color:var(--tm2)] shrink-0">{dates}</span>
        </div>
        {truncatedDescription ? (
          <p className="text-xs leading-snug [color:var(--ti)]">{truncatedDescription}</p>
        ) : null}
        {!truncatedDescription && hasObjectDescription ? (
          <p className="text-xs italic [color:var(--tm2)]">Detailed description available.</p>
        ) : null}
        {achievements.length > 0 ? (
          <ul className="ml-4 space-y-1 text-[11px] list-disc [color:var(--ti)]">
            {achievements.slice(0, 3).map((line, bulletIdx) => (
              <li key={`${key}-edu-ach-${bulletIdx}`} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  };

  const renderProjectItem = (rawItem: any, index: number): React.ReactNode => {
    const key = String(rawItem?.id ?? index);
    const title =
      toTrimmedString(rawItem?.title) ||
      toTrimmedString(rawItem?.name) ||
      `Project ${index + 1}`;
    const meta =
      toTrimmedString(rawItem?.meta) ||
      toTrimmedString(rawItem?.subtitle);
    const description = toStructuredPlainText(
      rawItem?.description ?? rawItem?.summary ?? rawItem?.content,
    );
    const descriptionBullets = splitResponsibilitiesIntoBullets(description);
    const hasBulletList = descriptionBullets.length > 1;
    const truncatedDescription =
      !hasBulletList && description.length > 280
        ? `${description.slice(0, 277).trimEnd()}…`
        : description;

    return (
      <article key={key} className="space-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold [color:var(--ti)]">{title}</h3>
          {meta ? (
            <p className="text-xs [color:var(--tm2)]">{meta}</p>
          ) : null}
        </div>
        {hasBulletList ? (
          <ul className="ml-4 space-y-1 text-xs list-disc [color:var(--ti)]">
            {descriptionBullets.slice(0, 4).map((line, bulletIdx) => (
              <li key={`${key}-project-bullet-${bulletIdx}`} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        ) : truncatedDescription ? (
          <p className="text-xs leading-snug [color:var(--ti)]">{truncatedDescription}</p>
        ) : null}
      </article>
    );
  };

  // Best-effort rawText reconstruction from current document (titles, block plainText/content as JSON)
  const getRawText = useCallback((): string | null => {
    try {
      if (!currentCv || !Array.isArray(currentCv.sections)) return null;
      const parts: string[] = [];
      for (const s of currentCv.sections) {
        try {
          if (s.title) parts.push(String(s.title));
          if (Array.isArray(s.blocks)) {
            for (const b of s.blocks) {
              try {
                if ((b as any)?.title) parts.push(String((b as any).title));
                const pt = (b as any)?.plainText;
                if (typeof pt === 'string' && pt.trim()) {
                  parts.push(pt.trim());
                } else if ((b as any)?.content) {
                  // Fallback: stringify minimal content snapshot
                  const c = (b as any).content;
                  if (typeof c === 'string') parts.push(c);
                  else {
                    const textish = JSON.stringify(c);
                    if (textish && textish.length > 0) parts.push(textish);
                  }
                }
              } catch {/* noop */}
            }
          }
        } catch {/* noop */}
      }
      const joined = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      return joined.length > 0 ? joined : null;
    } catch {
      return null;
    }
  }, [currentCv]);

  const onApplyToSections = useCallback((updated: CvSection[]) => {
    try {
      if (!currentCv || !Array.isArray(updated)) return;
      const next = { ...currentCv, sections: updated };
      // Use library import to normalize, persist, and update UI atomically
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      importCv(next);
    } catch {
      /* noop */
    }
  }, [currentCv, importCv]);

  const isProfile = String(section.type).toLowerCase() === 'profile';
  const renderStructuredItem = isExperience
    ? renderExperienceItem
    : isEducation
    ? renderEducationItem
    : renderProjectItem;
  const renderBlockList = () =>
    (Array.isArray(section.blocks) ? section.blocks : []).map((block, idx) => (
      <BlockRenderer
        key={String((block as any)?.id ?? idx)}
        sectionId={String(section.id)}
        block={block}
      />
    ));

  return (
    <section aria-labelledby={`section-title-${section.id}`} className="break-inside-avoid">
      <div className="flex items-center justify-between">
        <h2
          id={`section-title-${section.id}`}
          className="flex-1 pb-1 mb-3 text-xl font-semibold border-b-2 [color:var(--tm2)] [border-color:var(--color-border)]"
        >
          {section.title}
        </h2>
        {isProfile ? (
          <div className="pb-1 pl-3 mb-3">
            <StrictExtractButton
              getRawText={getRawText}
              sections={currentCv?.sections}
              onApplyToSections={onApplyToSections}
              label="Strict Extract (contacts)"
              className="ml-2"
              size="sm"
            />
          </div>
        ) : null}
      </div>

      {isSkills ? (
        <div className="space-y-4">
          {skillItems.length > 0 ? (
            <SkillsDisplay
              items={skillItems}
              categories={section.skillCategories}
              showHeadings={true}
              compact={false}
              className="mt-1"
            />
          ) : (
            <p className="text-sm [color:var(--tg2)]">No skills yet.</p>
          )}
        </div>
      ) : isLanguages ? (
        <div className="space-y-4">
          {languageItems.length > 0 ? (
            <LanguagesDisplay items={languageItems} compact={false} className="mt-1" />
          ) : (
            <p className="text-sm [color:var(--tg2)]">No languages yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {isExperience || isEducation || isProjects ? (
            hasRenderableStructured ? (
              renderableStructured.map((item, idx) => renderStructuredItem(item, idx))
            ) : hasBlocks ? (
              renderBlockList()
            ) : (
              <p className="text-sm [color:var(--tg2)]">No content in this section.</p>
            )
          ) : hasBlocks ? (
            renderBlockList()
          ) : (
            <p className="text-sm [color:var(--tg2)]">No content in this section.</p>
          )}
        </div>
      )}
    </section>
  );
}
