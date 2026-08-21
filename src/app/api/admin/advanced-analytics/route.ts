import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';

const STATUS_ORDER = [
  'PENDING',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;

const gmvExpr = {
  $convert: {
    input: { $ifNull: ['$totals.totalAmount', { $ifNull: ['$totals.total', 0] }] },
    to: 'double',
    onError: 0,
    onNull: 0,
  },
};

type RestaurantAgg = {
  restaurantName?: string;
  revenue?: number;
};

type StatusAgg = {
  status?: string;
  count?: number;
};

type OpsAgg = {
  township?: string;
  prep?: number;
  wait?: number;
  travel?: number;
};

type SentimentAgg = {
  bucket?: string;
  count?: number;
};

type ReviewAgg = {
  text?: string;
};

const STOP_WORDS = new Set([
  'the',
  'is',
  'and',
  'very',
  'a',
  'an',
  'of',
  'to',
  'in',
  'it',
  'for',
  'on',
  'with',
  'was',
  'were',
  'this',
  'that',
  'i',
  'we',
  'you',
  'they',
  'my',
  'our',
  'your',
  'at',
  'be',
  'been',
  'being',
  'are',
  'as',
  'but',
  'or',
  'so',
  'if',
  'from',
  'by',
  'not',
  'no',
  'too',
  'just',
  'really',
  'also',
  'had',
  'have',
  'has',
  'do',
  'did',
  'does',
  'can',
  'will',
  'would',
  'could',
  'should',
  'me',
  'he',
  'she',
  'him',
  'her',
  'them',
  'their',
  'its',
  'im',
  'ive',
  'dont',
  'didnt',
  'cant',
  'wont',
  'wasnt',
  'isnt',
  'there',
  'here',
  'out',
  'up',
  'down',
  'all',
  'any',
  'some',
  'more',
  'most',
  'than',
  'then',
  'when',
  'what',
  'which',
  'who',
  'how',
  'why',
  'about',
  'into',
  'over',
  'after',
  'before',
  'because',
  'got',
  'get',
  'one',
  'two',
  'bit',
]);

function extractTopKeywords(reviews: ReviewAgg[], limit = 10) {
  const counts = new Map<string, number>();

  for (const row of reviews) {
    const words = String(row.text || '')
      .toLowerCase()
      .replace(/[^a-z\s']/g, ' ')
      .split(/\s+/)
      .map((word) => word.replace(/^'+|'+$/g, ''))
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

const townshipExpr = {
  $let: {
    vars: {
      raw: { $ifNull: ['$totals.township', '$deliveryAddress.township'] },
    },
    in: {
      $trim: {
        input: {
          $cond: [
            {
              $or: [{ $eq: ['$$raw', null] }, { $eq: ['$$raw', ''] }],
            },
            'Unknown',
            { $toString: '$$raw' },
          ],
        },
      },
    },
  },
};

const minsExpr = (field: string) => ({
  $max: [
    0,
    {
      $convert: {
        input: { $ifNull: [`$${field}`, 0] },
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    },
  ],
});

export async function GET() {
  try {
    await dbConnect();

    const payload = await cacheGetOrSet('admin-advanced-analytics-v2', 20_000, async () => {
      const [facet] = (await Order.aggregate(
        [
          {
            $facet: {
              topRestaurants: [
                { $match: { status: { $nin: ['CANCELLED', 'REJECTED'] } } },
                {
                  $group: {
                    _id: {
                      $cond: [
                        {
                          $or: [
                            { $eq: [{ $ifNull: ['$restaurantName', ''] }, ''] },
                            { $eq: ['$restaurantName', null] },
                          ],
                        },
                        'Unknown',
                        '$restaurantName',
                      ],
                    },
                    revenue: { $sum: gmvExpr },
                  },
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
                {
                  $project: {
                    _id: 0,
                    restaurantName: '$_id',
                    revenue: { $round: ['$revenue', 0] },
                  },
                },
              ],
              statusDistribution: [
                {
                  $group: {
                    _id: { $ifNull: ['$status', 'UNKNOWN'] },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    status: '$_id',
                    count: 1,
                  },
                },
              ],
              opsBreakdown: [
                { $match: { status: { $nin: ['CANCELLED', 'REJECTED'] } } },
                {
                  $project: {
                    township: townshipExpr,
                    prep: minsExpr('prepTime'),
                    travel: minsExpr('travelMins'),
                    duration: minsExpr('durationMins'),
                  },
                },
                {
                  $addFields: {
                    wait: {
                      $max: [
                        0,
                        { $subtract: ['$duration', { $add: ['$prep', '$travel'] }] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: {
                      $cond: [{ $eq: ['$township', ''] }, 'Unknown', '$township'],
                    },
                    prep: { $avg: '$prep' },
                    wait: { $avg: '$wait' },
                    travel: { $avg: '$travel' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    township: '$_id',
                    prep: { $round: ['$prep', 1] },
                    wait: { $round: ['$wait', 1] },
                    travel: { $round: ['$travel', 1] },
                    total: {
                      $round: [{ $add: ['$prep', '$wait', '$travel'] }, 1],
                    },
                  },
                },
                { $sort: { total: -1 } },
                { $limit: 12 },
                { $project: { township: 1, prep: 1, wait: 1, travel: 1 } },
              ],
              sentimentMix: [
                { $match: { rating: { $gte: 1, $lte: 5 } } },
                {
                  $group: {
                    _id: {
                      $let: {
                        vars: { r: { $round: ['$rating', 0] } },
                        in: {
                          $switch: {
                            branches: [
                              { case: { $gte: ['$$r', 4] }, then: 'positive' },
                              { case: { $eq: ['$$r', 3] }, then: 'neutral' },
                              { case: { $lte: ['$$r', 2] }, then: 'negative' },
                            ],
                            default: 'neutral',
                          },
                        },
                      },
                    },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    bucket: '$_id',
                    count: 1,
                  },
                },
              ],
              reviews: [
                {
                  $project: {
                    text: {
                      $trim: {
                        input: {
                          $convert: {
                            input: {
                              $ifNull: ['$review', '$reviewComment'],
                            },
                            to: 'string',
                            onError: '',
                            onNull: '',
                          },
                        },
                      },
                    },
                  },
                },
                { $match: { text: { $nin: [null, '', 'null', 'undefined'] } } },
                { $limit: 8000 },
                { $project: { _id: 0, text: 1 } },
              ],
            },
          },
        ],
        { allowDiskUse: true }
      )) as Array<{
        topRestaurants?: RestaurantAgg[];
        statusDistribution?: StatusAgg[];
        opsBreakdown?: OpsAgg[];
        sentimentMix?: SentimentAgg[];
        reviews?: ReviewAgg[];
      }>;

      const topRestaurants = (facet?.topRestaurants || []).map((row) => ({
        restaurantName: String(row.restaurantName || 'Unknown'),
        revenue: Math.max(0, Number(row.revenue) || 0),
      }));

      const statusRank = new Map(STATUS_ORDER.map((status, i) => [status, i]));
      const statusDistribution = (facet?.statusDistribution || [])
        .map((row) => ({
          status: String(row.status || 'UNKNOWN').toUpperCase(),
          count: Math.max(0, Number(row.count) || 0),
        }))
        .sort((a, b) => {
          const ra = statusRank.get(a.status as (typeof STATUS_ORDER)[number]);
          const rb = statusRank.get(b.status as (typeof STATUS_ORDER)[number]);
          if (ra != null && rb != null) return ra - rb;
          if (ra != null) return -1;
          if (rb != null) return 1;
          return b.count - a.count;
        });

      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
      for (const row of facet?.sentimentMix || []) {
        const bucket = String(row.bucket || '');
        const count = Math.max(0, Number(row.count) || 0);
        if (bucket === 'positive' || bucket === 'neutral' || bucket === 'negative') {
          sentimentCounts[bucket] = count;
        }
      }

      const opsBreakdown = (facet?.opsBreakdown || []).map((row) => ({
        township: String(row.township || 'Unknown').trim() || 'Unknown',
        prep: Math.max(0, Number(row.prep) || 0),
        wait: Math.max(0, Number(row.wait) || 0),
        travel: Math.max(0, Number(row.travel) || 0),
      }));

      return {
        success: true as const,
        topRestaurants,
        statusDistribution,
        opsBreakdown,
        sentimentMix: sentimentCounts,
        topKeywords: extractTopKeywords(facet?.reviews || []),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin advanced-analytics GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load advanced analytics' },
      { status: 500 }
    );
  }
}
