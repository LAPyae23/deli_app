/**
 * Map service addresses. Defaults are the free public OSM servers, which
 * have strict rate limits. For production, run your own (see
 * docker-compose.maps.yml) and set:
 *   NEXT_PUBLIC_OSRM_URL       e.g. https://osrm.example.com
 *   NEXT_PUBLIC_NOMINATIM_URL  e.g. https://geo.example.com
 */
export const OSRM_URL = (process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
export const NOMINATIM_URL = (process.env.NEXT_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
