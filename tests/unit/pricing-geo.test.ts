import { describe, expect, it } from 'vitest';
import { haversineKm, travelMinutes, toLatLng } from '@/lib/geo';
import { calculateOrderPricing, DEFAULT_DELIVERY_FEE_KS } from '@/lib/orderPricing';
import { quoteParcel } from '@/lib/parcelPricing';
import { kindFromWmo, isWet } from '@/lib/weather';

describe('geo', () => {
  it('haversine: 0.009° of latitude ≈ 1 km', () => {
    expect(haversineKm({ lat: 16.8, lng: 96.15 }, { lat: 16.809, lng: 96.15 })).toBeCloseTo(1.0, 1);
  });

  it('travelMinutes = round(4 + 3 × 1.3 × km), minimum 3', () => {
    const a = { lat: 16.8, lng: 96.15 };
    const b = { lat: 16.8 + 3 / 111.19, lng: 96.15 }; // 3 km
    expect(travelMinutes(a, b)).toBe(16);
    expect(travelMinutes(a, a)).toBe(4);
  });

  it('toLatLng rejects missing / zero / out-of-range coordinates', () => {
    expect(toLatLng({ lat: 16.8, lng: 96.1 })).toEqual({ lat: 16.8, lng: 96.1 });
    expect(toLatLng({ lat: 0, lng: 0 })).toBeNull();
    expect(toLatLng({ lat: 120, lng: 96 })).toBeNull();
    expect(toLatLng(null)).toBeNull();
  });
});

describe('order pricing', () => {
  it('matches the worked example in the docs (8,000 Ks subtotal, 500 tip)', () => {
    const p = calculateOrderPricing({ subtotal: 8000, tipAmount: 500 });
    expect(p.tax).toBe(640);
    expect(p.deliveryFee).toBe(DEFAULT_DELIVERY_FEE_KS);
    expect(p.deliveryFee).toBe(2050);
    expect(p.total).toBe(8000 + 640 + 2050 + 500);
    expect(p.riderEarning).toBe(2050 - 205 + 500);
    expect(p.platformRevenue).toBe(2400 + 205);
  });
});

describe('parcel pricing', () => {
  it('6 km straight, medium = 4,500 Ks; rider 3,800; platform 700', () => {
    const a = { lat: 16.8, lng: 96.15 };
    const b = { lat: 16.8 + 6 / 111.19, lng: 96.15 };
    const q = quoteParcel(a, b, 'MEDIUM');
    expect(q.roadKm).toBe(7.8);
    expect(q.total).toBe(4500);
    expect(q.riderEarning).toBe(3800);
    expect(q.platformFee).toBe(700);
  });
});

describe('weather codes', () => {
  it('maps WMO codes to four kinds', () => {
    expect(kindFromWmo(0)).toBe('Sunny');
    expect(kindFromWmo(3)).toBe('Cloudy');
    expect(kindFromWmo(61)).toBe('Rainy');
    expect(kindFromWmo(81)).toBe('Rainy');
    expect(kindFromWmo(95)).toBe('Stormy');
    expect(isWet('Stormy')).toBe(true);
    expect(isWet('Cloudy')).toBe(false);
  });
});
