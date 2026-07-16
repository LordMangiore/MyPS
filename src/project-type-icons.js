/**
 * Icons for the project-type pickers.
 *
 * Kept separate from project-model.js on purpose: that module is plain data and
 * is safe to import anywhere, including server-side. This one pulls in
 * lucide-react, so it belongs to the UI layer only.
 *
 * Keyed by `label` rather than `value` because the three pickers that use it
 * (project create wizard, quote wizard, consultation wizard) share labels but
 * NOT values — e.g. the create wizard stores 'Countertops Only' where the quote
 * wizard stores 'Countertops'.
 */

import {
  Archive,
  Bath,
  Building2,
  ChefHat,
  Grid3x3,
  HardHat,
  House,
  Layers,
  Shapes,
} from 'lucide-react';

export const PROJECT_TYPE_ICONS = {
  Kitchen: ChefHat,
  Bathroom: Bath,
  Flooring: Grid3x3,
  'Whole home': House,
  'New build': HardHat,
  Commercial: Building2,
  Countertops: Layers,
  Cabinets: Archive,
  Other: Shapes,
};

/** Icon component for a project-type label. Falls back rather than rendering nothing. */
export const iconForProjectType = (label) => PROJECT_TYPE_ICONS[label] || Shapes;
