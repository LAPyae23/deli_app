/** Shared support / admin messaging constants */

/** Fixed Admin inbox ID used by ChatWidget → Admin routing */
export const SUPPORT_ADMIN_ID = 'super-admin-001';

export const SUPPORT_ADMIN_ROLE = 'ADMIN';

export const SUPPORT_ADMIN_NAME = 'FoodDash Support';

export const CUSTOMER_TO_RIDER_QUICK_REPLIES = [
  'Is my food available?',
  'Where are you?',
  'Please call me.',
] as const;

export const RIDER_TO_CUSTOMER_QUICK_REPLIES = [
  'On the way!',
  'I have arrived.',
  'Stuck in traffic.',
] as const;

export const RIDER_TO_RESTAURANT_QUICK_REPLIES = [
  "I'm here for pickup.",
  'Which bag is this order?',
  'On my way to the restaurant.',
] as const;
