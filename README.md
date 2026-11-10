# FoodDash

A multi-role food delivery platform for Yangon. Customers, restaurants, riders, and admins work on one Next.js and MongoDB codebase, with live order tracking and analytics across 10,000+ orders.

**Live demo:** https://deli-app-eta.vercel.app

For the full product and data science write-up, see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

## Portals

| Portal | What it does |
| --- | --- |
| **Customer** | Browse nearby restaurants, order in Kyat, track delivery on a live map, chat with the rider, and get personal food picks |
| **Restaurant** | Manage the order queue, menu, stock, and store status, with revenue figures and kitchen insights |
| **Rider** | Go online, accept jobs, follow the route, track earnings and COD wallet, and see where demand is high |
| **Admin** | Monitor the platform, approve vendors and riders, set service zones and fees, and run analytics |

## Highlights

- **Road-based tracking:** Leaflet maps with OSRM routes from kitchen to rider to customer
- **Customer analytics:** RFM segmentation, Apriori market basket analysis, and churn metrics
- **Delivery time estimates:** linear regression with R², MAE, and RMSE reporting
- **Demand heatmap:** compares live orders with online riders by township to guide surge pay
- **Built for scale:** MongoDB aggregation pipelines and compound indexes keep dashboards responsive across 10,000+ orders

## Tech stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, MongoDB with Mongoose, Leaflet, OSRM, Recharts, simple-statistics, and Framer Motion.

## Run locally

Create a `.env` file with your own `MONGODB_URI` and an `AUTH_SECRET` (any random string of 32+ characters, used to sign login sessions), then run:

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:4028.
