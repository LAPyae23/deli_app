import { describe, expect, it } from 'vitest';
import { parseQuantity, parseVoiceOrder, matchScore } from '@/lib/voiceOrder';
import { pointsEarnedFor, pointsRedemption } from '@/lib/loyalty';
import { checkSchedule, isWithinHours, minutesUntilClose } from '@/lib/schedule';
import { fitRidge, solve } from '@/lib/etaModel';
import { splitBill } from '@/lib/groupOrders';
import { campaignDiscount } from '@/lib/promotions';
import { quoteParcelRoute } from '@/lib/parcelPricing';

const menu = [
  { id: '1', name: 'Mohinga', restaurantId: 'r' },
  { id: '2', name: 'Shan Noodles', restaurantId: 'r' },
  { id: '3', name: 'Coffee', restaurantId: 'r' },
  { id: '4', name: 'Fried Chicken', restaurantId: 'r' },
  { id: '5', name: 'Chicken Curry', restaurantId: 'r' },
];

describe('voice order parsing', () => {
  it('reads quantities in digits, English and Burmese', () => {
    expect(parseQuantity('2 mohinga')).toBe(2);
    expect(parseQuantity('three coffee')).toBe(3);
    expect(parseQuantity('မုန့်ဟင်းခါး နှစ်ပွဲ')).toBe(2);
    expect(parseQuantity('၃ ခွက်')).toBe(3);
    expect(parseQuantity('coffee')).toBe(1);
  });

  it('matches an English sentence to menu items', () => {
    const { lines, unmatched } = parseVoiceOrder('2 mohinga and a coffee, one fried chicken', menu);
    expect(lines.map((l) => [l.item.name, l.quantity])).toEqual([
      ['Mohinga', 2],
      ['Coffee', 1],
      ['Fried Chicken', 1],
    ]);
    expect(unmatched).toEqual([]);
  });

  it('understands Burmese dish words', () => {
    const { lines } = parseVoiceOrder('မုန့်ဟင်းခါး နှစ်ပွဲနဲ့ ကော်ဖီ', menu);
    expect(lines.map((l) => [l.item.name, l.quantity])).toEqual([
      ['Mohinga', 2],
      ['Coffee', 1],
    ]);
  });

  it('reports parts it cannot match', () => {
    const { lines, unmatched } = parseVoiceOrder('pizza and coffee', menu);
    expect(lines).toHaveLength(1);
    expect(unmatched).toEqual(['pizza']);
    expect(matchScore('shan noodle', 'Shan Noodles')).toBe(1);
  });
});

describe('loyalty points', () => {
  it('earns 1 point per 1,000 Ks', () => {
    expect(pointsEarnedFor(8500)).toBe(8);
    expect(pointsEarnedFor(999)).toBe(0);
  });
  it('spends up to 30% of the food, from 50 points', () => {
    expect(pointsRedemption(40, 10000)).toEqual({ points: 0, value: 0 });
    expect(pointsRedemption(500, 10000)).toEqual({ points: 150, value: 3000 });
    expect(pointsRedemption(80, 10000)).toEqual({ points: 80, value: 1600 });
  });
});

describe('scheduling', () => {
  const now = new Date('2026-11-12T03:30:00Z'); // 10:00 in Yangon
  const hours = { openingTime: '09:00', closingTime: '22:00' };
  it('accepts a time inside opening hours', () => {
    const r = checkSchedule('2026-11-12T06:30:00Z', hours, now); // 13:00 Yangon
    expect(r.ok).toBe(true);
  });
  it('rejects too soon, too far and closed times', () => {
    expect(checkSchedule('2026-11-12T03:45:00Z', hours, now).ok).toBe(false);
    expect(checkSchedule('2026-11-20T06:30:00Z', hours, now).ok).toBe(false);
    expect(checkSchedule('2026-11-12T16:30:00Z', hours, now).ok).toBe(false); // 23:00 Yangon
  });
  it('handles hours past midnight and minutes to close', () => {
    expect(isWithinHours(new Date('2026-11-12T18:30:00Z'), '18:00', '02:00')).toBe(true); // 01:00
    expect(minutesUntilClose(new Date('2026-11-12T15:00:00Z'), '09:00', '22:00')).toBe(30); // 21:30
  });
});

describe('learned ETA regression', () => {
  it('solves a linear system', () => {
    expect(solve([[2, 1], [1, 3]], [3, 5])!.map((x) => Math.round(x * 1000) / 1000)).toEqual([0.8, 1.4]);
  });
  it('recovers the formula behind the data', () => {
    // minutes = 10 + 3·km + 5·peak
    const X: number[][] = [];
    const y: number[] = [];
    for (let km = 1; km <= 8; km++) {
      for (const peak of [0, 1]) {
        X.push([1, km, peak]);
        y.push(10 + 3 * km + 5 * peak);
      }
    }
    const beta = fitRidge(X, y, 0)!;
    expect(beta.map((b) => Math.round(b * 100) / 100)).toEqual([10, 3, 5]);
  });
});

describe('group bill split', () => {
  it('splits shared costs equally and adds up to the total', () => {
    const shares = splitBill(
      [
        { customerId: 'a', name: 'A', items: [{ unitPrice: 4000, quantity: 1 }] },
        { customerId: 'b', name: 'B', items: [{ unitPrice: 2000, quantity: 2 }] },
        { customerId: 'c', name: 'C', items: [] },
      ],
      { subtotal: 8000, tax: 640, deliveryFee: 2050, tipAmount: 0, discount: 0, total: 10690 }
    );
    expect(shares).toHaveLength(2);
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(10690);
    expect(Math.abs(shares[0].amount - shares[1].amount)).toBeLessThanOrEqual(1);
  });
});

describe('promo campaigns', () => {
  it('computes each kind of discount', () => {
    expect(campaignDiscount({ kind: 'PERCENT', value: 10, maxDiscount: 3000 }, 50000, 2000)).toBe(3000);
    expect(campaignDiscount({ kind: 'PERCENT', value: 10, maxDiscount: 0 }, 8000, 2000)).toBe(800);
    expect(campaignDiscount({ kind: 'FLAT', value: 500 }, 300, 2000)).toBe(300);
    expect(campaignDiscount({ kind: 'FREE_DELIVERY', value: 0 }, 8000, 2050)).toBe(2050);
  });
});

describe('multi-stop parcel fare', () => {
  it('adds every leg and 500 Ks per extra stop', () => {
    const a = { lat: 16.78, lng: 96.15 };
    const b = { lat: 16.8, lng: 96.15 };
    const c = { lat: 16.82, lng: 96.15 };
    const single = quoteParcelRoute(a, [b], 'SMALL');
    const multi = quoteParcelRoute(a, [b, c], 'SMALL');
    expect(single.stopFee).toBe(0);
    expect(multi.stopFee).toBe(500);
    expect(multi.legsKm).toHaveLength(2);
    expect(multi.roadKm).toBeCloseTo(multi.legsKm[0] + multi.legsKm[1], 1);
    expect(multi.total).toBeGreaterThan(single.total);
  });
});
