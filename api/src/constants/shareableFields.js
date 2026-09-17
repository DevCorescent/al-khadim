const SHAREABLE_FIELD_GROUPS = {
  personal: ['firstName', 'lastName', 'email', 'phone', 'altPhone', 'nationality', 'currentLocation', 'photo'],
  identity: ['passportNo', 'passportExpiry', 'visaStatus'],
  professional: ['headline', 'summary', 'skills', 'languages', 'education', 'experience', 'linkedIn', 'portfolio'],
  compensation: ['currentSalary', 'expectedSalary', 'currency'],
  media: ['introVideoUrl'],
};

const ALL_SHAREABLE_FIELDS = Object.values(SHAREABLE_FIELD_GROUPS).flat();

module.exports = { SHAREABLE_FIELD_GROUPS, ALL_SHAREABLE_FIELDS };
