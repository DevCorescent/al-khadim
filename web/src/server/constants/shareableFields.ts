// Ported from api/src/constants/shareableFields.js
export const SHAREABLE_FIELD_GROUPS: Record<string, string[]> = {
  personal: ['firstName', 'lastName', 'email', 'phone', 'altPhone', 'nationality', 'currentLocation', 'photo'],
  identity: ['passportNo', 'passportExpiry', 'visaStatus'],
  professional: ['headline', 'summary', 'skills', 'languages', 'education', 'experience', 'linkedIn', 'portfolio'],
  compensation: ['currentSalary', 'expectedSalary', 'currency'],
  media: ['introVideoUrl'],
};

export const ALL_SHAREABLE_FIELDS: string[] = Object.values(SHAREABLE_FIELD_GROUPS).flat();
