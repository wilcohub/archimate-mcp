/**
 * ArchiMate Relationship Validation
 *
 * Deze module bepaalt of een relatietype tussen twee elementtypen is toegestaan.
 * Het antwoord komt uit een opzoeking in de relatiematrix, niet uit een
 * redenering over elementcategorieen.
 *
 * De matrix staat in matrix.generated.ts en is gegenereerd uit
 * relationships.xml van Archi (repository archimatetool/archi, submap
 * com.archimatetool.model/model). Dat bestand is een machineleesbare weergave
 * van bijlage B.5 van de ArchiMate 3.2 Specification (The Open Group, C226),
 * de bijlage die alle toegestane relaties in de taal opsomt.
 *
 * De matrix maakt geen onderscheid tussen directe en afgeleide relaties. Zij
 * beantwoordt uitsluitend de vraag of een relatie is toegestaan. Buiten haar
 * bereik vallen de derivatiebeperkingen uit B.4, de regels rond junctions en
 * relaties tussen relaties uit B.6, en de viewpointbeperkingen uit
 * viewpoints.xml.
 */

import {
  ElementType,
  RelationshipType,
  MotivationElementTypes,
  StrategyElementTypes,
  BusinessElementTypes,
  ApplicationElementTypes,
  TechnologyElementTypes,
  ImplementationElementTypes,
  CompositeElementTypes,
  getLayerForElementType,
} from '../model/types.js';

import {
  RELATION_MATRIX,
  RELATION_LETTERS,
  MATRIX_SOURCE_VERSION,
} from './matrix.generated.js';

/** Alle relatietypen, in de volgorde waarin ze worden teruggegeven. */
const ALL_RELATIONSHIP_TYPES: RelationshipType[] = [
  'Composition', 'Aggregation', 'Assignment', 'Realization',
  'Serving', 'Access', 'Influence', 'Association',
  'Triggering', 'Flow', 'Specialization',
];

/** Alle elementtypen die de server kent. */
const ALL_ELEMENT_TYPES = [
  ...MotivationElementTypes,
  ...StrategyElementTypes,
  ...BusinessElementTypes,
  ...ApplicationElementTypes,
  ...TechnologyElementTypes,
  ...ImplementationElementTypes,
  ...CompositeElementTypes,
] as ElementType[];

/** Relatietype naar de letter waarmee de matrix het aanduidt. */
const TYPE_TO_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(RELATION_LETTERS).map(([letter, name]) => [name, letter])
);

/**
 * De lettercombinatie voor een bron- en doelconcept, of een lege reeks wanneer
 * het paar niet in de matrix voorkomt.
 */
function lookup(sourceType: string, targetType: string): string {
  return RELATION_MATRIX[`${sourceType}>${targetType}`] ?? '';
}

/**
 * Check if a relationship is valid between two element types.
 *
 * Het antwoord volgt de ArchiMate 3.2-specificatie. Komt een van beide typen
 * niet in de matrix voor, dan is het antwoord false.
 */
export function isValidRelationship(
  sourceType: ElementType,
  targetType: ElementType,
  relationshipType: RelationshipType
): boolean {
  const letter = TYPE_TO_LETTER[relationshipType];
  if (!letter) return false;
  return lookup(sourceType, targetType).includes(letter);
}

/**
 * Get all valid relationship types between two element types
 */
export function getValidRelationshipTypes(
  sourceType: ElementType,
  targetType: ElementType
): RelationshipType[] {
  const letters = lookup(sourceType, targetType);
  return ALL_RELATIONSHIP_TYPES.filter(relType =>
    letters.includes(TYPE_TO_LETTER[relType])
  );
}

/**
 * Get all valid target element types for a relationship from a source type
 */
export function getValidTargetTypes(
  sourceType: ElementType,
  relationshipType: RelationshipType
): ElementType[] {
  return ALL_ELEMENT_TYPES.filter(targetType =>
    isValidRelationship(sourceType, targetType, relationshipType)
  );
}

/**
 * Validate a relationship and return an error message if invalid
 */
export function validateRelationship(
  sourceType: ElementType,
  targetType: ElementType,
  relationshipType: RelationshipType
): { valid: boolean; error?: string; suggestions?: RelationshipType[] } {
  if (isValidRelationship(sourceType, targetType, relationshipType)) {
    return { valid: true };
  }

  const validTypes = getValidRelationshipTypes(sourceType, targetType);

  if (validTypes.length === 0) {
    return {
      valid: false,
      error: `No valid relationships exist between ${sourceType} and ${targetType} in ArchiMate ${MATRIX_SOURCE_VERSION}`,
      suggestions: [],
    };
  }

  return {
    valid: false,
    error: `${relationshipType} is not a valid relationship between ${sourceType} and ${targetType} in ArchiMate ${MATRIX_SOURCE_VERSION}`,
    suggestions: validTypes,
  };
}

/**
 * Get relationship guidance for LLMs
 */
export function getRelationshipGuidance(
  sourceType: ElementType,
  targetType?: ElementType
): string {
  const sourceLayer = getLayerForElementType(sourceType);

  let guidance = `For ${sourceType} (${sourceLayer} layer), per the ArchiMate ${MATRIX_SOURCE_VERSION} relationship tables (Appendix B.5):\n\n`;

  if (targetType) {
    const validTypes = getValidRelationshipTypes(sourceType, targetType);
    if (validTypes.length > 0) {
      guidance += `Valid relationships to ${targetType}: ${validTypes.join(', ')}\n`;
    } else {
      guidance += `No relationships from ${sourceType} to ${targetType} are permitted\n`;
    }
    guidance += `\nThe tables list permitted relationships without distinguishing direct from derived. `;
    guidance += `They do not cover derivation restrictions (B.4), junctions and relationships between relationships (B.6), or viewpoint constraints.\n`;
    return guidance;
  }

  // Zonder doeltype: per relatietype tellen naar hoeveel doelen het mag.
  const counts = ALL_RELATIONSHIP_TYPES
    .map(relType => ({ relType, targets: getValidTargetTypes(sourceType, relType) }))
    .filter(entry => entry.targets.length > 0);

  if (counts.length === 0) {
    guidance += `No relationships from ${sourceType} are permitted.\n`;
    return guidance;
  }

  guidance += `Permitted relationship types, with the number of element types they may point to:\n`;
  for (const { relType, targets } of counts) {
    const examples = targets.slice(0, 5).join(', ');
    const more = targets.length > 5 ? `, and ${targets.length - 5} more` : '';
    guidance += `- ${relType}: ${targets.length} target types (${examples}${more})\n`;
  }
  guidance += `\nCall this again with a target type for the exact answer for one pair.\n`;

  return guidance;
}

/**
 * De versie van de specificatie waarop de matrix berust.
 */
export { MATRIX_SOURCE_VERSION };
